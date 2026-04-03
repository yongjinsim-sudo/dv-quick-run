import * as vscode from "vscode";
import { CommandContext } from "../../../../context/commandContext.js";
import { DataverseClient } from "../../../../../services/dataverseClient.js";
import { loadEntityDefs } from "../metadataAccess.js";
import { runQueryGuardrailRules } from "./queryGuardrailRunner.js";
import { ParsedDvQuery, QueryGuardrailResult } from "./queryGuardrailTypes.js";
import { logDebug, logError, logWarn } from "../../../../../utils/logger.js";
import { previewAndApplyAddTopInActiveEditor } from "../../../../../refinement/addTopPreview.js";
import { previewAndApplyAddSelectInActiveEditor } from "../../../../../refinement/addSelectPreview.js";

function splitQueryString(raw: string): { pathPart: string; queryPart: string } {
  const idx = raw.indexOf("?");

  if (idx < 0) {
    return {
      pathPart: raw,
      queryPart: ""
    };
  }

  return {
    pathPart: raw.slice(0, idx),
    queryPart: raw.slice(idx + 1)
  };
}

function parseDuplicateOptionCounts(queryPart: string): Map<string, number> {
  const counts = new Map<string, number>();

  if (!queryPart.trim()) {
    return counts;
  }

  const parts = queryPart
    .split("&")
    .map((x) => x.trim())
    .filter(Boolean);

  for (const part of parts) {
    const idx = part.indexOf("=");
    const rawKey = idx >= 0 ? part.slice(0, idx) : part;
    const key = rawKey.trim().toLowerCase();

    if (!key) {continue;}

    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

export function parseDvQueryForGuardrails(rawQuery: string): ParsedDvQuery {
  const raw = rawQuery.trim();
  const hadLeadingSlash = raw.startsWith("/");
  const normalizedQuery = raw.replace(/^\/+/, "");

  const { pathPart, queryPart } = splitQueryString(normalizedQuery);
  const entityPath = pathPart.trim();

  const entitySetMatch = /^([A-Za-z_][A-Za-z0-9_]*)(?:\(|\/|$)/.exec(entityPath);
  const entitySetName = entitySetMatch?.[1];

  const isSingleRecordPath = !!entitySetName && /^([A-Za-z_][A-Za-z0-9_]*)\([^)]*\)(?:\/.*)?$/.test(entityPath);
  const isCollectionQuery = !!entitySetName && !isSingleRecordPath;

  return {
    rawQuery: raw,
    normalizedQuery,
    hadLeadingSlash,
    entityPath,
    entitySetName,
    isSingleRecordPath,
    isCollectionQuery,
    queryOptions: new URLSearchParams(queryPart),
    duplicateOptionCounts: parseDuplicateOptionCounts(queryPart)
  };
}

function formatIssueLine(message: string, suggestion?: string): string {
  return suggestion ? `• ${message} ${suggestion}` : `• ${message}`;
}

function formatIssuesForDialog(result: QueryGuardrailResult): string {
  return result.issues
    .map((x) => formatIssueLine(x.message, x.suggestion))
    .join("\n");
}

function logGuardrailIssues(ctx: CommandContext, result: QueryGuardrailResult): void {
  if (!result.issues.length) {
    logDebug(ctx.output,"Guardrails: no issues detected.");
    return;
  }

  for (const issue of result.issues) {
    const suffix = issue.suggestion ? ` Suggestion: ${issue.suggestion}` : "";
    const line = `Guardrails [${issue.severity.toUpperCase()}]: ${issue.message}${suffix}`;

    if (issue.severity === "error") {
      logError(ctx.output, line);
    } else {
      logWarn(ctx.output, line);
    }
  }
}

export async function analyzeQueryGuardrails(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  rawQuery: string
): Promise<QueryGuardrailResult> {
  const parsed = parseDvQueryForGuardrails(rawQuery);

  let knownEntitySetNames: Set<string> | undefined;

  if (parsed.entitySetName) {
    try {
      const defs = await loadEntityDefs(ctx, client, token);
      knownEntitySetNames = new Set(defs.map((d) => d.entitySetName.trim().toLowerCase()));
    } catch (e: any) {
      logDebug(ctx.output,`Guardrails metadata lookup skipped: ${e?.message ?? String(e)}`);
    }
  }

  const result = runQueryGuardrailRules({
    parsed,
    knownEntitySetNames
  });

  logGuardrailIssues(ctx, result);
  return result;
}

export async function showGuardrailErrors(result: QueryGuardrailResult): Promise<void> {
  const errors = result.issues.filter((x) => x.severity === "error");
  if (!errors.length) {return;}

  const message = [
    "DV Quick Run blocked this query:",
    "",
    ...errors.map((x) => formatIssueLine(x.message, x.suggestion))
  ].join("\n");

  await vscode.window.showErrorMessage(message, { modal: true });
}

export async function confirmGuardrailsIfNeeded(
  result: QueryGuardrailResult,
  options?: {
    previewAddTop?: (value: number) => Promise<void>;
    previewAddSelect?: () => Promise<void>;
    previewAddFilter?: () => Promise<void>;
  }
): Promise<boolean> {
  if (result.hasErrors) {
    return false;
  }

  const warnings = result.issues.filter((x) => x.severity === "warning");
  if (!warnings.length) {
    return true;
  }

  const message = [
    "DV Quick Run noticed some query risks:",
    "",
    ...warnings.map((x) => formatIssueLine(x.message, x.suggestion)),
    "",
    "Run anyway?"
  ].join("\n");

  const hasMissingTopWarning = warnings.some((x) => x.code === "missing-top");
  const hasMissingSelectWarning = warnings.some((x) => x.code === "missing-select");
  const hasMissingFilterWarning = warnings.some((x) => x.code === "missing-filter");

  const previewTop10 = "Preview add $top=10";
  const previewTop50 = "Preview add $top=50";
  const previewSelect = "Preview add $select...";
  const previewFilter = "Preview add $filter...";
  const runAnyway = "Run Anyway";

  const actions: string[] = [];
  if (hasMissingTopWarning) {
    actions.push(previewTop10, previewTop50);
  }
  if (hasMissingSelectWarning) {
    actions.push(previewSelect);
  }
  if (hasMissingFilterWarning) {
    actions.push(previewFilter);
  }
  actions.push(runAnyway);

  const choice = await vscode.window.showWarningMessage(
    message,
    { modal: true },
    ...actions
  );

  if (choice === previewTop10) {
    await (options?.previewAddTop ?? previewAndApplyAddTopInActiveEditor)(10);
    return false;
  }

  if (choice === previewTop50) {
    await (options?.previewAddTop ?? previewAndApplyAddTopInActiveEditor)(50);
    return false;
  }

  if (choice === previewSelect) {
    if (options?.previewAddSelect) {
      await options.previewAddSelect();
    }
    return false;
  }

  if (choice === previewFilter) {
    if (options?.previewAddFilter) {
      await options.previewAddFilter();
    }
    return false;
  }

  return choice === runAnyway;
}