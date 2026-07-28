import type { McpRankedRelationshipPath, McpRelationshipEdge } from "./mcpRelationshipIntelligence.js";

export interface McpEntityShape {
  readonly logicalName: string;
  readonly entitySetName: string;
  readonly primaryIdAttribute: string;
  readonly primaryNameAttribute?: string;
}

export interface McpPathQueryStep {
  readonly index: number;
  readonly fromTable: string;
  readonly toTable: string;
  readonly relationshipType: McpRelationshipEdge["relationshipType"];
  readonly navigationProperty: string;
  readonly queryTemplate: string;
  readonly continuation: string;
}

export interface McpRelationshipQueryVariants {
  readonly minimal: string;
  readonly recommended: string;
  readonly staged: readonly string[];
}

export interface McpGeneratedRelationshipQuery {
  readonly sourceTable: string;
  readonly targetTable: string;
  readonly pathId: string;
  readonly pathTables: readonly string[];
  readonly recommendedMode: "direct-expand" | "nested-expand" | "staged-traversal";
  readonly rootQueryTemplate: string;
  readonly stagedQueries: readonly McpPathQueryStep[];
  readonly explanation: readonly string[];
  readonly assumptions: readonly string[];
  readonly variants: McpRelationshipQueryVariants;
  readonly queryRationale: { readonly reason: string; readonly estimatedCost: "Low" | "Medium"; readonly roundTrips: number; readonly educationalTip?: string };
}

function nestedExpand(edges: readonly McpRelationshipEdge[], shapes: ReadonlyMap<string, McpEntityShape>, index = 0): string {
  const edge = edges[index];
  const target = shapes.get(edge.toTable.toLowerCase());
  const select = target ? `$select=${target.primaryIdAttribute}${target.primaryNameAttribute ? `,${target.primaryNameAttribute}` : ""}` : "";
  const nested = index + 1 < edges.length ? `$expand=${nestedExpand(edges, shapes, index + 1)}` : "";
  const options = [select, nested].filter(Boolean).join(";");
  return options ? `${edge.navigationProperty}(${options})` : edge.navigationProperty;
}

export function generateRelationshipQuery(
  path: McpRankedRelationshipPath,
  shapes: readonly McpEntityShape[],
  sourceRecordId?: string,
  maxProbeRecords = 5
): McpGeneratedRelationshipQuery {
  const byName = new Map(shapes.map((shape) => [shape.logicalName.toLowerCase(), shape]));
  const source = byName.get(path.tables[0]?.toLowerCase());
  if (!source) {
    throw new Error(`Entity shape for ${path.tables[0] ?? "source table"} is required.`);
  }
  const id = sourceRecordId?.trim() || "<source-record-guid>";
  const rootSelect = [source.primaryIdAttribute, source.primaryNameAttribute].filter(Boolean).join(",");
  const expand = nestedExpand(path.hops, byName);
  const rootQueryTemplate = `${source.entitySetName}(${id})?$select=${rootSelect}&$expand=${expand}`;
  const firstHop = path.hops[0];
  const target = byName.get(path.tables[path.tables.length - 1]?.toLowerCase());
  const targetSelect = [target?.primaryIdAttribute, target?.primaryNameAttribute].filter(Boolean).join(",");
  const minimalTemplate = path.hops.length === 1
    ? `${source.entitySetName}(${id})/${firstHop.navigationProperty}${firstHop.collectionValued ? `?$select=${targetSelect}&$top=${maxProbeRecords}` : `?$select=${targetSelect}`}`
    : `${source.entitySetName}(${id})?$expand=${expand}`;
  const stagedQueries: McpPathQueryStep[] = path.hops.map((edge, index) => {
    const from = byName.get(edge.fromTable.toLowerCase());
    const to = byName.get(edge.toTable.toLowerCase());
    const recordToken = index === 0 ? id : `<${edge.fromTable}-${from?.primaryIdAttribute ?? "record-id"}>`;
    const select = [to?.primaryIdAttribute, to?.primaryNameAttribute].filter(Boolean).join(",");
    const queryTemplate = `${from?.entitySetName ?? `${edge.fromTable}s`}(${recordToken})/${edge.navigationProperty}?$select=${select}&$top=${maxProbeRecords}`;
    return {
      index: index + 1,
      fromTable: edge.fromTable,
      toTable: edge.toTable,
      relationshipType: edge.relationshipType,
      navigationProperty: edge.navigationProperty,
      queryTemplate,
      continuation: `Use ${to?.primaryIdAttribute ?? "the target primary ID"} from a returned ${edge.toTable} row as the next record ID.`
    };
  });
  const hasCollectionBeforeEnd = path.hops.slice(0, -1).some((edge) => edge.collectionValued);
  const recommendedMode = path.hops.length === 1 ? "direct-expand" : hasCollectionBeforeEnd ? "staged-traversal" : "nested-expand";
  return {
    sourceTable: path.tables[0],
    targetTable: path.tables[path.tables.length - 1],
    pathId: path.pathId,
    pathTables: path.tables,
    recommendedMode,
    rootQueryTemplate,
    stagedQueries,
    explanation: [
      `Uses the exact metadata-verified path ${path.tables.join(" → ")}.`,
      recommendedMode === "staged-traversal"
        ? "Staged traversal is recommended because an intermediate collection may return multiple continuation records."
        : "A bounded expand is suitable for this path shape.",
      "Every navigation property and primary ID in the templates is metadata verified."
    ],
    variants: {
      minimal: minimalTemplate,
      recommended: rootQueryTemplate,
      staged: stagedQueries.map((step) => step.queryTemplate)
    },
    queryRationale: {
      reason: recommendedMode === "staged-traversal" ? "Staged retrieval avoids an expensive or ambiguous nested collection traversal." : recommendedMode === "direct-expand" ? "A direct metadata-verified navigation can be retrieved in one bounded request." : "The path is a short chain of single-valued navigations suitable for a bounded nested expand.",
      estimatedCost: recommendedMode === "staged-traversal" ? "Medium" : "Low",
      roundTrips: recommendedMode === "staged-traversal" ? stagedQueries.length : 1,
      educationalTip: path.hops.some((hop) => hop.polymorphicTargetQualified !== undefined) ? "Polymorphic relationships may require runtime target annotations when interpreting individual rows." : undefined
    },
    assumptions: [
      "Replace placeholder record IDs before execution.",
      "Generated queries prove syntax and metadata alignment, not that related records exist.",
      "Nested expands can be expensive; keep selected fields and result counts bounded."
    ]
  };
}
