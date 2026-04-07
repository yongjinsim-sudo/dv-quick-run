import type { DiagnosticRule } from "../diagnosticRule.js";
import { buildResultInsightFinding } from "../resultInsightEngine.js";

const MIN_ANALYSABLE_ROWS = 12;

export const evidenceAwareRules: DiagnosticRule[] = [
  async (context) => {
    const evidence = context.executionEvidence;
    const parsed = context.parsed;

    if (!evidence || !parsed.isCollection || evidence.returnedRowCount < MIN_ANALYSABLE_ROWS) {
      return [];
    }

    const entityLogicalName = context.entityLogicalName?.trim();
    const fields = context.loadFieldsForEntity && entityLogicalName
      ? await context.loadFieldsForEntity(entityLogicalName)
      : [];

    const finding = buildResultInsightFinding({
      evidence,
      parsedFilter: parsed.filter,
      fields
    });

    return finding ? [finding] : [];
  }
];
