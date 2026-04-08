import type { FieldDef } from "../../../../../../services/entityFieldMetadataService.js";
import { rankCandidatesByScore } from "../../intelligence/candidates/candidateRanker.js";
import type { ExecutionEvidence } from "../executionEvidence.js";
import { buildFieldMetadataMap, findFieldMetadata } from "./resultInsightFieldMetadata.js";
import { isMeaningfulResultInsightCandidate, scoreResultInsightCandidate } from "./resultInsightScoring.js";
import type { RankedResultInsightCandidate, ResultInsightContext } from "./resultInsightTypes.js";

const MAX_CANDIDATES = 6;
const MAX_RECOMMENDED = 3;

export function buildRankedResultInsightCandidates(input: {
  evidence: ExecutionEvidence;
  fields?: FieldDef[];
}): RankedResultInsightCandidate[] {
  const { evidence, fields = [] } = input;
  const fieldMap = buildFieldMetadataMap(fields);
  const context: ResultInsightContext = {
    totalRows: evidence.returnedRowCount,
    filterFieldNames: evidence.filterFieldNames
  };

  const scoredCandidates = evidence.fieldObservations
    .map((observation) => {
      const field = findFieldMetadata(fieldMap, observation.field);
      return { observation, field };
    })
    .filter(({ observation, field }) => isMeaningfulResultInsightCandidate(observation, context, field))
    .map(({ observation, field }) => {
      const ranked = scoreResultInsightCandidate(observation, context, field);
      return {
        ...ranked,
        sortKey: ranked.item.observation.field
      };
    });

  const rankedCandidates = rankCandidatesByScore(scoredCandidates);
  const recommended = rankedCandidates.filter((item) => item.item.tier === "recommended").slice(0, MAX_RECOMMENDED);
  const secondary = rankedCandidates.filter((item) => item.item.tier === "secondary").slice(0, MAX_CANDIDATES - recommended.length);

  return [...recommended, ...secondary].slice(0, MAX_CANDIDATES);
}
