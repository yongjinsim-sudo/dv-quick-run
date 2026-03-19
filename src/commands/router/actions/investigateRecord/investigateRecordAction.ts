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

export async function investigateRecordAction(
    ctx: CommandContext,
    inputOverride?: string
): Promise<void> {
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

    const input = await resolveInvestigationInput(
        selectedText,
        fullDocumentText,
        selectionStartOffset
    );

    if (!input?.recordId) {
      vscode.window.showErrorMessage(INVESTIGATION_INPUT_HELP);
      return;
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
