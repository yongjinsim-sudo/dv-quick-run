import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { logDebug, logInfo } from "../../../../utils/logger.js";
import { resolveEditorQueryText } from "../../../../shared/editorIntelligence/queryCursorResolver.js";
import { detectQueryKind } from "../../../../shared/editorIntelligence/queryDetection.js";
import { runFetchXmlExplainPipeline } from "../shared/fetchXmlExplain/fetchXmlExplainPipeline.js";
import { parseDataverseQuery } from "./explainQueryParser.js";
import { toExplainMarkdown } from "./explainQueryMarkdown.js";
import { openMarkdownPreview } from "./explainQueryRuntime.js";
import { analyseExplainQuery } from "./explainQueryAnalysis.js";
import type { ParsedDataverseQuery } from "./explainQueryTypes.js";

type ExplainAnalysis = Awaited<ReturnType<typeof analyseExplainQuery>>;

type ExplainWorkflowDeps = {
  resolveText: () => string | undefined;
  detectKind: (text: string) => "odata" | "fetchxml" | "unknown";
  parseQuery: (text: string) => ParsedDataverseQuery;
  analyse: (ctx: CommandContext, parsed: ParsedDataverseQuery) => Promise<ExplainAnalysis>;
  buildMarkdown: (
    parsed: ParsedDataverseQuery,
    entity: ExplainAnalysis["entity"],
    validationIssues: ExplainAnalysis["validationIssues"],
    relationshipReasoningNotes?: ExplainAnalysis["relationshipReasoningNotes"]
  ) => string;
  buildFetchXmlMarkdown: (ctx: CommandContext, text: string) => Promise<string>;
  openPreview: (markdown: string) => Promise<void>;
  logDebugMessage: (output: CommandContext["output"], message: string) => void;
  logInfoMessage: (output: CommandContext["output"], message: string) => void;
  showInformationMessage: (message: string) => Thenable<string | undefined>;
};

const defaultDeps: ExplainWorkflowDeps = {
  resolveText: resolveEditorQueryText,
  detectKind: detectQueryKind,
  parseQuery: parseDataverseQuery,
  analyse: analyseExplainQuery,
  buildMarkdown: toExplainMarkdown,
  buildFetchXmlMarkdown: runFetchXmlExplainPipeline,
  openPreview: openMarkdownPreview,
  logDebugMessage: logDebug,
  logInfoMessage: logInfo,
  showInformationMessage: vscode.window.showInformationMessage
};

export async function runExplainQueryWorkflowWithDeps(ctx: CommandContext, deps: ExplainWorkflowDeps): Promise<void> {
  const text = deps.resolveText();
  if (!text) {
    throw new Error("No Dataverse query found on the current line or selection.");
  }

  const kind = deps.detectKind(text);

  if (kind === "fetchxml") {
    deps.logDebugMessage(ctx.output, `Explain Query: kind=fetchxml sourceLength=${text.length}`);
    const markdown = await deps.buildFetchXmlMarkdown(ctx, text);
    await deps.openPreview(markdown);
    deps.logInfoMessage(ctx.output, "Explain Query success for FetchXML query.");
    await deps.showInformationMessage("DV Quick Run: Query explained.");
    return;
  }

  const parsed = deps.parseQuery(text);
  if (!parsed.entitySetName) {
    throw new Error(`Could not detect entity set from: ${text}`);
  }

  deps.logDebugMessage(ctx.output, `Explain Query: entitySet=${parsed.entitySetName} sourceLength=${text.length}`);

  const analysis = await deps.analyse(ctx, parsed);
  const markdown = deps.buildMarkdown(
    parsed,
    analysis.entity,
    analysis.validationIssues,
    analysis.relationshipReasoningNotes ?? []
  );

  await deps.openPreview(markdown);

  deps.logInfoMessage(ctx.output, `Explain Query success for entity set: ${parsed.entitySetName}`);
  await deps.showInformationMessage("DV Quick Run: Query explained.");
}

export async function runExplainQueryWorkflow(ctx: CommandContext): Promise<void> {
  await runExplainQueryWorkflowWithDeps(ctx, defaultDeps);
}
