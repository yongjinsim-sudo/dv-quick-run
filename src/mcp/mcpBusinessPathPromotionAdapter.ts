import type {
  BusinessPathHop,
  BusinessPathPromotionInput,
  BusinessPathVerification
} from "../core/businessPaths/index.js";
import type { McpBusinessPathCandidate } from "./mcpBusinessPathDiscovery.js";
import type { McpValidatedBusinessPath } from "./mcpBusinessPathRuntimeValidation.js";

export interface McpBusinessPathPromotionDraftRequest {
  readonly name: string;
  readonly description?: string;
  readonly candidate: McpBusinessPathCandidate;
  readonly validatedPath?: McpValidatedBusinessPath;
  readonly promotedAt: string;
  readonly sourceEvidenceId?: string;
  readonly investigationId?: string;
  readonly priority?: number;
  readonly environmentIdentity?: string;
  readonly organisationId?: string;
  readonly evidenceRef?: string;
}

function exactHops(candidate: McpBusinessPathCandidate): readonly BusinessPathHop[] {
  return candidate.hops.map((hop, index) => {
    const relationshipSchemaName = hop.relationshipSchemaName?.trim();
    if (!relationshipSchemaName) {
      throw new Error(
        `Business Path promotion requires an exact relationship schema name for hop ${index + 1} (${hop.fromTable} → ${hop.toTable}).`
      );
    }

    return {
      ordinal: index + 1,
      fromTable: hop.fromTable,
      toTable: hop.toTable,
      relationshipSchemaName,
      relationshipType: hop.relationshipType,
      direction: "forward",
      navigationProperty: hop.navigationProperty,
      ...(hop.referencingAttribute ? { lookupAttribute: hop.referencingAttribute } : {})
    };
  });
}

function verificationFromRuntime(
  validatedPath: McpValidatedBusinessPath | undefined,
  request: McpBusinessPathPromotionDraftRequest
): BusinessPathVerification {
  if (!validatedPath || validatedPath.runtimeStatus !== "RuntimeViable" || !validatedPath.reachedTarget) {
    return {
      status: "not-runtime-verified",
      bounded: true
    };
  }

  return {
    status: "verified",
    ...(request.environmentIdentity ? {
      environment: {
        identity: request.environmentIdentity,
        ...(request.organisationId ? { organisationId: request.organisationId } : {})
      }
    } : {}),
    verifiedAt: request.promotedAt,
    testedSourceCount: 1,
    reachedTargetCount: 1,
    observedTargetRows: validatedPath.observedTargetRecordCount,
    bounded: true,
    ...(request.evidenceRef ? { evidenceRef: request.evidenceRef } : {})
  };
}

/**
 * Converts an already-discovered exact DVQR relationship candidate into a
 * managed-path promotion draft. This function has no persistence side effects.
 *
 * Runtime validation is optional. Only a RuntimeViable result for the exact same
 * path may produce a `verified` snapshot.
 */
export function buildBusinessPathPromotionFromMcpCandidate(
  request: McpBusinessPathPromotionDraftRequest
): BusinessPathPromotionInput {
  const candidate = request.candidate;
  const validated = request.validatedPath;

  if (validated && validated.pathId !== candidate.pathId) {
    throw new Error("Runtime verification does not belong to the Business Path candidate being promoted.");
  }

  return {
    name: request.name,
    ...(request.description ? { description: request.description } : {}),
    sourceTable: candidate.tables[0] ?? candidate.hops[0]?.fromTable ?? "",
    targetTable: candidate.tables.at(-1) ?? candidate.hops.at(-1)?.toTable ?? "",
    hops: exactHops(candidate),
    ...(request.priority !== undefined ? { priority: request.priority } : {}),
    provenance: {
      promotedFrom: validated ? "runtime-validation" : "relationship-discovery",
      ...(request.sourceEvidenceId ? { sourceEvidenceId: request.sourceEvidenceId } : {}),
      ...(request.investigationId ? { investigationId: request.investigationId } : {}),
      promotedAt: request.promotedAt,
      promotedBy: "user"
    },
    verification: verificationFromRuntime(validated, request),
    applicability: {
      scope: "workspace",
      ...(validated?.runtimeStatus === "RuntimeViable" && validated.reachedTarget && request.environmentIdentity
        ? { verifiedEnvironmentIds: [request.environmentIdentity] }
        : {})
    }
  };
}
