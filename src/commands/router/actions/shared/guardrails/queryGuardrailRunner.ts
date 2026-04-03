import { QueryGuardrailContext, QueryGuardrailIssue, QueryGuardrailResult } from "./queryGuardrailTypes.js";
import {
  QueryGuardrailRule,
  checkDuplicateSingleValueOptions,
  checkEmptyOptionValues,
  checkExpandWithoutInnerSelect,
  checkLargeTop,
  checkLeadingSlash,
  checkMissingEntity,
  checkMissingFilter,
  checkMissingSelect,
  checkMissingTop,
  checkTooManyExpands,
  checkUnknownEntity
} from "./queryGuardrailRules.js";

const QUERY_GUARDRAIL_RULES: QueryGuardrailRule[] = [
  checkMissingEntity,
  checkUnknownEntity,
  checkEmptyOptionValues,
  checkMissingTop,
  checkMissingSelect,
  checkMissingFilter,
  checkDuplicateSingleValueOptions,
  checkLargeTop,
  checkExpandWithoutInnerSelect,
  checkTooManyExpands,
  checkLeadingSlash
];

function uniqueIssues(issues: QueryGuardrailIssue[]): QueryGuardrailIssue[] {
  const seen = new Set<string>();
  const output: QueryGuardrailIssue[] = [];

  for (const issue of issues) {
    const key = `${issue.code}|${issue.severity}|${issue.message}|${issue.suggestion ?? ""}`;
    if (seen.has(key)) {continue;}

    seen.add(key);
    output.push(issue);
  }

  return output;
}

export function runQueryGuardrailRules(ctx: QueryGuardrailContext): QueryGuardrailResult {
  const collected: QueryGuardrailIssue[] = [];

  for (const rule of QUERY_GUARDRAIL_RULES) {
    collected.push(...rule(ctx));
  }

  const issues = uniqueIssues(collected);

  return {
    issues,
    hasWarnings: issues.some((x) => x.severity === "warning"),
    hasErrors: issues.some((x) => x.severity === "error")
  };
}