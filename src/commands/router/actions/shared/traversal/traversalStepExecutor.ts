import type { CommandContext } from "../../../../context/commandContext.js";
import {
  showResultViewerForQuery,
  type ResultViewerLaunchOptions
} from "../../execution/shared/resultViewerLauncher.js";
import { logDebug, logInfo } from "../../../../../utils/logger.js";
import type {
  TraversalEnrichmentCandidate,
  TraversalExecutionPlan,
  TraversalExecutionStep,
  TraversalGraph,
  TraversalLandingContext,
  TraversalRelationshipEdge,
  TraversalStepExecutionPlan,
  TraversalStepQuery
} from "./traversalTypes.js";
import {
  buildPrimaryIdFilter,
  buildSafeSelectFields,
  quoteODataValue,
  toLookupValueFilterField
} from "../metadataAccess/metadataQueryPlanning.js";

const MAX_CONTINUATION_SCOPE_IDS = 5;

export type ExecutionResult = {
  finalResult: unknown;
  finalQueryPath: string;
  executionPlan: TraversalStepExecutionPlan;
  landing: TraversalLandingContext;
  executedQueryCount: number;
};

export function buildStepExecutionPlan(
  graph: TraversalGraph,
  itinerary: TraversalExecutionPlan,
  step: TraversalExecutionStep,
  landingContext?: TraversalLandingContext,
  startQuerySequenceNumber = 1,
  siblingExpandClause?: string
): TraversalStepExecutionPlan {
  const enrichmentCandidates = buildEnrichmentCandidates(graph, step.toEntity);

  const directExpandPlan = tryBuildExpandExecutionPlan(
    graph,
    step,
    landingContext,
    startQuerySequenceNumber,
    siblingExpandClause
  );
  if (directExpandPlan) {
    return {
      ...directExpandPlan,
      enrichmentCandidates
    };
  }

  return {
    mode: "chained_queries",
    mainMissionTarget: step.toEntity,
    queries: buildFallbackChainedQueries(
      graph,
      step,
      landingContext,
      startQuerySequenceNumber
    ),
    rationale: [
      "expand-first planning could not safely represent this step",
      "falling back to explicit chained queries"
    ],
    usedFallback: true,
    enrichmentCandidates
  };
}

export async function executeTraversalStep(
  ctx: CommandContext,
  graph: TraversalGraph,
  itinerary: TraversalExecutionPlan,
  step: TraversalExecutionStep,
  landingContext?: TraversalLandingContext,
  startQuerySequenceNumber = 1,
  viewerOptions?: ResultViewerLaunchOptions & { siblingExpandClause?: string }
): Promise<ExecutionResult> {
  const client = ctx.getClient();
  const token = await ctx.getToken(ctx.getScope());

  const executionPlan = buildStepExecutionPlan(
    graph,
    itinerary,
    step,
    landingContext,
    startQuerySequenceNumber,
    viewerOptions?.siblingExpandClause
  );

  if (!executionPlan.queries.length) {
    throw new Error("No execution queries were generated for the selected step.");
  }

  logInfo(ctx.output, `Execution strategy: ${executionPlan.mode}`);

  for (const reason of executionPlan.rationale) {
    logInfo(ctx.output, `  - ${reason}`);
  }

  if (
    landingContext &&
    landingContext.entityName === step.fromEntity &&
    Array.isArray(landingContext.ids) &&
    landingContext.ids.length > MAX_CONTINUATION_SCOPE_IDS
  ) {
    if (executionPlan.mode === "nested_expand") {
      logInfo(
        ctx.output,
        `  - Continuation scope would be limited to ${MAX_CONTINUATION_SCOPE_IDS} ${step.fromEntity} rows for safety, but restriction is skipped for nested expands to preserve valid query shape.`
      );
    } else {
      logInfo(
        ctx.output,
        `  - Continuation scope intentionally limited to the first ${MAX_CONTINUATION_SCOPE_IDS} landed ${step.fromEntity} rows for safety.`
      );
    }
  }

  let rawFinalResult: unknown = { value: [] };
  let finalResult: unknown = { value: [] };
  let finalQueryPath = executionPlan.queries[executionPlan.queries.length - 1]!.queryPath;

  for (const query of executionPlan.queries) {
    const concreteQueryPath = normalizeTraversalQueryPath(query.queryPath);

    logInfo(ctx.output, `  Query ${query.queryNumber}: GET ${concreteQueryPath}`);
    logDebug(ctx.output, `GET ${concreteQueryPath}`);

    const result = await client.get(concreteQueryPath, token);
    rawFinalResult = result;
    finalQueryPath = concreteQueryPath;
  }

  if (executionPlan.mode === "direct" || executionPlan.mode === "nested_expand") {
    const projectedRows = projectLandedRowsFromExpandResult(step, rawFinalResult);
    finalResult = buildProjectedResult(projectedRows);
  } else {
    finalResult = rawFinalResult;
  }

  const rowCount = extractRows(finalResult).length;

  logInfo(
    ctx.output,
    `Result rows after projection: ${rowCount}`
  );

  await showResultViewerForQuery(ctx, finalResult, finalQueryPath, viewerOptions);

  const landedIds = extractLandingIds(graph, step.toEntity, finalResult);

  if (viewerOptions?.siblingExpandClause) {
    if (!landedIds.length) {
      logInfo(
        ctx.output,
        `Sibling enrichment applied to current leg, but 0 rows landed at ${step.toEntity}.`
      );
    } else {
      logInfo(
        ctx.output,
        `Sibling enrichment applied to current leg. Current landing remains: ${step.toEntity} (${landedIds.length} row(s))`
      );
    }
  } else if (!landedIds.length) {
    logInfo(
      ctx.output,
      `Current landing: ${step.toEntity} (0 row(s))`
    );
  } else {
    logInfo(
      ctx.output,
      `Current landing: ${step.toEntity} (${landedIds.length} row(s))`
    );
  }

  return {
    finalResult,
    finalQueryPath,
    executionPlan,
    landing: {
      entityName: step.toEntity,
      ids: landedIds
    },
    executedQueryCount: executionPlan.queries.length
  };
}

function tryBuildExpandExecutionPlan(
  graph: TraversalGraph,
  step: TraversalExecutionStep,
  landingContext: TraversalLandingContext | undefined,
  startQuerySequenceNumber: number,
  siblingExpandClause?: string
): TraversalStepExecutionPlan | undefined {
  if (step.hopCount < 1 || step.hopCount > 2) {
    return undefined;
  }

  const rootNode = graph.entities[step.fromEntity];
  if (!rootNode) {
    return undefined;
  }

  const rootSelect = buildSafeSelectFields(rootNode);
  const expandClause = buildExpandClause(graph, step, 0, siblingExpandClause);

  if (!expandClause) {
    return undefined;
  }

  const parts: string[] = [
    `${rootNode.entitySetName}?$select=${rootSelect.join(",")}`
  ];

  const restrictedIds = getRestrictedContinuationIds(landingContext, step);

  if (restrictedIds && step.hopCount === 1) {
    const filter = buildPrimaryIdFilter(rootNode.primaryIdAttribute, restrictedIds);
    if (filter) {
      parts.push(filter);
    }
  }

  parts.push(`$expand=${expandClause}`);

  const queryPath = parts.join("&");

  return {
    mode: step.hopCount === 1 ? "direct" : "nested_expand",
    mainMissionTarget: step.toEntity,
    queries: [
      {
        queryNumber: startQuerySequenceNumber,
        queryPath,
        sourceEntity: step.fromEntity,
        targetEntity: step.toEntity,
        purpose: `complete main mission from ${step.fromEntity} to ${step.toEntity}`
      }
    ],
    rationale: [
      "expand-first execution",
      landingContext
        ? `continuing from landed ${landingContext.entityName} context`
        : "starting from route source context",
      step.hopCount === 1
        ? "single-hop route can be represented as one join-like expand"
        : "two-hop route can be represented as one nested expand"
    ],
    usedFallback: false,
    enrichmentCandidates: []
  };
}

function buildExpandClause(
  graph: TraversalGraph,
  step: TraversalExecutionStep,
  edgeIndex: number,
  siblingExpandClause?: string
): string | undefined {
  const edge = step.edges[edgeIndex];
  if (!edge) {
    return undefined;
  }

  const targetNode = graph.entities[edge.toEntity];
  if (!targetNode) {
    return undefined;
  }

  const selectFields = buildSafeSelectFields(targetNode);

  const nested = buildExpandClause(graph, step, edgeIndex + 1, siblingExpandClause);
  if (nested) {
    return `${edge.navigationPropertyName}($select=${selectFields.join(",")};$expand=${nested})`;
  }

  if (siblingExpandClause) {
    return `${edge.navigationPropertyName}($select=${selectFields.join(",")};$expand=${siblingExpandClause})`;
  }

  return `${edge.navigationPropertyName}($select=${selectFields.join(",")})`;
}

function buildFallbackChainedQueries(
  graph: TraversalGraph,
  step: TraversalExecutionStep,
  landingContext: TraversalLandingContext | undefined,
  startQuerySequenceNumber: number
): TraversalStepQuery[] {
  const queries: TraversalStepQuery[] = [];
  const rootNode = graph.entities[step.fromEntity];

  if (!rootNode) {
    return [];
  }

  const rootSelect = buildSafeSelectFields(rootNode, step.edges[0]);
  const rootParts = [`${rootNode.entitySetName}?$select=${rootSelect.join(",")}`];

  const restrictedIds = getRestrictedContinuationIds(landingContext, step);

  if (restrictedIds) {
    const filter = buildPrimaryIdFilter(rootNode.primaryIdAttribute, restrictedIds);
    if (filter) {
      rootParts.push(filter);
    }
  }

  queries.push({
    queryNumber: startQuerySequenceNumber,
    sourceEntity: step.fromEntity,
    targetEntity: step.fromEntity,
    queryPath: rootParts.join("&"),
    purpose: `seed ${step.fromEntity} records for fallback traversal`
  });

  let queryNumber = startQuerySequenceNumber;

  for (const edge of step.edges) {
    const nextNode = graph.entities[edge.toEntity];
    if (!nextNode) {
      continue;
    }

    queryNumber += 1;

    const nextSelect = buildSafeSelectFields(nextNode, undefined);
    const filterField =
      edge.direction === "oneToMany"
        ? toLookupValueFilterField(edge.referencingAttribute ?? `${edge.fromEntity}id`)
        : nextNode.primaryIdAttribute ?? `${edge.toEntity}id`;

    queries.push({
      queryNumber,
      sourceEntity: edge.fromEntity,
      targetEntity: edge.toEntity,
      queryPath: `${nextNode.entitySetName}?$select=${nextSelect.join(",")}&$filter=${filterField} eq __RUNTIME_VALUE__`,
      purpose: `fallback hop to ${edge.toEntity}`
    });
  }

  return queries;
}

function getRestrictedContinuationIds(
  landingContext: TraversalLandingContext | undefined,
  step: TraversalExecutionStep
): string[] | undefined {
  if (!landingContext || landingContext.entityName !== step.fromEntity) {
    return undefined;
  }

  if (!Array.isArray(landingContext.ids) || landingContext.ids.length === 0) {
    return undefined;
  }

  return landingContext.ids.slice(0, MAX_CONTINUATION_SCOPE_IDS);
}

function restrictedIdsCanApply(
  step: TraversalExecutionStep,
  landingContext: TraversalLandingContext | undefined
): boolean {
  return !!getRestrictedContinuationIds(landingContext, step);
}

function extractLandingIds(
  graph: TraversalGraph,
  entityName: string,
  result: unknown
): string[] {
  const node = graph.entities[entityName];
  const primaryIdAttribute = node?.primaryIdAttribute;

  if (!primaryIdAttribute) {
    return [];
  }

  const rows = extractRows(result);
  const ids = new Set<string>();

  for (const row of rows) {
    const value = row[primaryIdAttribute];
    if (typeof value === "string" && value.trim().length > 0) {
      ids.add(value.trim());
    }
  }

  return [...ids];
}

function buildEnrichmentCandidates(
  graph: TraversalGraph,
  landedEntity: string
): TraversalEnrichmentCandidate[] {
  const node = graph.entities[landedEntity];
  if (!node) {
    return [];
  }

  return node.outboundRelationships
    .filter((edge) => edge.toEntity !== landedEntity)
    .map((edge) => ({
      sourceEntity: landedEntity,
      targetEntity: edge.toEntity,
      relationshipName: edge.navigationPropertyName,
      kind: classifyEnrichmentKind(edge.toEntity),
      rationale: `available after main mission lands on ${landedEntity}`
    }))
    .slice(0, 8);
}

function classifyEnrichmentKind(entityName: string): TraversalEnrichmentCandidate["kind"] {
  const normalized = entityName.toLowerCase();

  if (
    normalized.includes("codeableconcept") ||
    normalized.includes("codeable_concept") ||
    normalized.includes("coding") ||
    normalized.includes("concept")
  ) {
    return "semantic";
  }

  if (
    normalized.includes("extension") ||
    normalized.includes("identifier") ||
    normalized.includes("detail")
  ) {
    return "sibling";
  }

  return "reference";
}

function extractRows(result: unknown): Record<string, unknown>[] {
  if (!result || typeof result !== "object") {
    return [];
  }

  const value = (result as { value?: unknown }).value;
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is Record<string, unknown> =>
      !!item && typeof item === "object" && !Array.isArray(item)
  );
}

function normalizeTraversalQueryPath(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) {
    return trimmed;
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function projectLandedRowsFromExpandResult(
  step: TraversalExecutionStep,
  result: unknown
): Record<string, unknown>[] {
  const sourceRows = extractRows(result);

  if (!sourceRows.length || !step.edges.length) {
    return sourceRows;
  }

  return walkExpandedRows(sourceRows, step.edges, 0);
}

function walkExpandedRows(
  rows: Record<string, unknown>[],
  edges: TraversalRelationshipEdge[],
  edgeIndex: number
): Record<string, unknown>[] {
  if (edgeIndex >= edges.length) {
    return rows;
  }

  const edge = edges[edgeIndex];
  if (!edge) {
    return rows;
  }

  const nextRows: Record<string, unknown>[] = [];

  for (const row of rows) {
    const expandedValue = row[edge.navigationPropertyName];

    if (Array.isArray(expandedValue)) {
      for (const item of expandedValue) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          nextRows.push(item as Record<string, unknown>);
        }
      }
    } else if (expandedValue && typeof expandedValue === "object") {
      nextRows.push(expandedValue as Record<string, unknown>);
    }
  }

  if (!nextRows.length) {
    return [];
  }

  return walkExpandedRows(nextRows, edges, edgeIndex + 1);
}

function buildProjectedResult(rows: Record<string, unknown>[]): { value: Record<string, unknown>[] } {
  return { value: rows };
}