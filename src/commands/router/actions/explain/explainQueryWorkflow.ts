import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { logDebug, logInfo } from "../../../../utils/logger.js";
import type { FieldDef } from "../../../../services/entityFieldMetadataService.js";
import type { ChoiceMetadataDef } from "../../../../services/entityChoiceMetadataService.js";
import { resolveEditorQueryText } from "../../../../shared/editorIntelligence/queryCursorResolver.js";
import { detectQueryKind } from "../../../../shared/editorIntelligence/queryDetection.js";
import { runFetchXmlExplainPipeline } from "../shared/fetchXmlExplain/fetchXmlExplainPipeline.js";
import { runDiagnostics } from "../shared/diagnostics/diagnosticRuleEngine.js";
import { getQueryDoctorCapabilities } from "../../../../product/capabilities/capabilityResolver.js";
import { loadChoiceMetadata, loadFields } from "../shared/metadataAccess.js";
import { parseDataverseQuery } from "./explainQueryParser.js";
import { toExplainMarkdown } from "./explainQueryMarkdown.js";
import { openMarkdownPreview } from "./explainQueryRuntime.js";
import { setExplainDocumentState } from "./explainDocState.js";
import { getLogicalEditorQueryTarget } from "../shared/queryMutation/editorQueryTarget.js";
import { analyseExplainQuery } from "./explainQueryAnalysis.js";
import type { ParsedDataverseQuery } from "./explainQueryTypes.js";
import { hasExpandClause } from "../shared/diagnostics/expandDetection.js";
import { buildExpandNotFullySupportedDiagnostic } from "../shared/diagnostics/diagnosticSuggestionBuilder.js";
import { getExecutionEvidenceForQuery } from "../shared/diagnostics/executionEvidence.js";
import type { EditorQueryTarget } from "../shared/queryMutation/editorQueryTarget.js";

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
    diagnostics: Awaited<ReturnType<typeof runDiagnostics>>,
    executionEvidence?: import("../shared/diagnostics/executionEvidence.js").ExecutionEvidence,
    choiceMetadata?: ChoiceMetadataDef[]
  ) => string;
  getQueryDoctorCapabilities: () => import("../../../../product/capabilities/capabilityTypes.js").QueryDoctorCapabilityProfile;
  loadFieldsForEntity: (ctx: CommandContext, logicalName: string) => Promise<FieldDef[]>;
  loadChoiceMetadataForEntity: (ctx: CommandContext, logicalName: string) => Promise<ChoiceMetadataDef[]>;
  buildFetchXmlMarkdown: (ctx: CommandContext, text: string) => Promise<string>;
  openPreview: (markdown: string) => Promise<vscode.TextDocument>;
  logDebugMessage: (output: CommandContext["output"], message: string) => void;
  logInfoMessage: (output: CommandContext["output"], message: string) => void;
  showInformationMessage: (message: string) => Thenable<string | undefined>;
  resolveSourceTarget: () => EditorQueryTarget;
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
  loadChoiceMetadataForEntity: async (ctx: CommandContext, logicalName: string) => {
    const client = ctx.getClient();
    const token = await ctx.getToken(ctx.getScope());
    return await loadChoiceMetadata(ctx, client, token, logicalName, { silent: true });
  },
  openPreview: openMarkdownPreview,
  resolveSourceTarget: getLogicalEditorQueryTarget,
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
  const executionEvidence = getExecutionEvidenceForQuery(parsed.normalized);
  const diagnostics = await runDiagnostics(
    {
      parsed,
      validationIssues: analysis.validationIssues,
      entityLogicalName: analysis.entity?.logicalName,
      loadFieldsForEntity: async (logicalName: string) => await deps.loadFieldsForEntity(ctx, logicalName),
      executionEvidence
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
  const choiceMetadata = analysis.entity?.logicalName
    ? await deps.loadChoiceMetadataForEntity(ctx, analysis.entity.logicalName)
    : [];

  const markdown = deps.buildMarkdown(
    parsed,
    analysis.entity,
    analysis.validationIssues,
    analysis.relationshipReasoningNotes ?? [],
    diagnostics,
    executionEvidence,
    choiceMetadata
  );

  const sourceTarget = deps.resolveSourceTarget();
  const explainDoc = await deps.openPreview(markdown);
  setExplainDocumentState(explainDoc.uri, {
    source: { uri: sourceTarget.editor.document.uri, range: sourceTarget.range },
    diagnostics
  });

  deps.logInfoMessage(ctx.output, `Explain Query success for entity set: ${parsed.entitySetName}`);
  await deps.showInformationMessage("DV Quick Run: Query explained.");
}

export async function runExplainQueryWorkflow(ctx: CommandContext): Promise<void> {
  await runExplainQueryWorkflowWithDeps(ctx, defaultDeps);
}
