import type { BusinessPathArtifact } from "./businessPathContracts.js";
import { validateBusinessPathArtifact } from "./businessPathValidation.js";

function orderedArtifact(artifact: BusinessPathArtifact): BusinessPathArtifact {
  return {
    schemaVersion: artifact.schemaVersion,
    id: artifact.id,
    name: artifact.name,
    ...(artifact.description !== undefined ? { description: artifact.description } : {}),
    sourceTable: artifact.sourceTable,
    targetTable: artifact.targetTable,
    state: artifact.state,
    ...(artifact.priority !== undefined ? { priority: artifact.priority } : {}),
    hops: [...artifact.hops]
      .sort((left, right) => left.ordinal - right.ordinal)
      .map((hop) => ({
        ordinal: hop.ordinal,
        fromTable: hop.fromTable,
        toTable: hop.toTable,
        relationshipSchemaName: hop.relationshipSchemaName,
        relationshipType: hop.relationshipType,
        direction: hop.direction,
        ...(hop.navigationProperty !== undefined ? { navigationProperty: hop.navigationProperty } : {}),
        ...(hop.lookupAttribute !== undefined ? { lookupAttribute: hop.lookupAttribute } : {}),
        ...(hop.intersectTable !== undefined ? { intersectTable: hop.intersectTable } : {}),
        ...(hop.polymorphicTarget !== undefined ? { polymorphicTarget: hop.polymorphicTarget } : {})
      })),
    provenance: { ...artifact.provenance },
    ...(artifact.verification !== undefined ? {
      verification: {
        ...artifact.verification,
        ...(artifact.verification.environment ? { environment: { ...artifact.verification.environment } } : {})
      }
    } : {}),
    ...(artifact.applicability !== undefined ? {
      applicability: {
        scope: artifact.applicability.scope,
        ...(artifact.applicability.verifiedEnvironmentIds !== undefined
          ? { verifiedEnvironmentIds: [...artifact.applicability.verifiedEnvironmentIds].sort() }
          : {})
      }
    } : {}),
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt
  };
}

export function serializeBusinessPathArtifact(artifact: BusinessPathArtifact): string {
  const validation = validateBusinessPathArtifact(artifact);
  if (!validation.valid) {
    throw new Error(`Invalid Business Path artifact: ${validation.issues.map((item) => item.code).join(", ")}`);
  }
  return `${JSON.stringify(orderedArtifact(artifact), null, 2)}\n`;
}

export function parseBusinessPathArtifact(text: string): BusinessPathArtifact {
  const parsed = JSON.parse(text) as BusinessPathArtifact;
  const validation = validateBusinessPathArtifact(parsed);
  if (!validation.valid) {
    throw new Error(`Invalid Business Path artifact: ${validation.issues.map((item) => item.code).join(", ")}`);
  }
  return orderedArtifact(parsed);
}
