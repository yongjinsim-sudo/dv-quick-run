import type {
  BusinessPathMetadataProvider,
  BusinessPathMetadataRelationship,
  BusinessPathRelationshipType
} from "../core/businessPaths/index.js";
import type {
  McpMetadataContext,
  McpRelationshipMetadataRepository
} from "./mcpRelationshipMetadataRepository.js";
import type { McpRelationshipEdge } from "./mcpRelationshipIntelligence.js";

type MetadataRepositoryReader = Pick<
  McpRelationshipMetadataRepository,
  "fetchEntityCatalogue" | "fetchRelationships"
>;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function relationshipType(edge: McpRelationshipEdge): BusinessPathRelationshipType {
  return edge.relationshipType;
}

function mapRelationship(edge: McpRelationshipEdge): BusinessPathMetadataRelationship | undefined {
  const schemaName = edge.relationshipSchemaName?.trim();
  if (!schemaName) {
    return undefined;
  }

  return {
    fromTable: edge.fromTable,
    toTable: edge.toTable,
    relationshipSchemaName: schemaName,
    relationshipType: relationshipType(edge),
    navigationProperty: edge.navigationProperty,
    ...(edge.referencingAttribute ? { lookupAttribute: edge.referencingAttribute } : {})
  };
}

export function businessPathEnvironmentIdentity(baseEnvironmentUrl: string): string {
  try {
    return new URL(baseEnvironmentUrl).hostname.toLowerCase();
  } catch {
    return baseEnvironmentUrl.trim().toLowerCase();
  }
}

/**
 * Dataverse metadata adapter for Managed Business Path revalidation.
 *
 * It reuses the existing relationship metadata repository and does not participate
 * in relationship discovery, ranking, Guided Traversal, or runtime row probing.
 */
export class McpBusinessPathMetadataProvider implements BusinessPathMetadataProvider {
  private tableNames?: Set<string>;
  private readonly relationshipCache = new Map<string, readonly BusinessPathMetadataRelationship[]>();

  public constructor(
    private readonly metadata: MetadataRepositoryReader,
    private readonly context: McpMetadataContext
  ) {}

  public async tableExists(logicalName: string): Promise<boolean> {
    if (!this.tableNames) {
      const catalogue = await this.metadata.fetchEntityCatalogue(
        this.context.baseEnvironmentUrl,
        this.context.token
      );
      this.tableNames = new Set(
        catalogue
          .map((entity) => String(entity.LogicalName ?? "").trim().toLowerCase())
          .filter(Boolean)
      );
    }
    return this.tableNames.has(normalize(logicalName));
  }

  public async relationshipsFrom(logicalName: string): Promise<readonly BusinessPathMetadataRelationship[]> {
    const key = normalize(logicalName);
    const cached = this.relationshipCache.get(key);
    if (cached) {
      return cached;
    }

    const relationships = await this.metadata.fetchRelationships(
      this.context.baseEnvironmentUrl,
      this.context.token,
      logicalName
    );
    const mapped = relationships
      .map(mapRelationship)
      .filter((item): item is BusinessPathMetadataRelationship => Boolean(item));
    this.relationshipCache.set(key, mapped);
    return mapped;
  }
}
