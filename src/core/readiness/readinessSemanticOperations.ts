import type {
  ContributorReadinessV1,
  EvidenceRecommendationV1,
  InvestigationGapV1,
  InvestigationReadinessErrorV1,
  InvestigationReadinessRequestV1,
  InvestigationReadinessResponseV1
} from "./readinessContracts.js";
import { assessInvestigationReadiness } from "./investigationReadinessService.js";

export const READINESS_SEMANTIC_OPERATION_IDS = [
  "assess-investigation-readiness",
  "retrieve-investigation-gaps",
  "retrieve-contributor-availability",
  "retrieve-evidence-recommendations"
] as const;

export type ReadinessSemanticOperationId = typeof READINESS_SEMANTIC_OPERATION_IDS[number];

export type ReadinessSemanticProjectionV1<T> =
  | readonly T[]
  | InvestigationReadinessErrorV1;

export interface InvestigationReadinessSemanticOperations {
  assessInvestigationReadiness(request: InvestigationReadinessRequestV1): InvestigationReadinessResponseV1;
  retrieveInvestigationGaps(response: InvestigationReadinessResponseV1): ReadinessSemanticProjectionV1<InvestigationGapV1>;
  retrieveContributorAvailability(response: InvestigationReadinessResponseV1): ReadinessSemanticProjectionV1<ContributorReadinessV1>;
  retrieveEvidenceRecommendations(response: InvestigationReadinessResponseV1): ReadinessSemanticProjectionV1<EvidenceRecommendationV1>;
}

function projectResult<T>(
  response: InvestigationReadinessResponseV1,
  selector: (result: Exclude<InvestigationReadinessResponseV1, InvestigationReadinessErrorV1>) => readonly T[]
): ReadinessSemanticProjectionV1<T> {
  return response.contractVersion === "investigation-readiness-error-v1"
    ? response
    : selector(response);
}

export const investigationReadinessSemanticOperations: InvestigationReadinessSemanticOperations = {
  assessInvestigationReadiness,
  retrieveInvestigationGaps: (response) => projectResult(response, (result) => result.gaps),
  retrieveContributorAvailability: (response) => projectResult(response, (result) => result.contributorStates),
  retrieveEvidenceRecommendations: (response) => projectResult(response, (result) => result.recommendations)
};
