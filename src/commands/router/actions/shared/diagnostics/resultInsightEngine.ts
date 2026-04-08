import type { FieldDef } from "../../../../../services/entityFieldMetadataService.js";
import type { DiagnosticFinding } from "./diagnosticTypes.js";
import type { ExecutionEvidence } from "./executionEvidence.js";
import { buildResultInsightFindingFromCandidates } from "./resultInsights/resultInsightPresentation.js";
import { buildRankedResultInsightCandidates } from "./resultInsights/resultInsightPipeline.js";

export function buildResultInsightFinding(input: {
  evidence: ExecutionEvidence;
  parsedFilter?: string;
  fields?: FieldDef[];
}): DiagnosticFinding | undefined {
  const { evidence, parsedFilter, fields = [] } = input;
  const selectedCandidates = buildRankedResultInsightCandidates({ evidence, fields });

  return buildResultInsightFindingFromCandidates({
    evidence,
    parsedFilter,
    selectedCandidates
  });
}
