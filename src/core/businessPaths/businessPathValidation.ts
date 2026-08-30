import {
  DVQR_BUSINESS_PATH_SCHEMA_VERSION,
  type BusinessPathArtifact,
  type BusinessPathArtifactValidationResult,
  type BusinessPathHop,
  type BusinessPathValidationIssue
} from "./businessPathContracts.js";
import { businessPathId } from "./businessPathIdentity.js";

const logicalNamePattern = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const safeIdPattern = /^bp_[0-9a-f]{8}$/;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const controlCharacterPattern = /[\u0000-\u001f\u007f]/;
const MAX_BUSINESS_PATH_HOPS = 6;
const MAX_BUSINESS_PATH_NAME = 256;
const MAX_BUSINESS_PATH_DESCRIPTION = 4096;

const secretPattern =
  /\b(access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization|password|private[_-]?key)\b|Bearer\s+[A-Za-z0-9._~+/-]+/i;

function issue(
  code: BusinessPathValidationIssue["code"],
  message: string,
  hopOrdinal?: number
): BusinessPathValidationIssue {
  return {
    code,
    message,
    ...(hopOrdinal !== undefined ? { hopOrdinal } : {})
  };
}

function isLogicalName(value: unknown): value is string {
  return typeof value === "string" && logicalNamePattern.test(value.trim());
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && isoDatePattern.test(value);
}

export function validateBusinessPathArtifact(artifact: BusinessPathArtifact): BusinessPathArtifactValidationResult {
  const issues: BusinessPathValidationIssue[] = [];

  if (artifact.schemaVersion !== DVQR_BUSINESS_PATH_SCHEMA_VERSION) {
    issues.push(issue("invalid-schema-version", `Expected schemaVersion ${DVQR_BUSINESS_PATH_SCHEMA_VERSION}.`));
  }
  if (!safeIdPattern.test(artifact.id)) {
    issues.push(issue("invalid-id", "Business Path ID must use the deterministic bp_<8 hex chars> form."));
  }
  if (typeof artifact.name !== "string" || !artifact.name.trim()) {
    issues.push(issue("invalid-name", "Business Path name is required."));
  } else if (
    artifact.name.length > MAX_BUSINESS_PATH_NAME
    || controlCharacterPattern.test(artifact.name)
  ) {
    issues.push(issue(
      "invalid-text-content",
      `Business Path name must be at most ${MAX_BUSINESS_PATH_NAME} characters and contain no control characters.`
    ));
  }
  if (
    artifact.description !== undefined
    && (
      typeof artifact.description !== "string"
      || artifact.description.length > MAX_BUSINESS_PATH_DESCRIPTION
      || controlCharacterPattern.test(artifact.description)
    )
  ) {
    issues.push(issue(
      "invalid-text-content",
      `Business Path description must be at most ${MAX_BUSINESS_PATH_DESCRIPTION} characters and contain no control characters.`
    ));
  }
  if (!isLogicalName(artifact.sourceTable)) {
    issues.push(issue("invalid-source-table", "sourceTable must be a Dataverse logical name."));
  }
  if (!isLogicalName(artifact.targetTable)) {
    issues.push(issue("invalid-target-table", "targetTable must be a Dataverse logical name."));
  }
  if (!["saved", "preferred", "disabled"].includes(artifact.state)) {
    issues.push(issue("invalid-state", "Business Path state must be saved, preferred or disabled."));
  }
  if (artifact.priority !== undefined && (!Number.isInteger(artifact.priority) || artifact.priority < 0)) {
    issues.push(issue("invalid-priority", "Business Path priority must be a non-negative integer when supplied."));
  }
  if (!Array.isArray(artifact.hops) || artifact.hops.length === 0) {
    issues.push(issue("missing-hops", "At least one exact relationship hop is required."));
  } else if (artifact.hops.length > MAX_BUSINESS_PATH_HOPS) {
    issues.push(issue(
      "excessive-hops",
      `Business Path artifacts are bounded to at most ${MAX_BUSINESS_PATH_HOPS} exact relationship hops.`
    ));
  }

  const hopsStructurallyUsable = Array.isArray(artifact.hops)
    && artifact.hops.every((hop) => Boolean(hop) && typeof hop === "object" && !Array.isArray(hop));
  const ordered = hopsStructurallyUsable
    ? [...artifact.hops].sort((left, right) => left.ordinal - right.ordinal)
    : [];
  if (Array.isArray(artifact.hops) && artifact.hops.length > 0 && !hopsStructurallyUsable) {
    issues.push(issue("invalid-hop-table", "Each hop must be an object with exact relationship identity."));
  }
  const seenOrdinals = new Set<number>();

  for (const rawHop of ordered) {
    if (!rawHop || typeof rawHop !== "object" || Array.isArray(rawHop)) {
      issues.push(issue("invalid-hop-table", "Each hop must be an object with exact relationship identity."));
      continue;
    }
    const hop = rawHop as BusinessPathHop;
    if (!Number.isInteger(hop.ordinal) || hop.ordinal < 1) {
      issues.push(issue("invalid-hop-ordinal", "Hop ordinal must be a positive integer.", hop.ordinal));
    }
    if (seenOrdinals.has(hop.ordinal)) {
      issues.push(issue("duplicate-hop-ordinal", `Hop ordinal ${hop.ordinal} appears more than once.`, hop.ordinal));
    }
    seenOrdinals.add(hop.ordinal);

    if (!isLogicalName(hop.fromTable) || !isLogicalName(hop.toTable)) {
      issues.push(issue("invalid-hop-table", "Each hop must use valid Dataverse logical names.", hop.ordinal));
    }
    if (!hop.relationshipSchemaName?.trim()) {
      issues.push(issue("invalid-relationship-schema", "Each hop requires an exact relationship schema name.", hop.ordinal));
    }
    if (!["ManyToOne", "OneToMany", "ManyToMany"].includes(hop.relationshipType)) {
      issues.push(issue("invalid-relationship-type", "Unsupported relationship type.", hop.ordinal));
    }
    if (hop.direction !== "forward" && hop.direction !== "reverse") {
      issues.push(issue("invalid-direction", "Hop direction must be forward or reverse.", hop.ordinal));
    }
  }

  for (let index = 0; index < ordered.length - 1; index += 1) {
    if (ordered[index].toTable.trim().toLowerCase() !== ordered[index + 1].fromTable.trim().toLowerCase()) {
      issues.push(issue(
        "path-discontinuity",
        `Hop ${ordered[index].ordinal} ends at ${ordered[index].toTable} but hop ${ordered[index + 1].ordinal} starts at ${ordered[index + 1].fromTable}.`,
        ordered[index + 1].ordinal
      ));
    }
  }

  if (ordered[0] && artifact.sourceTable.trim().toLowerCase() !== ordered[0].fromTable.trim().toLowerCase()) {
    issues.push(issue("source-mismatch", "Artifact sourceTable must match the first hop source."));
  }
  const last = ordered.at(-1);
  if (last && artifact.targetTable.trim().toLowerCase() !== last.toTable.trim().toLowerCase()) {
    issues.push(issue("target-mismatch", "Artifact targetTable must match the last hop target."));
  }

  if (hopsStructurallyUsable && artifact.hops.length > 0 && safeIdPattern.test(artifact.id)) {
    const expectedId = businessPathId(artifact.sourceTable, artifact.targetTable, artifact.hops);
    if (artifact.id !== expectedId) {
      issues.push(issue("id-mismatch", `Business Path ID does not match canonical route identity; expected ${expectedId}.`));
    }
  }

  if (
    !artifact.provenance
    || !["runtime-validation", "guided-traversal", "relationship-discovery", "manual-reviewed"].includes(artifact.provenance.promotedFrom)
    || artifact.provenance.promotedBy !== "user"
    || !isIsoDate(artifact.provenance.promotedAt)
  ) {
    issues.push(issue("invalid-provenance", "Business Path provenance must record an explicit user promotion with an ISO UTC timestamp."));
  }

  const verification = artifact.verification;
  if (verification) {
    const invalidCounts =
      (verification.testedSourceCount !== undefined && (!Number.isInteger(verification.testedSourceCount) || verification.testedSourceCount < 0))
      || (verification.reachedTargetCount !== undefined && (!Number.isInteger(verification.reachedTargetCount) || verification.reachedTargetCount < 0))
      || (verification.observedTargetRows !== undefined
        && verification.observedTargetRows !== null
        && (!Number.isInteger(verification.observedTargetRows) || verification.observedTargetRows < 0));

    if (
      !["verified", "not-runtime-verified"].includes(verification.status)
      || typeof verification.bounded !== "boolean"
      || (verification.verifiedAt !== undefined && !isIsoDate(verification.verifiedAt))
      || invalidCounts
      || (verification.reachedTargetCount !== undefined
        && verification.testedSourceCount !== undefined
        && verification.reachedTargetCount > verification.testedSourceCount)
      || (verification.status === "verified" && !verification.verifiedAt)
    ) {
      issues.push(issue("invalid-verification", "Business Path verification metadata is inconsistent or malformed."));
    }
  }

  if (
    artifact.applicability
    && (
      artifact.applicability.scope !== "workspace"
      || (artifact.applicability.verifiedEnvironmentIds !== undefined
        && !Array.isArray(artifact.applicability.verifiedEnvironmentIds))
    )
  ) {
    issues.push(issue("invalid-applicability", "Initial Business Path applicability scope must be workspace."));
  }

  if (!isIsoDate(artifact.createdAt) || !isIsoDate(artifact.updatedAt)) {
    issues.push(issue("invalid-provenance", "createdAt and updatedAt must be ISO UTC timestamps."));
  }

  if (secretPattern.test(JSON.stringify(artifact))) {
    issues.push(issue("secret-like-content", "Business Path persistence refused secret-like content."));
  }

  return { valid: issues.length === 0, issues };
}
