import * as vscode from "vscode";
import type { TimelineReconstruction } from "../../pro/timeline/index.js";
import {
  buildTimelineFindingsSummaryReport,
  buildTimelineInvestigationHandoffReport,
  renderTimelineFindingsSummaryReportHtml,
  renderTimelineInvestigationHandoffReportHtml,
  renderTimelineReportPdf,
  buildTimelineUnderstandingDocument,
} from "../../pro/timeline/index.js";
import { renderTimelineSurfaceHtml } from "../../webview/timelineSurface/index.js";
import { renderUnderstandingDocumentMarkdown } from "../../product/understanding/understandingMarkdownRenderer.js";
import { queryAuditEvidence, renderAuditEvidenceResultHtml } from "../../product/audit/index.js";
import type { AuditEvidenceResult } from "../../product/audit/auditEvidenceTypes.js";
import type { CommandContext } from "../context/commandContext.js";
import { ensureSnapshotWorkspace } from "../../product/comparison/snapshotWorkspaceService.js";
import { exportDvafAttributeArtifact } from "../../pro/reconstruction/dvafExportService.js";
import { exportDvimIdentityParticipationArtifact } from "../../pro/reconstruction/dvimExportService.js";
import { exportDvceChoiceDefinitionArtifact } from "../../pro/reconstruction/dvceExportService.js";
import type { AttributeReconstructionCandidate } from "../../pro/reconstruction/attributeReconstructionCandidate.js";
import type { DvimParticipationReconstructionCandidate } from "../../pro/reconstruction/dvimArtifactTypes.js";
import type { DvceChoiceReconstructionCandidate } from "../../pro/reconstruction/dvceArtifactTypes.js";
import { buildDvafReconstructionArtifactReference, buildDvimReconstructionArtifactReference, buildDvceReconstructionArtifactReference } from "../../pro/reconstruction/reconstructionArtifactReference.js";
import type { ReconstructionArtifactReference } from "../../pro/reconstruction/reconstructionArtifactReference.js";

let timelinePanel: vscode.WebviewPanel | undefined;
let timelinePanelMessageDisposable: vscode.Disposable | undefined;
let timelineAuditEvidenceByEventId = new Map<string, AuditEvidenceResult>();
let timelineReconstructionArtifacts: ReconstructionArtifactReference[] = [];

type TimelineExportKind = "findings-summary-html" | "findings-summary-pdf" | "investigation-handoff-html" | "investigation-handoff-pdf" | "understanding-md";

function isTimelineExportKind(kind: string | undefined): kind is TimelineExportKind {
  return kind === "findings-summary-html"
    || kind === "findings-summary-pdf"
    || kind === "investigation-handoff-html"
    || kind === "investigation-handoff-pdf"
    || kind === "understanding-md";
}

function getTimelineReportFilter(kind: TimelineExportKind): Record<string, string[]> {
  if (kind === "understanding-md") {
    return { "Markdown": ["md"] };
  }
  return kind.endsWith("pdf") ? { "PDF": ["pdf"] } : { "HTML": ["html"] };
}

function getTimelineReportTitle(kind: TimelineExportKind): string {
  switch (kind) {
    case "findings-summary-html":
      return "Save Timeline Findings Summary HTML";
    case "findings-summary-pdf":
      return "Save Timeline Findings Summary PDF";
    case "investigation-handoff-html":
      return "Save Timeline Investigation Handoff HTML";
    case "investigation-handoff-pdf":
      return "Save Timeline Investigation Handoff PDF";
    case "understanding-md":
      return "Generate Timeline Understanding Markdown";
  }
}

function getTimelineReportSavedLabel(kind: TimelineExportKind): string {
  switch (kind) {
    case "findings-summary-html":
      return "Timeline Findings Summary HTML";
    case "findings-summary-pdf":
      return "Timeline Findings Summary PDF";
    case "investigation-handoff-html":
      return "Timeline Investigation Handoff HTML";
    case "investigation-handoff-pdf":
      return "Timeline Investigation Handoff PDF";
    case "understanding-md":
      return "Timeline Understanding Markdown";
  }
}

function normalizeReportSegment(value: string | undefined, fallback: string): string {
  const raw = (value || fallback).trim().toLowerCase();
  const withoutPublisherPrefix = raw.replace(/^[a-z][a-z0-9]*_/, "");
  const normalized = withoutPublisherPrefix.replace(/[^a-z0-9]+/g, "");
  return normalized || fallback;
}

async function buildTimelineReportDefaultUri(timeline: TimelineReconstruction, kind: TimelineExportKind): Promise<vscode.Uri> {
  const subject = normalizeReportSegment(timeline.subject.subjectLabel ?? timeline.subject.entityLogicalName, "timeline");
  const environment = normalizeReportSegment(timeline.subject.environmentLabel, "environment");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "").replace(/T/, "-").slice(0, 15);
  const reportKind = kind === "understanding-md" ? "timeline-understanding-report" : kind.startsWith("findings") ? "timeline-findings-summary" : "timeline-investigation-handoff";
  const extension = kind === "understanding-md" ? "md" : kind.endsWith("pdf") ? "pdf" : "html";
  const fileName = `${timestamp}-${subject}-${environment}-${reportKind}.${extension}`;
  const workspace = await ensureSnapshotWorkspace();
  if (workspace.available && workspace.reportsRoot) {
    return vscode.Uri.joinPath(workspace.reportsRoot, fileName);
  }
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
  return workspaceFolder ? vscode.Uri.joinPath(workspaceFolder, ".dvqr", "reports", fileName) : vscode.Uri.file(fileName);
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

async function buildTimelineReportContent(ctx: CommandContext, timeline: TimelineReconstruction, kind: TimelineExportKind): Promise<string | Buffer> {
  const watermarkLogoDataUri = await readWatermarkLogoDataUri(ctx);
  const options = { watermarkLogoDataUri, auditEvidenceByEventId: timelineAuditEvidenceByEventId, reconstructionArtifacts: timelineReconstructionArtifacts };
  if (kind === "understanding-md") {
    return renderUnderstandingDocumentMarkdown(buildTimelineUnderstandingDocument(timeline, {
      auditEvidenceResults: [...timelineAuditEvidenceByEventId.values()],
      reconstructionArtifacts: timelineReconstructionArtifacts
    }));
  }
  if (kind === "findings-summary-html") {
    return renderTimelineFindingsSummaryReportHtml(buildTimelineFindingsSummaryReport(timeline, options));
  }
  if (kind === "investigation-handoff-html") {
    return renderTimelineInvestigationHandoffReportHtml(buildTimelineInvestigationHandoffReport(timeline, options));
  }
  if (kind === "findings-summary-pdf") {
    return renderTimelineReportPdf(buildTimelineFindingsSummaryReport(timeline, options));
  }
  return renderTimelineReportPdf(buildTimelineInvestigationHandoffReport(timeline, options));
}

async function saveTimelineReport(ctx: CommandContext, timeline: TimelineReconstruction, kind: TimelineExportKind): Promise<void> {
  const workspace = await ensureSnapshotWorkspace();
  let uri = workspace.available && workspace.reportsRoot
    ? await buildTimelineReportDefaultUri(timeline, kind)
    : undefined;

  if (!uri) {
    uri = await vscode.window.showSaveDialog({
      defaultUri: await buildTimelineReportDefaultUri(timeline, kind),
      filters: getTimelineReportFilter(kind),
      saveLabel: getTimelineReportTitle(kind),
      title: getTimelineReportTitle(kind),
    });
  }

  if (!uri) {
    return;
  }

  const content = await buildTimelineReportContent(ctx, timeline, kind);
  await vscode.workspace.fs.writeFile(uri, typeof content === "string" ? Buffer.from(content, "utf8") : content);
  const destination = workspace.available && workspace.reportsRoot ? "Evidence Workspace" : uri.fsPath;
  if (kind === "understanding-md") {
    await vscode.commands.executeCommand("markdown.showPreview", uri);
    void vscode.window.showInformationMessage(`DV Quick Run: Timeline Understanding Report generated and opened. Saved to ${destination}.`);
  } else {
    void vscode.window.showInformationMessage(`DV Quick Run: Saved ${getTimelineReportSavedLabel(kind)} to ${destination}.`);
  }
}

export function openTimelineSurface(ctx: CommandContext, timeline: TimelineReconstruction): void {
  const title = "DV Quick Run: Operational Timeline";

  if (timelinePanel) {
    timelinePanel.reveal(vscode.ViewColumn.Beside);
    timelineAuditEvidenceByEventId = new Map();
    timelineReconstructionArtifacts = [];
    timelinePanel.webview.html = renderTimelineSurfaceHtml(timelinePanel.webview, timeline);
    timelinePanel.title = title;
    registerTimelineMessageHandler(ctx, timeline);
    return;
  }

  timelinePanel = vscode.window.createWebviewPanel(
    "dvQuickRun.timelineReconstruction",
    title,
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  timelineAuditEvidenceByEventId = new Map();
  timelineReconstructionArtifacts = [];
  timelinePanel.webview.html = renderTimelineSurfaceHtml(timelinePanel.webview, timeline);
  registerTimelineMessageHandler(ctx, timeline);
  timelinePanel.onDidDispose(() => {
    timelinePanelMessageDisposable?.dispose();
    timelinePanelMessageDisposable = undefined;
    timelinePanel = undefined;
    timelineAuditEvidenceByEventId = new Map();
    timelineReconstructionArtifacts = [];
  });
}

function registerTimelineMessageHandler(ctx: CommandContext, timeline: TimelineReconstruction): void {
  timelinePanelMessageDisposable?.dispose();
  timelinePanelMessageDisposable = timelinePanel?.webview.onDidReceiveMessage((message: unknown) => {
    const request = message as { readonly type?: string; readonly kind?: string; readonly eventId?: string; readonly auditKey?: string; readonly title?: string; readonly summary?: string; readonly providerId?: string; readonly providerTitle?: string; readonly entityLogicalName?: string; readonly fromCapturedAtIso?: string; readonly toCapturedAtIso?: string; readonly exportId?: string; readonly candidateJson?: string };
    if (request.type === "timelineAuditEvidenceRequested") {
      void queryAuditEvidence(ctx, {
        findingId: request.eventId ?? "timeline-event",
        findingTitle: request.title ?? "Timeline event",
        findingSummary: request.summary,
        providerId: request.providerId,
        providerTitle: request.providerTitle,
        entityLogicalName: request.entityLogicalName || timeline.subject.entityLogicalName,
        interval: {
          fromCapturedAtIso: request.fromCapturedAtIso,
          toCapturedAtIso: request.toCapturedAtIso
        }
      })
        .then((result) => {
          timelineAuditEvidenceByEventId.set(request.eventId ?? request.auditKey ?? "timeline-event", result);
          void timelinePanel?.webview.postMessage({
            type: "timelineAuditEvidenceResult",
            eventId: request.eventId,
            auditKey: request.auditKey,
            status: result.status,
            html: renderAuditEvidenceResultHtml(result)
          });
        })
        .catch((error: unknown) => {
          const messageText = error instanceof Error ? error.message : String(error);
          void timelinePanel?.webview.postMessage({
            type: "timelineAuditEvidenceResult",
            eventId: request.eventId,
            auditKey: request.auditKey,
            status: "Error",
            html: `<div class="dvqr-audit-result dvqr-audit-result-error"><strong>Audit evidence unavailable</strong><p>${messageText}</p><p class="dvqr-audit-boundary">Captured timeline evidence remains available. Audit evidence enriches findings only when available.</p></div>`
          });
        });
      return;
    }

    if (request.type === "timelineDvafExportRequested") {
      const exportId = request.exportId ?? "timeline-dvaf-export";
      try {
        const parsedCandidate = JSON.parse(request.candidateJson ?? "{}") as AttributeReconstructionCandidate;
        const candidate: AttributeReconstructionCandidate = {
          ...parsedCandidate,
          source: "Timeline",
          findingId: request.eventId ?? parsedCandidate.findingId,
          sourceSnapshotId: parsedCandidate.sourceSnapshotId,
          targetSnapshotId: parsedCandidate.targetSnapshotId,
          notes: [
            ...(parsedCandidate.notes ?? []),
            "Timeline export uses the selected event interval's source-side definition. It does not export the latest snapshot or merged timeline state."
          ]
        };
        const entityLogicalName = candidate.entityLogicalName || timeline.subject.entityLogicalName;
        if (!entityLogicalName) {
          throw new Error("DVAF export needs an entity logical name from the timeline attribute finding.");
        }

        void exportDvafAttributeArtifact({
          entityLogicalName,
          candidates: [candidate]
        })
          .then((result) => {
            void timelinePanel?.webview.postMessage({
              type: "timelineDvafExportResult",
              exportId,
              ok: result.ok,
              summary: result.ok && result.fileUri
                ? `DVAF artifact exported to ${result.fileUri.fsPath}.`
                : result.reason ?? "DVAF export did not complete."
            });
            if (result.ok && result.fileUri && result.artifact) {
              const artifactFileName = result.fileUri.path.split("/").pop() ?? result.fileUri.fsPath;
              timelineReconstructionArtifacts = [
                ...timelineReconstructionArtifacts,
                buildDvafReconstructionArtifactReference({ artifact: result.artifact, artifactFileName })
              ];
              void vscode.window.showInformationMessage(`DV Quick Run: Exported DVAF artifact to ${result.fileUri.fsPath}.`);
            }
          })
          .catch((error: unknown) => {
            const messageText = error instanceof Error ? error.message : String(error);
            void timelinePanel?.webview.postMessage({
              type: "timelineDvafExportResult",
              exportId,
              ok: false,
              summary: `DVAF export failed. ${messageText}`
            });
          });
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        void timelinePanel?.webview.postMessage({
          type: "timelineDvafExportResult",
          exportId,
          ok: false,
          summary: `DVAF export failed. ${messageText}`
        });
      }
      return;
    }

    if (request.type === "timelineDvimExportRequested") {
      const exportId = request.exportId ?? "timeline-dvim-export";
      try {
        const parsedCandidate = JSON.parse(request.candidateJson ?? "{}") as DvimParticipationReconstructionCandidate;
        const candidate: DvimParticipationReconstructionCandidate = {
          ...parsedCandidate,
          source: "Timeline",
          findingId: request.eventId ?? parsedCandidate.findingId,
          notes: [
            ...(parsedCandidate.notes ?? []),
            "Timeline export uses the selected event interval's source-side participation intent. It does not export the latest snapshot or merged timeline state."
          ]
        };
        void exportDvimIdentityParticipationArtifact({
          subjectLabel: candidate.displayName ?? candidate.identifier ?? timeline.subject.subjectLabel,
          candidates: [candidate]
        })
          .then((result) => {
            void timelinePanel?.webview.postMessage({
              type: "timelineDvimExportResult",
              exportId,
              ok: result.ok,
              summary: result.ok && result.fileUri
                ? `DVIM artifact exported to ${result.fileUri.fsPath}.`
                : result.reason ?? "DVIM export did not complete."
            });
            if (result.ok && result.fileUri && result.artifact) {
              const artifactFileName = result.fileUri.path.split("/").pop() ?? result.fileUri.fsPath;
              timelineReconstructionArtifacts = [
                ...timelineReconstructionArtifacts,
                buildDvimReconstructionArtifactReference({ artifact: result.artifact, artifactFileName })
              ];
              void vscode.window.showInformationMessage(`DV Quick Run: Exported DVIM artifact to ${result.fileUri.fsPath}.`);
            }
          })
          .catch((error: unknown) => {
            const messageText = error instanceof Error ? error.message : String(error);
            void timelinePanel?.webview.postMessage({
              type: "timelineDvimExportResult",
              exportId,
              ok: false,
              summary: `DVIM export failed. ${messageText}`
            });
          });
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        void timelinePanel?.webview.postMessage({
          type: "timelineDvimExportResult",
          exportId,
          ok: false,
          summary: `DVIM export failed. ${messageText}`
        });
      }
      return;
    }



    if (request.type === "timelineDvceExportRequested") {
      const exportId = request.exportId ?? "timeline-dvce-export";
      try {
        const parsedCandidate = JSON.parse(request.candidateJson ?? "{}") as DvceChoiceReconstructionCandidate;
        const candidate: DvceChoiceReconstructionCandidate = {
          ...parsedCandidate,
          source: "Timeline",
          findingId: request.eventId ?? parsedCandidate.findingId,
          notes: [
            ...(parsedCandidate.notes ?? []),
            "Timeline export uses the selected event interval's source-side choice operation. It does not export the latest snapshot or merged timeline state."
          ]
        };
        void exportDvceChoiceDefinitionArtifact({ candidates: [candidate] })
          .then((result) => {
            void timelinePanel?.webview.postMessage({
              type: "timelineDvceExportResult",
              exportId,
              ok: result.ok,
              summary: result.ok && result.fileUri
                ? `DVCE artifact exported to ${result.fileUri.fsPath}.`
                : result.reason ?? "DVCE export did not complete."
            });
            if (result.ok && result.fileUri && result.artifact) {
              const artifactFileName = result.fileUri.path.split("/").pop() ?? result.fileUri.fsPath;
              timelineReconstructionArtifacts = [
                ...timelineReconstructionArtifacts,
                buildDvceReconstructionArtifactReference({ artifact: result.artifact, artifactFileName })
              ];
              void vscode.window.showInformationMessage(`DV Quick Run: Exported DVCE artifact to ${result.fileUri.fsPath}.`);
            }
          })
          .catch((error: unknown) => {
            const messageText = error instanceof Error ? error.message : String(error);
            void timelinePanel?.webview.postMessage({
              type: "timelineDvceExportResult",
              exportId,
              ok: false,
              summary: `DVCE export failed. ${messageText}`
            });
          });
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        void timelinePanel?.webview.postMessage({
          type: "timelineDvceExportResult",
          exportId,
          ok: false,
          summary: `DVCE export failed. ${messageText}`
        });
      }
      return;
    }

    if (request.type !== "saveTimelineReport" || !isTimelineExportKind(request.kind)) {
      return;
    }

    void saveTimelineReport(ctx, timeline, request.kind).catch((error: unknown) => {
      const messageText = error instanceof Error ? error.message : String(error);
      ctx.output.appendLine(`[DV Quick Run] Timeline report export failed: ${messageText}`);
      void vscode.window.showErrorMessage(`DV Quick Run: Timeline report export failed. ${messageText}`);
    });
  }, null, ctx.ext.subscriptions);
}
