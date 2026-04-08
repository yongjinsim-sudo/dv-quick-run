import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { buildDataverseRecordUiLink } from "./dataverseUiLinkBuilder.js";
import { buildInvestigationDocument } from "./investigationDocumentBuilder.js";
import { resolveInvestigationInput } from "./investigationInputResolver.js";
import { buildRecordQueries } from "./recordQueryBuilder.js";
import {
  promptForRecordContext,
  resolveRecordContext
} from "./recordContextResolver.js";
import {
  buildRelatedRecords,
  buildReverseLinks,
  buildSummaryFields,
  tryGetPrimaryName
} from "./recordSummaryBuilder.js";
import { InvestigationDocumentModel, InvestigationInput, RecordContext } from "./types.js";
import { buildInvestigationSignals } from "./investigationSignalsBuilder.js";
import { buildSuggestedQueries } from "./investigationSuggestedQueriesBuilder.js";
import { extractInvestigationCandidatesFromJson } from "./investigationCandidateExtractor.js";
import { extractInvestigationCandidatesFromSelection } from "./investigationSelectionExtractor.js";
import { pickInvestigationCandidate } from "./investigationCandidatePicker.js";
import { rescoreSelectedInvestigationCandidate, scoreInvestigationCandidates } from "./investigationCandidateScorer.js";
import { resolveIdentifierOwnership } from "./identifierResolution/identifierResolutionResolver.js";
import { reportIdentifierResolutionOutcome } from "./identifierResolution/identifierResolutionReporter.js";
import { classifyInvestigationField } from "./fieldResolutionClassifier.js";
import {
  loadEntityDefByEntitySetName,
  loadEntityDefByLogicalName,
  loadEntityDefs
} from "../shared/metadataAccess.js";
import { loadInvestigateScopeSettings, matchesInvestigatePattern } from "./investigateScope.js";
import { logInfo } from "../../../../utils/logger.js";

export async function investigateRecordAction(
    ctx: CommandContext,
    inputOverride?: string
): Promise<void> {
  console.log("[DVQR][investigate] input", inputOverride);

  try {

    const INVESTIGATION_INPUT_HELP =
      "No valid record identifier found. Try selecting a Dataverse record ID, a record path like contacts(<guid>), or a JSON row/object containing an id field.";

    const editor = vscode.window.activeTextEditor;

    const safeInputOverride =
      typeof inputOverride === "string" ? inputOverride.trim() : "";

    const selectedText = safeInputOverride
        ? safeInputOverride
        : editor
            ? getSelectedTextOrCurrentLine(editor)
            : "";

    if (!selectedText) {
        vscode.window.showErrorMessage(INVESTIGATION_INPUT_HELP);
        return;
    }

    const fullDocumentText = safeInputOverride
        ? selectedText
        : editor
            ? editor.document.getText()
            : selectedText;

    const selectionStartOffset = safeInputOverride
        ? 0
        : editor
            ? editor.document.offsetAt(editor.selection.start)
            : 0;

    const identifierRequest = tryParseIdentifierResolutionRequest(safeInputOverride || selectedText);

    let input: InvestigationInput | undefined;
    if (identifierRequest) {
      console.log("[DVQR][investigate] forcing identifier-resolution branch", identifierRequest);
      input = undefined;
    } else {
      input = await resolveInvestigationInput(
          selectedText,
          fullDocumentText,
          selectionStartOffset
      );
    }

    if (input?.recordId) {
      const editorResolution = await tryResolveEditorGuidWithoutQuickPick(ctx, input, identifierRequest);
      if (editorResolution?.handled) {
        if (!editorResolution.input) {
          return;
        }

        input = editorResolution.input;
      }
    }

    if (!input?.recordId) {
      const identifierValue = identifierRequest?.value ?? (looksLikeIdentifierValue(selectedText) ? selectedText.trim() : undefined);
      if (identifierValue) {
        const fieldClassification = identifierRequest?.entityLogicalName && identifierRequest?.fieldLogicalName
          ? await classifyInvestigationField(ctx, {
              entityLogicalName: identifierRequest.entityLogicalName,
              fieldLogicalName: identifierRequest.fieldLogicalName,
              primaryIdField: identifierRequest.primaryIdField
            })
          : undefined;

        if (fieldClassification?.kind === "referenceKey" && fieldClassification.targetEntityLogicalName && fieldClassification.targetEntitySetName) {
          input = {
            type: "recordPath",
            rawText: identifierValue,
            recordId: identifierValue,
            entityLogicalName: fieldClassification.targetEntityLogicalName,
            entitySetName: fieldClassification.targetEntitySetName,
            selectedCandidateFieldName: identifierRequest?.fieldLogicalName,
            selectedCandidateType: "related",
            selectedCandidateConfidence: 0.98,
            selectedCandidateReason: `Referenced via ${identifierRequest?.entityLogicalName}.${identifierRequest?.fieldLogicalName}`
          };
        } else {
          const resolution = await resolveIdentifierOwnership(ctx, {
            value: identifierValue,
            currentEntityLogicalName: identifierRequest?.entityLogicalName,
            currentEntitySetName: identifierRequest?.entitySetName,
            currentFieldLogicalName: identifierRequest?.fieldLogicalName,
            currentFieldAttributeType: identifierRequest?.fieldAttributeType,
            primaryIdField: identifierRequest?.primaryIdField
          });

          if (resolution.outcome !== "resolved" || !resolution.resolved) {
            await reportIdentifierResolutionOutcome(resolution);
            return;
          }

          input = {
            type: "recordPath",
            rawText: identifierValue,
            recordId: resolution.resolved.recordId,
            entityLogicalName: resolution.resolved.entityLogicalName,
            entitySetName: resolution.resolved.entitySetName,
            selectedCandidateFieldName: resolution.resolved.matchedField,
            selectedCandidateType: "related",
            selectedCandidateConfidence: resolution.resolved.confidence === "high" ? 0.95 : 0.75,
            selectedCandidateReason: `Resolved via ${resolution.resolved.entityLogicalName}.${resolution.resolved.matchedField}`
          };
        }
      } else {
        vscode.window.showErrorMessage(INVESTIGATION_INPUT_HELP);
        return;
      }
    }

    let activeInput: InvestigationInput = { ...input };
    let activeRecordContext = await resolveRecordContext(ctx, activeInput);
    if (!activeRecordContext) {
      return;
    }

    const baseUrl = await ctx.getBaseUrl();
    const token = await ctx.getToken(ctx.getScope());
    const client = ctx.getClient();

    const activeRecordId = activeInput.recordId!;
    let activeQueries = buildRecordQueries(activeRecordContext, activeRecordId);
    let record = await tryGetRecord(client, token, activeQueries.rawQuery);

    if (!record && shouldRetryWithEntityPicker(activeRecordContext)) {
      const fallbackContext = await promptForRecordContext(ctx);
      if (fallbackContext) {
        activeRecordContext = fallbackContext;
        activeQueries = buildRecordQueries(activeRecordContext, activeRecordId);
        record = await tryGetRecord(client, token, activeQueries.rawQuery);
      }
    }

    if (!record) {
      const retriedInput = await promptForCandidateRetry(activeInput, activeRecordContext);
      if (retriedInput) {
        activeInput = retriedInput;
        activeQueries = buildRecordQueries(activeRecordContext, activeInput.recordId!);
        record = await tryGetRecord(client, token, activeQueries.rawQuery);
      }
    }

    if (!record) {
      throw new Error(`Dataverse error 404 for GET ${joinDataverseUrl(baseUrl, activeQueries.rawQuery)}`);
    }

    const rescoredCandidate = rescoreActiveCandidate(activeInput, activeRecordContext);

    const uiLink = buildDataverseRecordUiLink(
      baseUrl,
      activeRecordContext.entityLogicalName,
      activeInput.recordId!
    );

    const summaryFields = await buildSummaryFields(
      ctx,
      client,
      token,
      activeRecordContext,
      record,
      activeInput.sourceJson
    );

    const relatedRecords = await buildRelatedRecords(
      ctx,
      client,
      token,
      activeRecordContext,
      record
    );

    const reverseLinks = await buildReverseLinks(
      ctx,
      client,
      token,
      activeRecordContext,
      activeInput.recordId!
    );

    const signals = buildInvestigationSignals({
      recordContext: activeRecordContext,
      record,
      relatedRecords,
      selectedCandidateType: rescoredCandidate?.candidateType ?? activeInput.selectedCandidateType,
      selectedCandidateConfidence: rescoredCandidate?.confidence ?? activeInput.selectedCandidateConfidence
    });

    const suggestedQueries = buildSuggestedQueries({
      recordContext: activeRecordContext,
      recordId: activeInput.recordId!,
      rawQuery: activeQueries.rawQuery,
      minimalQuery: activeQueries.minimalQuery,
      relatedRecords
    });

    const model: InvestigationDocumentModel = {
      environmentName: ctx.envContext.getEnvironmentName(),
      entityLogicalName: activeRecordContext.entityLogicalName,
      entitySetName: activeRecordContext.entitySetName,
      recordId: activeInput.recordId!,
      primaryName: tryGetPrimaryName(activeRecordContext, record),
      uiLink,
      minimalQuery: activeQueries.minimalQuery,
      rawQuery: activeQueries.rawQuery,
      summaryFields,
      relatedRecords,
      reverseLinks,
      suggestedQueries,
      signals,
      inferenceNotes: [
        `Input type: ${activeInput.type}`,
        `Context source: ${activeRecordContext.inferenceSource}`,
        `Selection mode: ${activeInput.sourceJson ? "selection/object-driven" : "document/guid-driven"}`
      ],

      selectedCandidateFieldName: rescoredCandidate?.fieldName ?? activeInput.selectedCandidateFieldName,
      selectedCandidateType: rescoredCandidate?.candidateType ?? activeInput.selectedCandidateType,
      selectedCandidateConfidence: rescoredCandidate?.confidence ?? activeInput.selectedCandidateConfidence,
      selectedCandidateReason: rescoredCandidate?.reason ?? activeInput.selectedCandidateReason
    };

    const content = buildInvestigationDocument(model);

    if (!content || !content.trim()) {
      vscode.window.showErrorMessage("Investigation report content was empty.");
      return;
    }

    await showInvestigationDocument(buildInvestigationDocumentTitle(model), content);
  } catch (error) {
    console.error("[InvestigateRecord] Failed:", error);
    vscode.window.showErrorMessage(`Investigate Record failed: ${toErrorMessage(error)}`);
  }
}


interface IdentifierResolutionInputOverride {
  __dvqrIdentifierResolution?: true;
  value?: string;
  entityLogicalName?: string;
  entitySetName?: string;
  fieldLogicalName?: string;
  fieldAttributeType?: string;
  primaryIdField?: string;
}

function tryParseIdentifierResolutionRequest(text: string): IdentifierResolutionInputOverride | undefined {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(trimmed) as IdentifierResolutionInputOverride;
    if (!parsed || parsed.__dvqrIdentifierResolution !== true || !parsed.value) {
      return undefined;
    }

    return parsed;
  } catch {
    return undefined;
  }
}

function looksLikeIdentifierValue(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 6) {
    return false;
  }

  if (/\s{2,}/.test(trimmed)) {
    return false;
  }

  if (/^[\[{]/.test(trimmed)) {
    return false;
  }

  return true;
}

function getSelectedTextOrCurrentLine(editor: vscode.TextEditor): string {
  const document = editor.document;
  const selectionText = document.getText(editor.selection).trim();

  if (selectionText) {
    return selectionText;
  }

  const fullText = document.getText().trim();
  if (looksLikeJsonDocument(fullText)) {
    return fullText;
  }

  if (document.languageId === "json") {
    return fullText;
  }

  return document.lineAt(editor.selection.active.line).text.trim();
}

function looksLikeJsonDocument(text: string): boolean {
  if (!text) {
    return false;
  }

  const trimmed = text.trim();
  return (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  );
}

async function showInvestigationDocument(title: string, content: string): Promise<void> {
  const safeTitle = sanitizeInvestigationDocumentTitle(title);
  const documentUri = vscode.Uri.parse(`untitled:${safeTitle}.txt`);
  const document = await vscode.workspace.openTextDocument(documentUri);

  const edit = new vscode.WorkspaceEdit();
  const fullRange = new vscode.Range(
    new vscode.Position(0, 0),
    document.lineAt(document.lineCount - 1).range.end
  );

  edit.replace(documentUri, fullRange, content);
  await vscode.workspace.applyEdit(edit);

  await vscode.window.showTextDocument(document, { preview: false });
}

function buildInvestigationDocumentTitle(model: InvestigationDocumentModel): string {
  const environment = model.environmentName?.trim() || "Unknown";
  const entity = model.entityLogicalName?.trim() || "UnknownEntity";
  const shortId = model.recordId?.trim().slice(0, 8) || "unknown";
  return `DV Investigation [${environment}] - ${entity} - ${shortId}`;
}

function sanitizeInvestigationDocumentTitle(value: string): string {
  return value
    .replace(/[\/:*?"<>|]+/g, " - ")
    .replace(/\s+/g, " ")
    .trim() || "DV Investigation";
}

async function tryGetRecord(
  client: ReturnType<CommandContext["getClient"]>,
  token: string,
  rawQuery: string
): Promise<Record<string, unknown> | undefined> {
  try {
    return await client.get(`/${rawQuery}`, token) as Record<string, unknown>;
  } catch (error) {
    if (isDataverse404(error)) {
      return undefined;
    }

    throw error;
  }
}

function shouldRetryWithEntityPicker(recordContext: RecordContext): boolean {
  return (
    recordContext.inferenceSource !== "recordPath" &&
    recordContext.inferenceSource !== "explicit" &&
    recordContext.inferenceSource !== "quickPick"
  );
}

async function promptForCandidateRetry(
  input: InvestigationInput,
  recordContext: RecordContext
): Promise<InvestigationInput | undefined> {
  const rescoredCandidates = buildRetryCandidates(input, recordContext);
  if (!rescoredCandidates.length) {
    return undefined;
  }

  const chosenCandidate = await pickInvestigationCandidate(rescoredCandidates);
  if (!chosenCandidate?.recordId) {
    return undefined;
  }

  return {
    ...input,
    recordId: chosenCandidate.recordId,
    selectedCandidateFieldName: chosenCandidate.fieldName,
    selectedCandidateType: chosenCandidate.candidateType,
    selectedCandidateConfidence: chosenCandidate.confidence,
    selectedCandidateReason: chosenCandidate.reason
  };
}

function buildRetryCandidates(
  input: InvestigationInput,
  recordContext: RecordContext
) {
  const candidates = input.sourceJson
    ? extractInvestigationCandidatesFromJson(input.sourceJson, recordContext.entitySetName)
    : extractInvestigationCandidatesFromSelection(input.rawText, recordContext.entitySetName);

  return scoreInvestigationCandidates(candidates, {
    entityLogicalName: recordContext.entityLogicalName,
    primaryIdField: recordContext.primaryIdField,
    entitySetName: recordContext.entitySetName
  }).filter(candidate => !isSameCandidate(candidate, input));
}

function isSameCandidate(
  candidate: { recordId: string; fieldName?: string },
  input: InvestigationInput
): boolean {
  return (
    candidate.recordId === input.recordId &&
    (candidate.fieldName ?? "") === (input.selectedCandidateFieldName ?? "")
  );
}

function rescoreActiveCandidate(
  input: InvestigationInput,
  recordContext: RecordContext
) {
  if (!input.recordId || !input.selectedCandidateFieldName) {
    return undefined;
  }

  return rescoreSelectedInvestigationCandidate(
    {
      recordId: input.recordId,
      fieldName: input.selectedCandidateFieldName,
      sourceType: input.selectedCandidateFieldName.endsWith("_value")
        ? "lookup"
        : "rootField"
    },
    {
      entityLogicalName: recordContext.entityLogicalName,
      primaryIdField: recordContext.primaryIdField,
      entitySetName: recordContext.entitySetName
    }
  );
}

function isDataverse404(error: unknown): boolean {
  return toErrorMessage(error).includes("Dataverse error 404");
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}


function joinDataverseUrl(baseUrl: string, rawQuery: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const normalizedQuery = rawQuery.replace(/^\/+/, "");
  return `${normalizedBaseUrl}/${normalizedQuery}`;
}


type EditorGuidResolutionResult = {
  handled: boolean;
  input?: InvestigationInput;
};

async function tryResolveEditorGuidWithoutQuickPick(
  ctx: CommandContext,
  input: InvestigationInput,
  identifierRequest?: IdentifierResolutionInputOverride
): Promise<EditorGuidResolutionResult | undefined> {
  const recordId = String(input.recordId ?? "").trim();
  if (!recordId) {
    return undefined;
  }

  if (identifierRequest || (input.type === "recordPath" && input.entitySetName)) {
    return undefined;
  }

  const client = ctx.getClient();
  const token = await ctx.getToken(ctx.getScope());
  const entityDef = input.entityLogicalName
    ? await loadEntityDefByLogicalName(ctx, client, token, input.entityLogicalName)
    : input.entitySetName
      ? await loadEntityDefByEntitySetName(ctx, client, token, input.entitySetName)
      : undefined;

  const entityLogicalName = input.entityLogicalName ?? entityDef?.logicalName;
  const entitySetName = input.entitySetName ?? entityDef?.entitySetName;
  const primaryIdField = entityDef?.primaryIdAttribute;
  const fieldLogicalName = input.selectedCandidateFieldName;
  const fieldAttributeType = looksLikeGuid(recordId) ? "Uniqueidentifier" : "String";

  if (entityLogicalName && entitySetName && fieldLogicalName) {
    const classification = await classifyInvestigationField(ctx, {
      entityLogicalName,
      fieldLogicalName,
      primaryIdField
    });

    if (classification.kind === "primaryKey") {
      return {
        handled: true,
        input: {
          ...input,
          entityLogicalName,
          entitySetName,
          selectedCandidateFieldName: fieldLogicalName,
          selectedCandidateType: "primary",
          selectedCandidateConfidence: 0.98,
          selectedCandidateReason: `Resolved from ${entityLogicalName}.${fieldLogicalName}`
        }
      };
    }

    if (classification.kind === "referenceKey" && classification.targetEntityLogicalName && classification.targetEntitySetName) {
      return {
        handled: true,
        input: {
          type: "recordPath",
          rawText: input.rawText,
          recordId,
          entityLogicalName: classification.targetEntityLogicalName,
          entitySetName: classification.targetEntitySetName,
          selectedCandidateFieldName: fieldLogicalName,
          selectedCandidateType: "related",
          selectedCandidateConfidence: 0.98,
          selectedCandidateReason: `Referenced via ${entityLogicalName}.${fieldLogicalName}`
        }
      };
    }

    const contextualResolution = await resolveIdentifierOwnership(ctx, {
      value: recordId,
      currentEntityLogicalName: entityLogicalName,
      currentEntitySetName: entitySetName,
      currentFieldLogicalName: fieldLogicalName,
      currentFieldAttributeType: fieldAttributeType,
      primaryIdField
    });

    if (contextualResolution.outcome === "resolved" && contextualResolution.resolved) {
      return {
        handled: true,
        input: {
          type: "recordPath",
          rawText: input.rawText,
          recordId: contextualResolution.resolved.recordId,
          entityLogicalName: contextualResolution.resolved.entityLogicalName,
          entitySetName: contextualResolution.resolved.entitySetName,
          selectedCandidateFieldName: contextualResolution.resolved.matchedField,
          selectedCandidateType: "related",
          selectedCandidateConfidence: contextualResolution.resolved.confidence === "high" ? 0.95 : 0.75,
          selectedCandidateReason: `Resolved via ${contextualResolution.resolved.entityLogicalName}.${contextualResolution.resolved.matchedField}`
        }
      };
    }

    if (contextualResolution.outcome !== "unresolved") {
      await reportIdentifierResolutionOutcome(contextualResolution);
      return { handled: true };
    }
  }

  const investigateScope = loadInvestigateScopeSettings(ctx);
  const investigateScopeTables = Array.from(investigateScope.searchScopeTables);
  logInfo(
    ctx.output,
    `[Investigate] Search scope applied: ${investigateScopeTables.join(", ") || "(none)"}`
  );

  const directPrimaryMatch = await resolvePrimaryIdAcrossAllowedTables(ctx, recordId);
  if (directPrimaryMatch) {
    return {
      handled: true,
      input: {
        type: "recordPath",
        rawText: input.rawText,
        recordId: directPrimaryMatch.recordId,
        entityLogicalName: directPrimaryMatch.entityLogicalName,
        entitySetName: directPrimaryMatch.entitySetName,
        selectedCandidateFieldName: directPrimaryMatch.primaryIdField,
        selectedCandidateType: "primary",
        selectedCandidateConfidence: 0.99,
        selectedCandidateReason: `Matched ${directPrimaryMatch.entityLogicalName}.${directPrimaryMatch.primaryIdField}`
      }
    };
  }

  const broadResolution = await resolveIdentifierOwnership(ctx, {
    value: recordId,
    currentEntityLogicalName: entityLogicalName,
    currentEntitySetName: entitySetName,
    currentFieldLogicalName: fieldLogicalName,
    currentFieldAttributeType: fieldAttributeType,
    primaryIdField
  });

  if (broadResolution.outcome === "resolved" && broadResolution.resolved) {
    return {
      handled: true,
      input: {
        type: "recordPath",
        rawText: input.rawText,
        recordId: broadResolution.resolved.recordId,
        entityLogicalName: broadResolution.resolved.entityLogicalName,
        entitySetName: broadResolution.resolved.entitySetName,
        selectedCandidateFieldName: broadResolution.resolved.matchedField,
        selectedCandidateType: "related",
        selectedCandidateConfidence: broadResolution.resolved.confidence === "high" ? 0.95 : 0.75,
        selectedCandidateReason: `Resolved via ${broadResolution.resolved.entityLogicalName}.${broadResolution.resolved.matchedField}`
      }
    };
  }

  await reportIdentifierResolutionOutcome(broadResolution);
  return { handled: true };
}

async function resolvePrimaryIdAcrossAllowedTables(
  ctx: CommandContext,
  recordId: string
): Promise<{ entityLogicalName: string; entitySetName: string; primaryIdField: string; recordId: string } | undefined> {
  if (!looksLikeGuid(recordId)) {
    return undefined;
  }

  const client = ctx.getClient();
  const token = await ctx.getToken(ctx.getScope());
  const entityDefs = await loadEntityDefs(ctx, client, token, { silent: true });
  const investigateScope = loadInvestigateScopeSettings(ctx, { log: false });
  const allowedPatterns = [...investigateScope.searchScopeTables];
  const matches: Array<{ entityLogicalName: string; entitySetName: string; primaryIdField: string; recordId: string }> = [];

  const targetEntities = entityDefs.filter((entity) => {
    const logicalName = String(entity.logicalName ?? "").trim().toLowerCase();
    if (!logicalName || !entity.entitySetName || !entity.primaryIdAttribute) {
      return false;
    }

    if (allowedPatterns.length === 0) {
      return false;
    }

    return allowedPatterns.some((pattern) => matchesInvestigatePattern(logicalName, pattern));
  }).slice(0, investigateScope.maxSearchTables);

for (const entity of targetEntities) {
  const primaryIdField = entity.primaryIdAttribute?.trim();
  const entitySetName = entity.entitySetName?.trim();
  const entityLogicalName = entity.logicalName?.trim();

  if (!primaryIdField || !entitySetName || !entityLogicalName) {
    continue;
  }

  try {
    const query = `/${entitySetName}?$select=${primaryIdField}${entity.primaryNameAttribute ? `,${entity.primaryNameAttribute}` : ""}&$filter=${primaryIdField} eq ${recordId}&$top=2`;
    const response = await client.get(query, token) as { value?: Array<Record<string, unknown>> };
    const rows = Array.isArray(response.value) ? response.value : [];

    for (const row of rows) {
      const matchedId = String(row[primaryIdField] ?? "").trim();
      if (!matchedId) {
        continue;
      }

      matches.push({
        entityLogicalName,
        entitySetName,
        primaryIdField,
        recordId: matchedId
      });
    }
    } catch {
      // best effort
    }
  }

  const unique = dedupePrimaryMatches(matches);
  if (unique.length === 1) {
    return unique[0]!;
  }

  if (unique.length > 1) {
    const picked = await vscode.window.showQuickPick(unique.map((match) => ({
      label: match.entityLogicalName,
      description: match.primaryIdField,
      detail: match.recordId,
      match
    })), {
      placeHolder: "Multiple matching primary-key records found. Select which record to investigate"
    });

    return picked?.match;
  }

  return undefined;
}

function dedupePrimaryMatches(matches: Array<{ entityLogicalName: string; entitySetName: string; primaryIdField: string; recordId: string }>) {
  const byKey = new Map<string, { entityLogicalName: string; entitySetName: string; primaryIdField: string; recordId: string }>();
  for (const match of matches) {
    const key = `${match.entityLogicalName}|${match.primaryIdField}|${match.recordId}`;
    if (!byKey.has(key)) {
      byKey.set(key, match);
    }
  }

  return [...byKey.values()].sort((a, b) => a.entityLogicalName.localeCompare(b.entityLogicalName) || a.recordId.localeCompare(b.recordId));
}

function looksLikeGuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value.trim());
}
