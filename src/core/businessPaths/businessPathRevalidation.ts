import type {
  BusinessPathArtifact,
  BusinessPathHop,
  BusinessPathRelationshipType,
  BusinessPathValidationState
} from "./businessPathContracts.js";

export interface BusinessPathMetadataRelationship {
  readonly fromTable: string;
  readonly toTable: string;
  readonly relationshipSchemaName: string;
  readonly relationshipType: BusinessPathRelationshipType;
  readonly navigationProperty?: string;
  readonly lookupAttribute?: string;
  readonly intersectTable?: string;
  readonly polymorphicTarget?: string;
}

export interface BusinessPathMetadataProvider {
  tableExists(logicalName: string): Promise<boolean>;
  relationshipsFrom(logicalName: string): Promise<readonly BusinessPathMetadataRelationship[]>;
}

export type BusinessPathRevalidationIssueCode =
  | "source-table-missing"
  | "target-table-missing"
  | "intermediate-table-missing"
  | "relationship-missing"
  | "relationship-endpoint-changed"
  | "relationship-type-changed"
  | "navigation-property-changed"
  | "lookup-attribute-changed"
  | "intersect-table-changed"
  | "polymorphic-target-changed"
  | "metadata-unavailable";

export interface BusinessPathRevalidationIssue {
  readonly code: BusinessPathRevalidationIssueCode;
  readonly message: string;
  readonly hopOrdinal?: number;
  readonly fromTable?: string;
  readonly toTable?: string;
  readonly relationshipSchemaName?: string;
}

export interface BusinessPathRevalidationResult {
  readonly pathId: string;
  readonly state: BusinessPathValidationState;
  readonly activeEnvironmentId?: string;
  readonly historicallyVerifiedInActiveEnvironment: boolean | null;
  readonly checkedTables: readonly string[];
  readonly checkedHops: number;
  readonly issues: readonly BusinessPathRevalidationIssue[];
}

const normalize = (value: string | undefined): string => (value ?? "").trim().toLowerCase();

function same(left: string | undefined, right: string | undefined): boolean {
  return normalize(left) === normalize(right);
}

function issue(
  code: BusinessPathRevalidationIssueCode,
  message: string,
  hop?: BusinessPathHop
): BusinessPathRevalidationIssue {
  return {
    code,
    message,
    ...(hop ? {
      hopOrdinal: hop.ordinal,
      fromTable: hop.fromTable,
      toTable: hop.toTable,
      relationshipSchemaName: hop.relationshipSchemaName
    } : {})
  };
}

function historicalEnvironmentMatch(
  artifact: BusinessPathArtifact,
  activeEnvironmentId: string | undefined
): boolean | null {
  if (!activeEnvironmentId) {
    return null;
  }

  const verificationEnvironment = artifact.verification?.environment?.identity;
  const applicabilityEnvironments = artifact.applicability?.verifiedEnvironmentIds ?? [];
  const candidates = [
    ...(verificationEnvironment ? [verificationEnvironment] : []),
    ...applicabilityEnvironments
  ];

  if (!candidates.length) {
    return null;
  }

  return candidates.some((candidate) => same(candidate, activeEnvironmentId));
}

function uniqueTables(artifact: BusinessPathArtifact): readonly string[] {
  const values = [
    artifact.sourceTable,
    ...artifact.hops.flatMap((hop) => [hop.fromTable, hop.toTable]),
    artifact.targetTable
  ];
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalize(value);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function matchingSchema(
  relationships: readonly BusinessPathMetadataRelationship[],
  hop: BusinessPathHop
): readonly BusinessPathMetadataRelationship[] {
  return relationships.filter((relationship) =>
    same(relationship.relationshipSchemaName, hop.relationshipSchemaName)
  );
}

function matchingEndpoint(
  relationships: readonly BusinessPathMetadataRelationship[],
  hop: BusinessPathHop
): readonly BusinessPathMetadataRelationship[] {
  return relationships.filter((relationship) =>
    same(relationship.fromTable, hop.fromTable)
    && same(relationship.toTable, hop.toTable)
  );
}

/**
 * Revalidates a persisted Business Path against current metadata only.
 *
 * This service never performs runtime row probing, never changes the artifact,
 * and never converts metadata retrieval failures into `stale`.
 */
export class BusinessPathRevalidationService {
  public constructor(private readonly metadata: BusinessPathMetadataProvider) {}

  public async revalidate(
    artifact: BusinessPathArtifact,
    activeEnvironmentId?: string
  ): Promise<BusinessPathRevalidationResult> {
    const checkedTables: string[] = [];
    const issues: BusinessPathRevalidationIssue[] = [];
    const tables = uniqueTables(artifact);

    let checkedHops = 0;

    try {
      for (const table of tables) {
        checkedTables.push(table);
        const exists = await this.metadata.tableExists(table);
        if (exists) {
          continue;
        }

        const isSource = same(table, artifact.sourceTable);
        const isTarget = same(table, artifact.targetTable);
        issues.push(issue(
          isSource
            ? "source-table-missing"
            : isTarget
              ? "target-table-missing"
              : "intermediate-table-missing",
          `${table} does not exist in the active Dataverse metadata.`
        ));
      }

      // Missing tables already make the persisted route structurally stale.
      // Do not manufacture secondary relationship failures for tables that do not exist.
      if (issues.some((item) =>
        item.code === "source-table-missing"
        || item.code === "target-table-missing"
        || item.code === "intermediate-table-missing"
      )) {
        return {
          pathId: artifact.id,
          state: "stale",
          ...(activeEnvironmentId ? { activeEnvironmentId } : {}),
          historicallyVerifiedInActiveEnvironment: historicalEnvironmentMatch(artifact, activeEnvironmentId),
          checkedTables,
          checkedHops: 0,
          issues
        };
      }

      const relationshipsByTable = new Map<string, readonly BusinessPathMetadataRelationship[]>();

      for (const hop of [...artifact.hops].sort((left, right) => left.ordinal - right.ordinal)) {
        const key = normalize(hop.fromTable);
        let relationships = relationshipsByTable.get(key);
        if (!relationships) {
          relationships = await this.metadata.relationshipsFrom(hop.fromTable);
          relationshipsByTable.set(key, relationships);
        }

        checkedHops += 1;
        const sameSchema = matchingSchema(relationships, hop);
        if (!sameSchema.length) {
          issues.push(issue(
            "relationship-missing",
            `Relationship ${hop.relationshipSchemaName} no longer resolves from ${hop.fromTable}.`,
            hop
          ));
          continue;
        }

        const exactEndpoint = matchingEndpoint(sameSchema, hop);
        if (!exactEndpoint.length) {
          issues.push(issue(
            "relationship-endpoint-changed",
            `Relationship ${hop.relationshipSchemaName} no longer connects ${hop.fromTable} to ${hop.toTable}.`,
            hop
          ));
          continue;
        }

        const exactType = exactEndpoint.filter((relationship) =>
          relationship.relationshipType === hop.relationshipType
        );
        if (!exactType.length) {
          issues.push(issue(
            "relationship-type-changed",
            `Relationship ${hop.relationshipSchemaName} no longer has type ${hop.relationshipType}.`,
            hop
          ));
          continue;
        }

        const relationship = exactType[0];

        if (hop.navigationProperty && !same(relationship.navigationProperty, hop.navigationProperty)) {
          issues.push(issue(
            "navigation-property-changed",
            `Relationship ${hop.relationshipSchemaName} no longer exposes navigation property ${hop.navigationProperty}.`,
            hop
          ));
        }

        if (hop.lookupAttribute && !same(relationship.lookupAttribute, hop.lookupAttribute)) {
          issues.push(issue(
            "lookup-attribute-changed",
            `Relationship ${hop.relationshipSchemaName} no longer uses lookup attribute ${hop.lookupAttribute}.`,
            hop
          ));
        }

        if (hop.intersectTable && !same(relationship.intersectTable, hop.intersectTable)) {
          issues.push(issue(
            "intersect-table-changed",
            `Relationship ${hop.relationshipSchemaName} no longer uses intersect table ${hop.intersectTable}.`,
            hop
          ));
        }

        if (hop.polymorphicTarget && !same(relationship.polymorphicTarget, hop.polymorphicTarget)) {
          issues.push(issue(
            "polymorphic-target-changed",
            `Relationship ${hop.relationshipSchemaName} no longer resolves polymorphic target ${hop.polymorphicTarget}.`,
            hop
          ));
        }
      }

      return {
        pathId: artifact.id,
        state: issues.length ? "stale" : "valid",
        ...(activeEnvironmentId ? { activeEnvironmentId } : {}),
        historicallyVerifiedInActiveEnvironment: historicalEnvironmentMatch(artifact, activeEnvironmentId),
        checkedTables,
        checkedHops,
        issues
      };
    } catch (error) {
      const metadataIssue = issue(
        "metadata-unavailable",
        `Business Path metadata revalidation could not complete: ${error instanceof Error ? error.message : "unknown metadata error"}.`
      );
      const alreadyProvenStale = issues.some((item) => item.code !== "metadata-unavailable");
      return {
        pathId: artifact.id,
        state: alreadyProvenStale ? "stale" : "unknown",
        ...(activeEnvironmentId ? { activeEnvironmentId } : {}),
        historicallyVerifiedInActiveEnvironment: historicalEnvironmentMatch(artifact, activeEnvironmentId),
        checkedTables,
        checkedHops,
        issues: [...issues, metadataIssue]
      };
    }
  }
}
