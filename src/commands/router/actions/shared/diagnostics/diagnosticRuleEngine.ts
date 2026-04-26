import type { QueryDoctorCapabilityProfile } from "../../../../../product/capabilities/capabilityTypes.js";
import type { DiagnosticContext } from "./diagnosticRule.js";
import type { DiagnosticFinding, DiagnosticResult } from "./diagnosticTypes.js";
import { basicQueryShapeRules } from "./queryDoctorRules/basicQueryShapeRules.js";
import { metadataValidationRules } from "./queryDoctorRules/metadataValidationRules.js";
import { evidenceAwareRules } from "./queryDoctorRules/evidenceAwareRules.js";

function normalizeFinding(finding: DiagnosticFinding, capabilities: QueryDoctorCapabilityProfile): DiagnosticFinding {
  const hasSuggestedFix = !!finding.suggestedFix;
  const hasDeterministicSuggestion = !!finding.suggestedQuery?.query;
  const actionability = finding.actionability ?? (hasDeterministicSuggestion ? (capabilities.canApplyFix ? "previewAndApply" : "previewOnly") : "none");
  const fixHook = finding.fixHook ?? (hasDeterministicSuggestion ? { kind: "queryDoctor.suggestedFix", label: finding.suggestedQuery?.label ?? finding.suggestedFix?.label ?? "Suggested query" } : undefined);
  return {
    ...finding,
    actionability,
    fixHook
  };
}

function dedupeFindings(findings: DiagnosticFinding[]): DiagnosticFinding[] {
  const seen = new Set<string>();
  const deduped: DiagnosticFinding[] = [];

  for (const finding of findings) {
    const key = `${finding.severity}::${finding.message}::${finding.suggestion ?? ""}::${finding.suggestedFix?.label ?? ""}::${finding.suggestedFix?.detail ?? ""}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(finding);
  }

  return deduped;
}

function severityWeight(severity: DiagnosticFinding['severity']): number {
  switch (severity) {
    case 'error':
      return 300;
    case 'warning':
      return 200;
    case 'info':
    default:
      return 100;
  }
}

function isGenericShapeGuidance(message: string): boolean {
  return message === 'Query does not specify $select.'
    || message === 'Collection query does not specify $top.'
    || message === 'Query contains duplicate $select fields.'
    || message.includes('Query includes unrecognised option');
}

function rankingScore(finding: DiagnosticFinding): number {
  const confidenceWeight = Math.round((finding.confidence ?? 0) * 100);
  const genericPenalty = isGenericShapeGuidance(finding.message) ? 50 : 0;
  return severityWeight(finding.severity) + confidenceWeight - genericPenalty;
}

function rankFindings(findings: DiagnosticFinding[]): DiagnosticFinding[] {
  return [...findings].sort((left, right) => {
    const scoreDifference = rankingScore(right) - rankingScore(left);
    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    const messageDifference = left.message.localeCompare(right.message);
    if (messageDifference !== 0) {
      return messageDifference;
    }

    return (left.suggestion ?? '').localeCompare(right.suggestion ?? '');
  });
}

export async function runDiagnostics(
  context: DiagnosticContext,
  capabilities: QueryDoctorCapabilityProfile
): Promise<DiagnosticResult> {
  const findings: DiagnosticFinding[] = [];

  if (capabilities.insightLevel >= 1) {
    for (const rule of basicQueryShapeRules) {
      findings.push(...await Promise.resolve(rule(context, capabilities)));
    }

    for (const rule of evidenceAwareRules) {
      findings.push(...await Promise.resolve(rule(context, capabilities)));
    }
  }

  if (capabilities.insightLevel >= 2) {
    for (const rule of metadataValidationRules) {
      findings.push(...await Promise.resolve(rule(context, capabilities)));
    }
  }

  const normalizedFindings = findings.map((finding) => normalizeFinding(finding, capabilities));
  return { findings: rankFindings(dedupeFindings(normalizedFindings)) };
}
