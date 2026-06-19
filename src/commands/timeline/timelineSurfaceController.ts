import * as vscode from "vscode";
import type { TimelineReconstruction } from "../../pro/timeline/index.js";
import {
  buildTimelineFindingsSummaryReport,
  buildTimelineInvestigationHandoffReport,
  renderTimelineFindingsSummaryReportHtml,
  renderTimelineInvestigationHandoffReportHtml,
  renderTimelineReportPdf,
} from "../../pro/timeline/index.js";
import { renderTimelineSurfaceHtml } from "../../webview/timelineSurface/index.js";
import type { CommandContext } from "../context/commandContext.js";

let timelinePanel: vscode.WebviewPanel | undefined;
let timelinePanelMessageDisposable: vscode.Disposable | undefined;

type TimelineExportKind = "findings-summary-html" | "findings-summary-pdf" | "investigation-handoff-html" | "investigation-handoff-pdf";

function isTimelineExportKind(kind: string | undefined): kind is TimelineExportKind {
  return kind === "findings-summary-html"
    || kind === "findings-summary-pdf"
    || kind === "investigation-handoff-html"
    || kind === "investigation-handoff-pdf";
}

function getTimelineReportFilter(kind: TimelineExportKind): Record<string, string[]> {
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
  }
}

function slug(value: string | undefined): string {
  return (value || "timeline")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "timeline";
}

function buildTimelineReportDefaultUri(timeline: TimelineReconstruction, kind: TimelineExportKind): vscode.Uri {
  const subject = slug(timeline.subject.entityLogicalName ?? timeline.subject.subjectLabel);
  const environment = slug(timeline.subject.environmentLabel);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "").replace(/T/, "-").slice(0, 15);
  const reportKind = kind.startsWith("findings") ? "timeline-findings-summary" : "timeline-investigation-handoff";
  const extension = kind.endsWith("pdf") ? "pdf" : "html";
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
  const fileName = `${timestamp}-${subject}-${environment}-${reportKind}.${extension}`;
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
  const options = { watermarkLogoDataUri };
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
  const uri = await vscode.window.showSaveDialog({
    defaultUri: buildTimelineReportDefaultUri(timeline, kind),
    filters: getTimelineReportFilter(kind),
    saveLabel: getTimelineReportTitle(kind),
    title: getTimelineReportTitle(kind),
  });

  if (!uri) {
    return;
  }

  const content = await buildTimelineReportContent(ctx, timeline, kind);
  await vscode.workspace.fs.writeFile(uri, typeof content === "string" ? Buffer.from(content, "utf8") : content);
  void vscode.window.showInformationMessage(`DV Quick Run: Saved ${getTimelineReportSavedLabel(kind)} to ${uri.fsPath}.`);
}

export function openTimelineSurface(ctx: CommandContext, timeline: TimelineReconstruction): void {
  const title = "DV Quick Run: Operational Timeline";

  if (timelinePanel) {
    timelinePanel.reveal(vscode.ViewColumn.Beside);
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

  timelinePanel.webview.html = renderTimelineSurfaceHtml(timelinePanel.webview, timeline);
  registerTimelineMessageHandler(ctx, timeline);
  timelinePanel.onDidDispose(() => {
    timelinePanelMessageDisposable?.dispose();
    timelinePanelMessageDisposable = undefined;
    timelinePanel = undefined;
  });
}

function registerTimelineMessageHandler(ctx: CommandContext, timeline: TimelineReconstruction): void {
  timelinePanelMessageDisposable?.dispose();
  timelinePanelMessageDisposable = timelinePanel?.webview.onDidReceiveMessage((message: unknown) => {
    const request = message as { readonly type?: string; readonly kind?: string };
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
