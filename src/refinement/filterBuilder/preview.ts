import * as vscode from "vscode";
import { applyEditorQueryUpdate } from "../../commands/router/actions/shared/queryMutation/applyEditorQueryUpdate.js";
import type { EditorQueryTarget } from "../../commands/router/actions/shared/queryMutation/editorQueryTarget.js";
import { buildEditorQuery, parseEditorQuery } from "../../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";
import { odataQuoteString } from "../../commands/router/actions/shared/queryMutation/odataValueUtils.js";
import type { BuildFilterInsight, FilterClauseModel } from "./models.js";

const QUERY_PREVIEW_URI = vscode.Uri.parse("untitled:dv-quick-run-query-preview.txt");

export interface BuildFilterPreviewResult {
  originalQuery: string;
  previewQuery: string;
  generatedClause: string;
  mergeStrategy: "replace" | "appendAnd";
}

export function buildFilterClauseFromModel(clause: FilterClauseModel): string {
  const left = clause.selectToken ?? clause.fieldLogicalName;
  const rawValue = String(clause.value ?? "").trim();

  switch (clause.operator) {
    case "contains":
    case "startswith":
    case "endswith":
      return `${clause.operator}(${left},${odataQuoteString(rawValue)})`;
    case "null":
      return `${left} eq null`;
    case "notNull":
      return `${left} ne null`;
    default: {
      const formattedValue = formatModelValue(clause);
      return `${left} ${clause.operator} ${formattedValue}`;
    }
  }
}

export function buildFilterPreviewFromInsight(
  queryText: string,
  insight: BuildFilterInsight
): BuildFilterPreviewResult {
  const parsed = parseEditorQuery(queryText);
  const expression = insight.expression;

  if (!expression.clauses.length) {
    throw new Error("At least one filter clause is required.");
  }

  const clauseText = expression.clauses.map(buildFilterClauseFromModel).join(` ${expression.combinator} `);
  const existingFilter = (parsed.queryOptions.get("$filter") ?? "").trim();

  const mergedFilter = (!existingFilter || insight.mergeStrategy === "replace")
    ? clauseText
    : `${wrapForAndOperand(existingFilter)} and ${wrapForAndOperand(clauseText)}`;

  parsed.queryOptions.delete("$filter");
  parsed.queryOptions.set("$filter", mergedFilter);

  return {
    originalQuery: queryText,
    generatedClause: clauseText,
    previewQuery: buildEditorQuery(parsed),
    mergeStrategy: insight.mergeStrategy
  };
}

export async function previewAndApplyFilterInsight(target: EditorQueryTarget, insight: BuildFilterInsight): Promise<void> {
  const preview = buildFilterPreviewFromInsight(target.text, insight);

  await openOrReuseQueryPreviewDocument(buildPreviewDocumentContent(preview));

  const choice = await vscode.window.showWarningMessage(
    "DV Quick Run: Preview is ready. Apply it to the detected query?",
    { modal: true },
    "Apply Preview"
  );

  if (choice !== "Apply Preview") {
    void vscode.window.showInformationMessage("DV Quick Run: Preview cancelled. The detected query was not changed.");
    return;
  }

  await applyEditorQueryUpdate(target, preview.previewQuery);
  await vscode.window.showTextDocument(target.editor.document, {
    viewColumn: target.editor.viewColumn,
    preserveFocus: false,
    preview: false
  });
  void vscode.window.showInformationMessage("DV Quick Run: Preview applied to query.");
}

function formatModelValue(clause: FilterClauseModel): string {
  const rawValue = String(clause.value ?? "").trim();

  if (clause.fieldType === "choice" || clause.fieldType === "numeric") {
    return rawValue;
  }

  if (clause.fieldType === "boolean") {
    const lowered = rawValue.toLowerCase();
    return lowered === "1" ? "true" : lowered === "0" ? "false" : lowered;
  }

  if (clause.fieldType === "datetime") {
    return rawValue;
  }

  return odataQuoteString(rawValue);
}

async function openOrReuseQueryPreviewDocument(content: string): Promise<vscode.TextEditor> {
  const document = await vscode.workspace.openTextDocument(QUERY_PREVIEW_URI);
  const editor = await vscode.window.showTextDocument(document, {
    preview: false,
    preserveFocus: false,
    viewColumn: vscode.ViewColumn.Beside
  });

  const fullText = document.getText();
  const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(fullText.length));

  await editor.edit((editBuilder) => {
    if (fullText.length === 0) {
      editBuilder.insert(new vscode.Position(0, 0), content);
    } else {
      editBuilder.replace(fullRange, content);
    }
  });

  return editor;
}

function buildPreviewDocumentContent(preview: BuildFilterPreviewResult): string {
  return [
    "DV Quick Run – Query Preview",
    "============================",
    "",
    "Preview Add Filter ($filter)",
    "",
    `Merge strategy: ${preview.mergeStrategy === "replace" ? "Replace existing filter" : "Append with AND"}`,
    "",
    "Original query:",
    preview.originalQuery,
    "",
    "Generated filter clause:",
    preview.generatedClause,
    "",
    "Preview query:",
    preview.previewQuery,
    "",
    "Use the confirmation dialog to apply this preview.",
    "Dismissing the dialog leaves the detected query unchanged."
  ].join("\n");
}


function wrapForAndOperand(value: string): string {
  const trimmed = value.trim();

  if (isWrappedBySingleBalancedParens(trimmed)) {
    return trimmed;
  }
  if (/\sand\s|\sor\s/i.test(trimmed)) {
    return `(${trimmed})`;
  }
  return trimmed;
}

function isWrappedBySingleBalancedParens(value: string): boolean {
  if (!value.startsWith("(") || !value.endsWith(")")) {
    return false;
  }

  let depth = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "(") {
      depth += 1;
    } else if (ch === ")") {
      depth -= 1;
      if (depth === 0 && i < value.length - 1) {
        return false;
      }
      if (depth < 0) {
        return false;
      }
    }
  }

  return depth === 0;
}
