import type { DiagnosticFinding, DiagnosticResult } from "./diagnosticTypes.js";

type DiagnosticGroup = {
  title: string;
  confidence: number;
  recommendation?: string;
  findings: DiagnosticFinding[];
};

export function buildDiagnosticMarkdownLines(result: DiagnosticResult): string[] {
  if (!result.findings.length) {
    return [];
  }

  const groups = groupFindings(result.findings);
  const lines: string[] = ["## Diagnostics", ""];

  for (const group of groups) {
    lines.push(`### ${group.title}`);

    if (typeof group.confidence === "number") {
      lines.push(`- Confidence: ${group.confidence.toFixed(2)}`);
    }

    if (group.recommendation) {
      lines.push(`- Recommendation: ${group.recommendation}`);
    }

    lines.push("- Evidence:");

    for (const finding of group.findings) {
      const prefix = finding.severity === "error"
        ? "  - ❌"
        : finding.severity === "warning"
          ? "  - ⚠️"
          : "  - ℹ️";

      lines.push(`${prefix} ${finding.message}`);

      if (finding.suggestion) {
        lines.push(`    - Suggestion: ${finding.suggestion}`);
      }

      if (finding.suggestedFix) {
        lines.push(`    - Suggested Fix: ${finding.suggestedFix.label} — ${finding.suggestedFix.detail}`);

        if (finding.suggestedFix.example) {
          lines.push(`    - Example: ${finding.suggestedFix.example}`);
        }

        if (finding.suggestedFix.isSpeculative) {
          lines.push("    - Note: This fix is advisory because the field or path could not be resolved confidently.");
        }
      }
    }

    lines.push("");
  }

  return lines;
}

function groupFindings(findings: DiagnosticFinding[]): DiagnosticGroup[] {
  const buckets = new Map<string, DiagnosticFinding[]>();

  for (const finding of findings) {
    const key = getGroupingKey(finding);

    if (!buckets.has(key)) {
      buckets.set(key, []);
    }

    buckets.get(key)?.push(finding);
  }

  return Array.from(buckets.entries()).map(([key, grouped]) => {
    const primary = grouped[0];

    return {
      title: buildGroupTitle(key, primary),
      confidence: Math.max(...grouped.map((f) => f.confidence ?? f.suggestedFix?.confidence ?? 0)),
      recommendation: buildGroupRecommendation(key, grouped),
      findings: grouped
    };
  });
}

function getGroupingKey(finding: DiagnosticFinding): string {
  const message = finding.message.toLowerCase();

  if (message.includes("not a good fit for guid or lookup comparisons")) {
    return "operator-guid-lookup";
  }

  if (message.includes("not a good fit for boolean comparisons")) {
    return "operator-boolean";
  }

  if (message.includes("text field")) {
    return "semantic-text-operator";
  }

  if (
    message.includes("choice-like field") ||
    message.includes("choice-like or boolean field")
  ) {
    return "semantic-choice-operator";
  }

  if (message.includes("does not appear to be a standard scalar attribute")) {
    return "non-scalar-field";
  }

  if (message.includes("not recognised as a standard attribute")) {
    return "unknown-field";
  }

  if (message.includes("is not a guid")) {
    return "type-guid-literal";
  }

  if (message.includes("does not look like a date or datetime value")) {
    return "type-date-literal";
  }

  if (message.includes("is not numeric")) {
    return "type-numeric-literal";
  }

  if (message.includes("is not a boolean value")) {
    return "type-boolean-literal";
  }

  if (
    message.includes("quoted `null`") ||
    message.includes("quoted 'null'") ||
    message.includes("quoted literal")
  ) {
    return "quoted-null";
  }

  if (message.includes("null")) {
    return "null-semantics";
  }

  if (message.includes("does not specify $select")) {
    return "shape-select";
  }

  if (message.includes("does not specify $top")) {
    return "shape-top";
  }

  return `single:${finding.message}`;
}

function buildGroupTitle(key: string, finding: DiagnosticFinding): string {
  switch (key) {
    case "operator-guid-lookup":
      return "Root Cause: Invalid operator for GUID / lookup field";

    case "operator-boolean":
      return "Root Cause: Invalid operator for boolean field";

    case "semantic-text-operator":
      return "Root Cause: Suspicious range comparison on text field";

    case "semantic-choice-operator":
      return "Root Cause: Invalid operator for choice-like / boolean field";

    case "non-scalar-field":
      return "Root Cause: Filter targets non-scalar field";

    case "unknown-field":
      return "Root Cause: Field could not be resolved";

    case "quoted-null":
      return "Root Cause: Incorrect quoted null usage";

    case "type-guid-literal":
      return "Root Cause: Invalid GUID literal";

    case "type-date-literal":
      return "Root Cause: Invalid date/datetime literal";

    case "type-numeric-literal":
      return "Root Cause: Invalid numeric literal";

    case "type-boolean-literal":
      return "Root Cause: Invalid boolean literal";

    case "null-semantics":
      return "Root Cause: Suspicious null handling";

    case "shape-select":
      return "Advisory: Query shape missing $select";

    case "shape-top":
      return "Advisory: Query shape missing $top";

    default:
      return `Issue: ${finding.message}`;
  }
}

function buildGroupRecommendation(key: string, findings: DiagnosticFinding[]): string | undefined {
  const firstSuggestion = findings.find((f) => !!f.suggestion)?.suggestion;
  if (firstSuggestion) {
    return firstSuggestion;
  }

  switch (key) {
    case "operator-guid-lookup":
    case "operator-boolean":
      return "Use an operator compatible with the field type.";

    case "semantic-text-operator":
      return "Prefer eq/ne for exact text checks, or use a supported text function.";

    case "semantic-choice-operator":
      return "Prefer eq/ne with explicit option values unless numeric ordering is intentional.";

    case "non-scalar-field":
      return "Filter on a scalar attribute instead of a navigation/path-like field.";

    case "unknown-field":
      return "Check the field logical name against entity metadata.";

    case "quoted-null":
      return "Use unquoted null if you intend a null comparison.";

    case "type-guid-literal":
      return "Use a valid GUID literal or switch to the correct lookup/navigation filter form.";

    case "type-date-literal":
      return "Use an ISO-style date or datetime literal that matches the Dataverse field type.";

    case "type-numeric-literal":
      return "Use an unquoted numeric literal for numeric or choice-like fields.";

    case "type-boolean-literal":
      return "Use true or false when filtering boolean fields.";

    default:
      return undefined;
  }
}
