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
import { InvestigationDocumentModel } from "./types.js";
import { buildInvestigationSignals } from "./investigationSignalsBuilder.js";
import { buildSuggestedQueries } from "./investigationSuggestedQueriesBuilder.js";


export async function investigateRecordAction(ctx: CommandContext): Promise<void> {
  try {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("No active editor found.");
      return;
    }

    const selectedText = getSelectedTextOrCurrentLine(editor);
    const fullDocumentText = editor.document.getText();
    const input = await resolveInvestigationInput(selectedText, fullDocumentText);

    if (!input?.recordId) {
      vscode.window.showErrorMessage("No record identifier or supported input detected.");
      return;
    }

    const recordContext = await resolveRecordContext(ctx, input);
    if (!recordContext) {
      return;
    }

    const queries = buildRecordQueries(recordContext, input.recordId);
    const baseUrl = await ctx.getBaseUrl();
    const token = await ctx.getToken(ctx.getScope());
    const client = ctx.getClient();

    let activeRecordContext = recordContext;
    let activeQueries = queries;
    let record: Record<string, unknown>;

    try {
    record = await client.get(`/${activeQueries.rawQuery}`, token) as Record<string, unknown>;
    } catch (error) {
    const message = toErrorMessage(error);

    const shouldRetryWithEntityPicker =
        message.includes("Dataverse error 404") &&
        activeRecordContext.inferenceSource !== "recordPath" &&
        activeRecordContext.inferenceSource !== "explicit";

    if (!shouldRetryWithEntityPicker) {
        throw error;
    }

    const fallbackContext = await promptForRecordContext(ctx);
    if (!fallbackContext) {
        throw error;
    }

    activeRecordContext = fallbackContext;
    activeQueries = buildRecordQueries(activeRecordContext, input.recordId);
    record = await client.get(`/${activeQueries.rawQuery}`, token) as Record<string, unknown>;
    }

    const uiLink = buildDataverseRecordUiLink(
      baseUrl,
      activeRecordContext.entityLogicalName,
      input.recordId
    );

    const summaryFields = await buildSummaryFields(
      ctx,
      client,
      token,
      activeRecordContext,
      record,
      input.sourceJson
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
      input.recordId
    );

    const signals = buildInvestigationSignals({
      recordContext: activeRecordContext,
      record,
      relatedRecords,
      selectedCandidateType: input.selectedCandidateType,
      selectedCandidateConfidence: input.selectedCandidateConfidence
    });

    const suggestedQueries = buildSuggestedQueries({
      recordContext: activeRecordContext,
      recordId: input.recordId,
      rawQuery: activeQueries.rawQuery,
      minimalQuery: activeQueries.minimalQuery,
      relatedRecords
    });

    const model: InvestigationDocumentModel = {
      environmentName: ctx.envContext.getEnvironmentName(),
      entityLogicalName: activeRecordContext.entityLogicalName,
      entitySetName: activeRecordContext.entitySetName,
      recordId: input.recordId,
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
        `Input type: ${input.type}`,
        `Context source: ${activeRecordContext.inferenceSource}`,
        `Selection mode: ${input.sourceJson ? "selection/object-driven" : "document/guid-driven"}`
      ],

      selectedCandidateFieldName: input.selectedCandidateFieldName,
      selectedCandidateType: input.selectedCandidateType,
      selectedCandidateConfidence: input.selectedCandidateConfidence,
      selectedCandidateReason: input.selectedCandidateReason
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

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
