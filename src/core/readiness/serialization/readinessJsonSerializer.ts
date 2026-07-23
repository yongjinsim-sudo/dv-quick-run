import type {
  InvestigationReadinessErrorV1,
  InvestigationReadinessRequestV1,
  InvestigationReadinessResultV1
} from "../readinessContracts.js";
import { canonicalizeReadinessJson } from "./readinessCanonicalJson.js";

export function serializeReadinessRequest(request: InvestigationReadinessRequestV1): string {
  return canonicalizeReadinessJson(request);
}

export function serializeReadinessResult(result: InvestigationReadinessResultV1): string {
  return canonicalizeReadinessJson(result);
}

export function serializeReadinessError(error: InvestigationReadinessErrorV1): string {
  return canonicalizeReadinessJson(error);
}
