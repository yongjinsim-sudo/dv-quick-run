import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { logDebug, logInfo } from "../../../../utils/logger.js";
import { resolveEditorQueryText } from "../../../../shared/editorIntelligence/queryCursorResolver.js";
import { parseDataverseQuery } from "./explainQueryParser.js";
import { toExplainMarkdown } from "./explainQueryMarkdown.js";
import { openMarkdownPreview } from "./explainQueryRuntime.js";
import { analyseExplainQuery } from "./explainQueryAnalysis.js";

export async function runExplainQueryWorkflow(ctx: CommandContext): Promise<void> {
  const text = resolveEditorQueryText();
  if (!text) {
    throw new Error("No Dataverse query found on the current line or selection.");
  }

  const parsed = parseDataverseQuery(text);
  if (!parsed.entitySetName) {
    throw new Error(`Could not detect entity set from: ${text}`);
  }

  logDebug(ctx.output, `Explain Query: entitySet=${parsed.entitySetName} sourceLength=${text.length}`);

  const analysis = await analyseExplainQuery(ctx, parsed);
  const markdown = toExplainMarkdown(parsed, analysis.entity, analysis.validationIssues);

  await openMarkdownPreview(markdown);

  logInfo(ctx.output, `Explain Query success for entity set: ${parsed.entitySetName}`);
  vscode.window.showInformationMessage("DV Quick Run: Query explained.");
}
