import type { CapabilitySet } from "../../../../../product/capabilities/capabilityTypes.js";
import type { DiagnosticContext } from "./diagnosticRule.js";
import type { DiagnosticFinding, DiagnosticResult } from "./diagnosticTypes.js";
import { basicQueryShapeRules } from "./queryDoctorRules/basicQueryShapeRules.js";
import { metadataValidationRules } from "./queryDoctorRules/metadataValidationRules.js";
import { hasExpandClause } from './expandDetection';
import { buildExpandNotFullySupportedDiagnostic } from './diagnosticSuggestionBuilder';

function applyExpandAdvisory(query: string, findings: DiagnosticFinding[]) {
  if (!hasExpandClause(query)) {
    return;
  }

  const alreadyExists = findings.some((f) =>
    f.message.includes('Expand support is currently partial')
  );

  if (!alreadyExists) {
    findings.push(buildExpandNotFullySupportedDiagnostic());
  }
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
  capabilities: CapabilitySet
): Promise<DiagnosticResult> {
  const findings: DiagnosticFinding[] = [];

  if (capabilities.queryDoctor >= 1) {
    for (const rule of basicQueryShapeRules) {
      findings.push(...await Promise.resolve(rule(context, capabilities)));
    }
  }

  if (capabilities.queryDoctor >= 2) {
    for (const rule of metadataValidationRules) {
      findings.push(...await Promise.resolve(rule(context, capabilities)));
    }
  }

  return { findings: rankFindings(dedupeFindings(findings)) };
}
