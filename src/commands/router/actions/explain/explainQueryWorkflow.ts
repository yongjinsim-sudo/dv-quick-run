import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { logDebug, logInfo } from "../../../../utils/logger.js";
import type { FieldDef } from "../../../../services/entityFieldMetadataService.js";
import { resolveEditorQueryText } from "../../../../shared/editorIntelligence/queryCursorResolver.js";
import { detectQueryKind } from "../../../../shared/editorIntelligence/queryDetection.js";
import { runFetchXmlExplainPipeline } from "../shared/fetchXmlExplain/fetchXmlExplainPipeline.js";
import { runDiagnostics } from "../shared/diagnostics/diagnosticRuleEngine.js";
import { getQueryDoctorCapabilities } from "../../../../product/capabilities/capabilityResolver.js";
import { loadFields } from "../shared/metadataAccess.js";
import { parseDataverseQuery } from "./explainQueryParser.js";
import { toExplainMarkdown } from "./explainQueryMarkdown.js";
import { openMarkdownPreview } from "./explainQueryRuntime.js";
import { analyseExplainQuery } from "./explainQueryAnalysis.js";
import type { ParsedDataverseQuery } from "./explainQueryTypes.js";
import { hasExpandClause } from "../shared/diagnostics/expandDetection.js";
import { buildExpandNotFullySupportedDiagnostic } from "../shared/diagnostics/diagnosticSuggestionBuilder.js";

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
    relationshipReasoningNotes: ExplainAnalysis["relationshipReasoningNotes"] | undefined,
    diagnostics: Awaited<ReturnType<typeof runDiagnostics>>
  ) => string;
  getQueryDoctorCapabilities: () => import("../../../../product/capabilities/capabilityTypes.js").QueryDoctorCapabilityProfile;
  loadFieldsForEntity: (ctx: CommandContext, logicalName: string) => Promise<FieldDef[]>;
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
  getQueryDoctorCapabilities: () => getQueryDoctorCapabilities(),
  buildFetchXmlMarkdown: runFetchXmlExplainPipeline,
  loadFieldsForEntity: async (ctx: CommandContext, logicalName: string) => {
    const client = ctx.getClient();
    const token = await ctx.getToken(ctx.getScope());
    return await loadFields(ctx, client, token, logicalName);
  },
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
  const queryDoctorCapabilities = deps.getQueryDoctorCapabilities();
  deps.logInfoMessage(ctx.output, `Query Doctor: level=${queryDoctorCapabilities.insightLevel} entity=${analysis.entity?.logicalName ?? "unknown"}`);
  const diagnostics = await runDiagnostics(
    {
      parsed,
      validationIssues: analysis.validationIssues,
      entityLogicalName: analysis.entity?.logicalName,
      loadFieldsForEntity: async (logicalName: string) => await deps.loadFieldsForEntity(ctx, logicalName)
    },
    queryDoctorCapabilities
  );
  if (hasExpandClause(text)) {
    const alreadyExists = diagnostics.findings.some((f) =>
      f.message.includes('Expand support is currently partial')
    );

    if (!alreadyExists) {
      diagnostics.findings.unshift(buildExpandNotFullySupportedDiagnostic());
    }
  }
  const markdown = deps.buildMarkdown(
    parsed,
    analysis.entity,
    analysis.validationIssues,
    analysis.relationshipReasoningNotes ?? [],
    diagnostics
  );

  await deps.openPreview(markdown);

  deps.logInfoMessage(ctx.output, `Explain Query success for entity set: ${parsed.entitySetName}`);
  await deps.showInformationMessage("DV Quick Run: Query explained.");
}

export async function runExplainQueryWorkflow(ctx: CommandContext): Promise<void> {
  await runExplainQueryWorkflowWithDeps(ctx, defaultDeps);
}
