import * as vscode from "vscode";
import type { ComparisonViewModel } from "../../core/comparison/index.js";
import { buildEvidencePivotResult } from "../../product/comparison/evidenceContinuation/liveEvidencePivotService.js";
import { buildDefaultExportUri, renderComparisonMarkdown } from "../../product/comparison/export/comparisonMarkdownExport.js";
import { ensureSnapshotWorkspace } from "../../product/comparison/snapshotWorkspaceService.js";
import { buildComparisonReportModel } from "../../product/comparison/reports/comparisonReportBuilder.js";
import { buildComparisonUnderstandingDocument } from "../../product/comparison/comparisonUnderstandingDocument.js";
import { renderUnderstandingDocumentMarkdown } from "../../product/understanding/understandingMarkdownRenderer.js";
import { renderComparisonReportHtml } from "../../product/comparison/reports/comparisonReportHtmlRenderer.js";
import { renderComparisonReportPdf } from "../../product/comparison/reports/comparisonReportPdfRenderer.js";
import {
  buildInvestigationSessionKey,
  clearInvestigationSessionState,
  readInvestigationSessionState,
  writeInvestigationSessionState
} from "../../product/investigationWorkspace/investigationSessionState.js";
import type { InvestigationSessionState } from "../../product/investigationWorkspace/investigationSessionState.js";
import { canExportComparison, canRunCrossEnvironmentDiff } from "../../product/capabilities/capabilityResolver.js";
import { queryAuditEvidence, renderAuditEvidenceResultHtml } from "../../product/audit/index.js";
import type { AuditEvidenceResult } from "../../product/audit/auditEvidenceTypes.js";
import { renderComparisonSurfaceHtml, renderStandaloneComparisonSurfaceHtml } from "../../webview/comparisonSurface/renderComparisonSurfaceHtml.js";
import type { CommandContext } from "../context/commandContext.js";
import { promptForCrossEnvironmentDiffProAccess } from "./comparisonCapabilityPrompt.js";
import { exportDvafAttributeArtifact } from "../../pro/reconstruction/dvafExportService.js";
import { exportDvimIdentityParticipationArtifact } from "../../pro/reconstruction/dvimExportService.js";
import { exportDvceChoiceDefinitionArtifact } from "../../pro/reconstruction/dvceExportService.js";
import { exportDvevmEnvironmentVariableArtifact } from "../../pro/reconstruction/dvevmExportService.js";
import type { AttributeReconstructionCandidate } from "../../pro/reconstruction/attributeReconstructionCandidate.js";
import type { DvimParticipationReconstructionCandidate } from "../../pro/reconstruction/dvimArtifactTypes.js";
import type { DvceChoiceReconstructionCandidate } from "../../pro/reconstruction/dvceArtifactTypes.js";
import type { DvevmRuntimeConfigurationCandidate } from "../../pro/reconstruction/dvevmArtifactTypes.js";
import { buildDvafReconstructionArtifactReference, buildDvimReconstructionArtifactReference, buildDvceReconstructionArtifactReference, buildDvevmReconstructionArtifactReference } from "../../pro/reconstruction/reconstructionArtifactReference.js";
import type { ReconstructionArtifactReference } from "../../pro/reconstruction/reconstructionArtifactReference.js";

let comparisonPanel: vscode.WebviewPanel | undefined;
let comparisonPanelMessageDisposable: vscode.Disposable | undefined;
let comparisonAuditEvidenceByEvidenceId = new Map<string, AuditEvidenceResult>();
let comparisonReconstructionArtifacts: ReconstructionArtifactReference[] = [];

function appendEvidencePivotDiagnostic(ctx: CommandContext, stage: string, details?: unknown): void {
  const timestamp = new Date().toISOString();
  const serialisedDetails = (() => {
    try {
      return typeof details === "string" ? details : JSON.stringify(details ?? {});
    } catch {
      return String(details);
    }
  })();

  ctx.output.appendLine(`[${timestamp}] [Comparison Evidence Pivot] ${stage} ${serialisedDetails}`);
}

type ComparisonExportKind = "json" | "md" | "html" | "baseline" | "summary-html" | "handoff-html" | "summary-pdf" | "handoff-pdf" | "understanding-md";

function isReportExportKind(kind: ComparisonExportKind): boolean {
  return kind === "summary-html" || kind === "summary-pdf" || kind === "handoff-html" || kind === "handoff-pdf" || kind === "understanding-md";
}

function canSaveStandardComparisonExport(model: ComparisonViewModel): boolean {
  // Timeline Diff and Cross-Environment Diff can both produce real comparison models.
  // Standard exports should follow the resolved comparison/export capability, but
  // fall back to real comparison availability so toolbar actions do not become
  // inert when entitlement state and the rendered model get out of sync.
  return canExportComparison() || canRunCrossEnvironmentDiff() || model.title.startsWith("Timeline Diff");
}

async function readWatermarkLogoDataUri(ctx: CommandContext): Promise<string | undefined> {
  const logoUri = vscode.Uri.joinPath(ctx.ext.extensionUri, "images", "icon.png");
  try {
    const bytes = await vscode.workspace.fs.readFile(logoUri);
    return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return undefined;
  }
}

function getExportFilter(kind: ComparisonExportKind): Record<string, string[]> {
  if (kind === "json") {
    return { "JSON": ["json"] };
  }

  if (kind === "md" || kind === "understanding-md") {
    return { "Markdown": ["md"] };
  }

  if (kind === "summary-pdf" || kind === "handoff-pdf") {
    return { "PDF": ["pdf"] };
  }

  return { "HTML": ["html"] };
}

function getExportSaveLabel(kind: ComparisonExportKind): string {
  switch (kind) {
    case "json":
      return "Save JSON";
    case "md":
      return "Save MD";
    case "baseline":
      return "Export Baseline Diff";
    case "summary-html":
      return "Save Diff Findings Summary";
    case "handoff-html":
      return "Save Investigation Handoff";
    case "summary-pdf":
      return "Save Diff Findings Summary PDF";
    case "handoff-pdf":
      return "Save Investigation Handoff PDF";
    case "understanding-md":
      return "Save Understanding Report";
    case "html":
    default:
      return "Save HTML";
  }
}

function getExportDialogTitle(model: ComparisonViewModel, kind: ComparisonExportKind): string {
  const exportTitle = model.title.startsWith("Timeline Diff") ? "Timeline Diff" : "Cross-Environment Diff";
  switch (kind) {
    case "json":
      return `Save ${exportTitle} JSON`;
    case "md":
      return `Save ${exportTitle} Markdown`;
    case "baseline":
      return "Export Pre-investigation Baseline Diff";
    case "summary-html":
      return "Save Diff Findings Summary HTML";
    case "handoff-html":
      return "Save Investigation Handoff HTML";
    case "summary-pdf":
      return "Save Diff Findings Summary PDF";
    case "handoff-pdf":
      return "Save Investigation Handoff PDF";
    case "understanding-md":
      return "Save Understanding Report";
    case "html":
    default:
      return `Save ${exportTitle} HTML`;
  }
}

async function buildComparisonExportContent(ctx: CommandContext, model: ComparisonViewModel, kind: ComparisonExportKind): Promise<Buffer | string> {
  if (kind === "json") {
    return `${JSON.stringify(model, null, 2)}\n`;
  }

  if (kind === "md") {
    return renderComparisonMarkdown(model);
  }

  if (kind === "understanding-md") {
    const understanding = buildComparisonUnderstandingDocument(model, {
      auditEvidenceResults: [...comparisonAuditEvidenceByEvidenceId.values()],
      reconstructionArtifacts: comparisonReconstructionArtifacts
    });
    return renderUnderstandingDocumentMarkdown(understanding);
  }

  if (kind === "summary-html" || kind === "handoff-html") {
    const logoDataUri = await readWatermarkLogoDataUri(ctx);
    const report = buildComparisonReportModel(kind === "summary-html" ? "DiffFindingsSummary" : "InvestigationHandoff", model, {
      watermarkLogoDataUri: logoDataUri,
      auditEvidenceResults: [...comparisonAuditEvidenceByEvidenceId.values()],
      reconstructionArtifacts: comparisonReconstructionArtifacts
    });
    return renderComparisonReportHtml(report);
  }

  if (kind === "summary-pdf" || kind === "handoff-pdf") {
    const logoDataUri = await readWatermarkLogoDataUri(ctx);
    const report = buildComparisonReportModel(kind === "summary-pdf" ? "DiffFindingsSummary" : "InvestigationHandoff", model, {
      watermarkLogoDataUri: logoDataUri,
      auditEvidenceResults: [...comparisonAuditEvidenceByEvidenceId.values()],
      reconstructionArtifacts: comparisonReconstructionArtifacts
    });
    return renderComparisonReportPdf(report);
  }

  return renderStandaloneComparisonSurfaceHtml(model);
}

function getSavedExportLabel(model: ComparisonViewModel, kind: ComparisonExportKind): string {
  if (kind === "baseline") {
    return "Pre-investigation Baseline Diff HTML";
  }

  if (kind === "summary-html") {
    return "Diff Findings Summary HTML";
  }

  if (kind === "handoff-html") {
    return "Investigation Handoff HTML";
  }

  if (kind === "summary-pdf") {
    return "Diff Findings Summary PDF";
  }

  if (kind === "handoff-pdf") {
    return "Investigation Handoff PDF";
  }

  if (kind === "understanding-md") {
    return "Cross Diff Understanding Markdown";
  }

  return `${model.title.startsWith("Timeline Diff") ? "Timeline Diff" : "Cross-Environment Diff"} ${kind.toUpperCase()}`;
}

async function openUnderstandingMarkdownPreview(uri: vscode.Uri): Promise<void> {
  await vscode.commands.executeCommand("markdown.showPreview", uri);
}

function getWorkspaceRelativePath(workspace: Awaited<ReturnType<typeof ensureSnapshotWorkspace>>, uri: vscode.Uri): string {
  if (workspace.available && workspace.workspaceRoot) {
    const rootPath = workspace.workspaceRoot.fsPath.replace(/\\/g, "/");
    const filePath = uri.fsPath.replace(/\\/g, "/");
    if (filePath.toLowerCase().startsWith(rootPath.toLowerCase())) {
      return filePath.slice(rootPath.length).replace(/^\//, "");
    }
  }

  return uri.fsPath;
}

async function saveComparisonExport(ctx: CommandContext, model: ComparisonViewModel, kind: ComparisonExportKind): Promise<vscode.Uri | undefined> {
  if (!canSaveStandardComparisonExport(model) && !isReportExportKind(kind)) {
    await promptForCrossEnvironmentDiffProAccess("Comparison export");
    return undefined;
  }

  const workspace = await ensureSnapshotWorkspace();
  const workspaceTargetRoot = isReportExportKind(kind) ? workspace.reportsRoot : workspace.comparisonsRoot;
  let uri = workspace.available && workspaceTargetRoot ? buildDefaultExportUri(model, kind) : undefined;

  if (!uri) {
    uri = await vscode.window.showSaveDialog({
      defaultUri: buildDefaultExportUri(model, kind),
      filters: getExportFilter(kind),
      saveLabel: getExportSaveLabel(kind),
      title: getExportDialogTitle(model, kind)
    });
  }

  if (!uri) {
    return undefined;
  }

  const content = await buildComparisonExportContent(ctx, model, kind);

  await vscode.workspace.fs.writeFile(uri, typeof content === "string" ? Buffer.from(content, "utf8") : content);
  const destination = workspace.available && workspaceTargetRoot ? getWorkspaceRelativePath(workspace, uri) : uri.fsPath;

  if (kind === "understanding-md") {
    await openUnderstandingMarkdownPreview(uri);
    void vscode.window.showInformationMessage(`DV Quick Run: Understanding Report generated and opened. Saved to ${destination}.`);
  } else {
    void vscode.window.showInformationMessage(`DV Quick Run: Saved ${getSavedExportLabel(model, kind)} to ${destination}.`);
  }

  return uri;
}

export function revealComparisonSurface(ctx: CommandContext, model: ComparisonViewModel): void {
  const investigationSessionKey = buildInvestigationSessionKey(model);
  const persistedInvestigationState = readInvestigationSessionState(ctx.ext, investigationSessionKey);
  if (comparisonPanel) {
    comparisonPanel.reveal(vscode.ViewColumn.One);
  } else {
    comparisonPanel = vscode.window.createWebviewPanel(
      "dvQuickRunCrossEnvironmentDiff",
      model.title.startsWith("Timeline Diff") ? "DV Quick Run: Timeline Diff" : "DV Quick Run: Cross-Environment Diff",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    comparisonPanel.onDidDispose(() => {
      comparisonPanelMessageDisposable?.dispose();
      comparisonPanelMessageDisposable = undefined;
      comparisonPanel = undefined;
      comparisonAuditEvidenceByEvidenceId = new Map();
      comparisonReconstructionArtifacts = [];
    }, null, ctx.ext.subscriptions);
  }

  comparisonPanelMessageDisposable?.dispose();
  comparisonPanelMessageDisposable = comparisonPanel.webview.onDidReceiveMessage((message: unknown) => {
    const request = message as { readonly type?: string; readonly kind?: string; readonly state?: InvestigationSessionState; readonly evidenceId?: string; readonly label?: string; readonly value?: string; readonly evidenceKind?: string; readonly parentTitle?: string; readonly parentSummary?: string; readonly parentKind?: string; readonly parentProvider?: string; readonly parentEvidence?: string; readonly entityLogicalName?: string; readonly fromCapturedAtIso?: string; readonly toCapturedAtIso?: string; readonly stage?: string; readonly details?: Record<string, unknown>; readonly exportId?: string; readonly candidateJson?: string };
    if (request.type === "resetInvestigationState") {
      void clearInvestigationSessionState(ctx.ext, investigationSessionKey);
      return;
    }

    if (request.type === "investigationStateChanged" && request.state) {
      void writeInvestigationSessionState(ctx.ext, investigationSessionKey, request.state);
      return;
    }
    if (request.type === "evidencePivotTrace") {
      return;
    }

    if (request.type === "evidencePivotRequested") {
      appendEvidencePivotDiagnostic(ctx, "request.received", {
        evidenceId: request.evidenceId,
        evidenceKind: request.evidenceKind,
        label: request.label,
        value: request.value,
        parentTitle: request.parentTitle,
        parentKind: request.parentKind,
        parentProvider: request.parentProvider,
        entityLogicalName: request.entityLogicalName
      });

      void buildEvidencePivotResult(ctx, request.evidenceKind, request.label, request.value, request.parentTitle, request.parentSummary, request.parentKind, request.parentProvider, request.parentEvidence, request.entityLogicalName, {
          append: (stage, details) => appendEvidencePivotDiagnostic(ctx, stage, details)
        })
        .then((result) => {
          appendEvidencePivotDiagnostic(ctx, "request.completed", {
            evidenceId: request.evidenceId,
            status: result.status,
            summary: result.summary
          });
          void comparisonPanel?.webview.postMessage({
            type: "evidencePivotResult",
            evidenceId: request.evidenceId,
            status: result.status,
            summary: result.summary
          });
        })
        .catch((error: unknown) => {
          const summary = `Live evidence pivot could not complete: ${error instanceof Error ? error.message : String(error)}`;
          appendEvidencePivotDiagnostic(ctx, "request.failed", {
            evidenceId: request.evidenceId,
            error: summary
          });
          void comparisonPanel?.webview.postMessage({
            type: "evidencePivotResult",
            evidenceId: request.evidenceId,
            status: "error",
            summary
          });
        });
      return;
    }

    if (request.type === "auditEvidenceRequested") {
      void queryAuditEvidence(ctx, {
        findingId: request.evidenceId ?? "comparison-finding",
        findingTitle: request.parentTitle ?? "Comparison finding",
        findingSummary: request.parentSummary,
        providerTitle: request.parentProvider,
        entityLogicalName: request.entityLogicalName || model.summary.entityLogicalName,
        evidenceLabel: request.label,
        evidenceValue: request.value,
        parentEvidence: request.parentEvidence,
        interval: {
          fromCapturedAtIso: request.fromCapturedAtIso || model.session?.sourceSnapshot.capturedAtIso || model.summary.sourceCapturedAtIso,
          toCapturedAtIso: request.toCapturedAtIso || model.session?.targetSnapshot.capturedAtIso || model.summary.targetCapturedAtIso
        }
      })
        .then((result) => {
          comparisonAuditEvidenceByEvidenceId.set(request.evidenceId ?? "comparison-finding", result);
          void comparisonPanel?.webview.postMessage({
            type: "auditEvidenceResult",
            evidenceId: request.evidenceId,
            status: result.status,
            html: renderAuditEvidenceResultHtml(result)
          });
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          void comparisonPanel?.webview.postMessage({
            type: "auditEvidenceResult",
            evidenceId: request.evidenceId,
            status: "Error",
            html: `<div class="dvqr-audit-result dvqr-audit-result-error"><strong>Audit evidence unavailable</strong><p>${message}</p><p class="dvqr-audit-boundary">Captured diff evidence remains available. Audit evidence enriches findings only when available.</p></div>`
          });
        });
      return;
    }



    if (request.type === "dvceExportRequested") {
      const exportId = request.exportId ?? "dvce-export";
      try {
        const candidate = JSON.parse(request.candidateJson ?? "{}") as DvceChoiceReconstructionCandidate;
        void exportDvceChoiceDefinitionArtifact({
          candidates: [candidate]
        })
          .then((result) => {
            void comparisonPanel?.webview.postMessage({
              type: "dvceExportResult",
              exportId,
              ok: result.ok,
              summary: result.ok && result.fileUri
                ? `DVCE artifact exported to ${result.fileUri.fsPath}.`
                : result.reason ?? "DVCE export did not complete."
            });
            if (result.ok && result.fileUri && result.artifact) {
              const artifactFileName = result.fileUri.path.split("/").pop() ?? result.fileUri.fsPath;
              comparisonReconstructionArtifacts = [
                ...comparisonReconstructionArtifacts,
                buildDvceReconstructionArtifactReference({ artifact: result.artifact, artifactFileName })
              ];
              void vscode.window.showInformationMessage(`DV Quick Run: Exported DVCE artifact to ${result.fileUri.fsPath}.`);
            }
          })
          .catch((error: unknown) => {
            const messageText = error instanceof Error ? error.message : String(error);
            void comparisonPanel?.webview.postMessage({
              type: "dvceExportResult",
              exportId,
              ok: false,
              summary: `DVCE export failed. ${messageText}`
            });
          });
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        void comparisonPanel?.webview.postMessage({
          type: "dvceExportResult",
          exportId,
          ok: false,
          summary: `DVCE export failed. ${messageText}`
        });
      }
      return;
    }

    if (request.type === "dvevmExportRequested") {
      const exportId = request.exportId ?? "dvevm-export";
      try {
        const candidate = JSON.parse(request.candidateJson ?? "{}") as DvevmRuntimeConfigurationCandidate;
        void exportDvevmEnvironmentVariableArtifact({
          scope: candidate.schemaName ?? model.summary.subjectLabel,
          candidates: [candidate]
        })
          .then((result) => {
            void comparisonPanel?.webview.postMessage({
              type: "dvevmExportResult",
              exportId,
              ok: result.ok,
              summary: result.ok && result.fileUri
                ? `DVEVM artifact exported to ${result.fileUri.fsPath}.`
                : result.reason ?? "DVEVM export did not complete."
            });
            if (result.ok && result.fileUri && result.artifact) {
              const artifactFileName = result.fileUri.path.split("/").pop() ?? result.fileUri.fsPath;
              comparisonReconstructionArtifacts = [
                ...comparisonReconstructionArtifacts,
                buildDvevmReconstructionArtifactReference({ artifact: result.artifact, artifactFileName })
              ];
              void vscode.window.showInformationMessage(`DV Quick Run: Exported DVEVM artifact to ${result.fileUri.fsPath}.`);
            }
          })
          .catch((error: unknown) => {
            const messageText = error instanceof Error ? error.message : String(error);
            void comparisonPanel?.webview.postMessage({
              type: "dvevmExportResult",
              exportId,
              ok: false,
              summary: `DVEVM export failed. ${messageText}`
            });
          });
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        void comparisonPanel?.webview.postMessage({
          type: "dvevmExportResult",
          exportId,
          ok: false,
          summary: `DVEVM export failed. ${messageText}`
        });
      }
      return;
    }

    if (request.type === "dvimExportRequested") {
      const exportId = request.exportId ?? "dvim-export";
      try {
        const candidate = JSON.parse(request.candidateJson ?? "{}") as DvimParticipationReconstructionCandidate;
        void exportDvimIdentityParticipationArtifact({
          subjectLabel: candidate.displayName ?? candidate.identifier ?? model.summary.subjectLabel,
          candidates: [candidate]
        })
          .then((result) => {
            void comparisonPanel?.webview.postMessage({
              type: "dvimExportResult",
              exportId,
              ok: result.ok,
              summary: result.ok && result.fileUri
                ? `DVIM artifact exported to ${result.fileUri.fsPath}.`
                : result.reason ?? "DVIM export did not complete."
            });
            if (result.ok && result.fileUri && result.artifact) {
              const artifactFileName = result.fileUri.path.split("/").pop() ?? result.fileUri.fsPath;
              comparisonReconstructionArtifacts = [
                ...comparisonReconstructionArtifacts,
                buildDvimReconstructionArtifactReference({ artifact: result.artifact, artifactFileName })
              ];
              void vscode.window.showInformationMessage(`DV Quick Run: Exported DVIM artifact to ${result.fileUri.fsPath}.`);
            }
          })
          .catch((error: unknown) => {
            const messageText = error instanceof Error ? error.message : String(error);
            void comparisonPanel?.webview.postMessage({
              type: "dvimExportResult",
              exportId,
              ok: false,
              summary: `DVIM export failed. ${messageText}`
            });
          });
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        void comparisonPanel?.webview.postMessage({
          type: "dvimExportResult",
          exportId,
          ok: false,
          summary: `DVIM export failed. ${messageText}`
        });
      }
      return;
    }

    if (request.type === "dvafExportRequested") {
      const exportId = request.exportId ?? "dvaf-export";
      try {
        const candidate = JSON.parse(request.candidateJson ?? "{}") as AttributeReconstructionCandidate;
        const entityLogicalName = candidate.entityLogicalName || model.summary.entityLogicalName;
        if (!entityLogicalName) {
          throw new Error("DVAF export needs an entity logical name from the source-side attribute finding.");
        }

        void exportDvafAttributeArtifact({
          entityLogicalName,
          candidates: [candidate]
        })
          .then((result) => {
            void comparisonPanel?.webview.postMessage({
              type: "dvafExportResult",
              exportId,
              ok: result.ok,
              summary: result.ok && result.fileUri
                ? `DVAF artifact exported to ${result.fileUri.fsPath}.`
                : result.reason ?? "DVAF export did not complete."
            });
            if (result.ok && result.fileUri && result.artifact) {
              const artifactFileName = result.fileUri.path.split("/").pop() ?? result.fileUri.fsPath;
              comparisonReconstructionArtifacts = [
                ...comparisonReconstructionArtifacts,
                buildDvafReconstructionArtifactReference({ artifact: result.artifact, artifactFileName })
              ];
              void vscode.window.showInformationMessage(`DV Quick Run: Exported DVAF artifact to ${result.fileUri.fsPath}.`);
            }
          })
          .catch((error: unknown) => {
            const messageText = error instanceof Error ? error.message : String(error);
            void comparisonPanel?.webview.postMessage({
              type: "dvafExportResult",
              exportId,
              ok: false,
              summary: `DVAF export failed. ${messageText}`
            });
          });
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        void comparisonPanel?.webview.postMessage({
          type: "dvafExportResult",
          exportId,
          ok: false,
          summary: `DVAF export failed. ${messageText}`
        });
      }
      return;
    }

    if (request.type !== "saveComparison") {
      return;
    }

    if (request.kind === "json" || request.kind === "md" || request.kind === "html" || request.kind === "baseline" || request.kind === "summary-html" || request.kind === "handoff-html" || request.kind === "summary-pdf" || request.kind === "handoff-pdf" || request.kind === "understanding-md") {
      if (!isReportExportKind(request.kind) && !canSaveStandardComparisonExport(model)) {
        void promptForCrossEnvironmentDiffProAccess(getExportSaveLabel(request.kind));
        return;
      }

      void saveComparisonExport(ctx, model, request.kind).then((savedUri) => {
        if (request.kind === "baseline" && savedUri) {
          const exportedAt = new Date().toLocaleString();
          void writeInvestigationSessionState(ctx.ext, investigationSessionKey, {
            ...readInvestigationSessionState(ctx.ext, investigationSessionKey),
            baselineExportedAt: exportedAt
          });
          void comparisonPanel?.webview.postMessage({
            type: "baselineExported",
            exportedAt
          });
        }
      }).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        ctx.output.appendLine(`[DV Quick Run] Comparison export failed: ${message}`);
        void vscode.window.showErrorMessage(`DV Quick Run: Comparison export failed. ${message}`);
      });
    }
  }, null, ctx.ext.subscriptions);

  comparisonAuditEvidenceByEvidenceId = new Map();
  comparisonReconstructionArtifacts = [];
  comparisonPanel.title = model.title.startsWith("Timeline Diff") ? "DV Quick Run: Timeline Diff" : "DV Quick Run: Cross-Environment Diff";
  comparisonPanel.webview.html = renderComparisonSurfaceHtml(comparisonPanel.webview, model, { canExport: canSaveStandardComparisonExport(model), isProPreview: !canRunCrossEnvironmentDiff(), investigationState: persistedInvestigationState });
}
