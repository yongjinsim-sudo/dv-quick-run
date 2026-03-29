import * as vscode from "vscode";
import type { CommandContext } from "../../../context/commandContext.js";
import { logDebug, logInfo, logWarn } from "../../../../utils/logger.js";
import { runAction } from "../shared/actionRunner.js";
import {
  findEntityByEntitySetName,
  findEntityByLogicalName,
  loadEntityDefs,
  loadEntityRelationships
} from "../shared/metadataAccess.js";
import { buildPlannedTraversalRoute } from "../shared/traversal/traversalPlanGenerator.js";
import { buildTraversalRoutes } from "../shared/traversal/traversalRouteExplorer.js";
import {
  buildExecutionPlanDescription,
  buildExecutionPlanLabel,
  buildReadableTraversalRouteLabel,
  buildTraversalRouteDescription,
  buildRankedTraversalRoutes,
  getPracticalTraversalRoutes
} from "../shared/traversal/traversalSelection.js";
import { buildStepExecutionPlan, executeTraversalStep } from "../shared/traversal/traversalStepExecutor.js";
import { appendTraversalInsightActions } from "../shared/traversal/traversalInsightActions.js";
import type {
  PlannedTraversalRoute,
  TraversalEntityNode,
  TraversalExecutionPlan,
  TraversalGraph,
  TraversalRoute,
  TraversalRelationshipEdge
} from "../shared/traversal/traversalTypes.js";
import {
  clearActiveTraversalProgress,
  getActiveTraversalProgress,
  setActiveTraversalProgress
} from "../shared/traversal/traversalProgressStore.js";
import { TraversalCacheService } from "../shared/traversal/traversalCacheService.js";
import type { TraversalViewerContext } from "../shared/traversal/traversalTypes.js";
import {
  buildSuccessfulRouteBadgeText,
  getSuccessfulTraversalRouteMap,
  sortRoutesByHistoricalSuccess
} from "../shared/traversal/traversalHistoryStore.js";
import type { TraversalHistoryEntry } from "../shared/traversal/traversalHistoryStore.js";

const pickerModelCache = new WeakMap<TraversalRoute[], PreparedPickerModel>();

type PreparedPickerModel = {
  grouped: CompactRankedRouteGroup[];
  expandedGroups: CompactRankedRouteGroup[];
  defaultVisibleGroups: CompactRankedRouteGroup[];
  bestMatches: CompactRankedRouteGroup[];
  hiddenGroupCount: number;
};

type TraversalScopeSettings = {
  allowedTables: Set<string>;
  excludedTables: Set<string>;
  scopeSignature: string;
};

type TraversalEntityOption = {
  logicalName: string;
  entitySetName: string;
  primaryIdAttribute?: string;
  primaryNameAttribute?: string;
  fieldLogicalNames?: string[];
};

type RoutePickerChoice =
  | {
      choiceKind: "route";
      route: TraversalRoute;
    }
  | {
      choiceKind: "route_group";
      groupKey: string;
    }
  | {
      choiceKind: "show_all";
    };

type RouteQuickPickItem = vscode.QuickPickItem & {
  choiceKind: "route" | "route_group" | "show_all";
  route?: TraversalRoute;
  groupKey?: string;
  feasibility?: RouteFeasibility;
};

type RouteFeasibilityStatus = "selectable" | "warning" | "unselectable";

type RouteFeasibility = {
  status: RouteFeasibilityStatus;
  reason: string;
};

type RankedRouteItem = ReturnType<typeof buildRankedTraversalRoutes>[number];

type RankedRouteWithFeasibility = RankedRouteItem & {
  feasibility: RouteFeasibility;
};

type CompactRankedRouteGroup = {
  groupKey: string;
  label: string;
  hopCount: number;
  isBestMatch: boolean;
  items: RankedRouteWithFeasibility[];
};

type TraversalProgressReporter = {
  report: (message: string, increment?: number) => void;
};

type FindPathToTableDeps = {
  loadEntityOptions: (ctx: CommandContext) => Promise<TraversalEntityOption[]>;
  pickSourceEntity: (options: TraversalEntityOption[]) => Promise<TraversalEntityOption | undefined>;
  pickTargetEntity: (
    options: TraversalEntityOption[],
    source: TraversalEntityOption
  ) => Promise<TraversalEntityOption | undefined>;
  buildTraversalGraph: (
    ctx: CommandContext,
    source: TraversalEntityOption,
    target: TraversalEntityOption
  ) => Promise<TraversalGraph>;
  pickTraversalRoute: (
    graph: TraversalGraph,
    routes: TraversalRoute[]
  ) => Promise<TraversalRoute | undefined>;
  pickExecutionPlan: (
    graph: TraversalGraph,
    plannedRoute: PlannedTraversalRoute
  ) => Promise<TraversalExecutionPlan | undefined>;
  executeFirstStep: (
    ctx: CommandContext,
    graph: TraversalGraph,
    route: TraversalRoute,
    itinerary: TraversalExecutionPlan,
    progress?: TraversalProgressReporter
  ) => Promise<void>;
  showInfoMessage: (message: string) => Thenable<unknown> | void;
};

function buildTraversalSessionId(): string {
  return `trv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildTraversalDebugLabel(
  sourceEntity: string,
  targetEntity: string,
  routeId: string,
  environmentKey: string
): string {
  return `${sourceEntity}->${targetEntity}:${routeId}:${environmentKey}`;
}

function buildTraversalViewerContext(args: {
  sessionId: string;
  itinerary: TraversalExecutionPlan;
  currentStepIndex: number;
  currentEntityName?: string;
  requiredCarryField?: string;
}): TraversalViewerContext {
  const nextStep = args.itinerary.steps[args.currentStepIndex + 1];

  return {
    openedFrom: "guidedTraversal",
    traversalSessionId: args.sessionId,
    legIndex: args.currentStepIndex,
    legCount: args.itinerary.steps.length,
    hasNextLeg: !!nextStep,
    nextLegLabel: nextStep?.stageLabel,
    nextLegEntityName: nextStep?.toEntity,
    requiredCarryField: args.requiredCarryField,
    currentEntityName: args.currentEntityName,
    isFinalLeg: !nextStep
  };
}

function matchesPattern(entity: string, pattern: string): boolean {
  if (!pattern) {
    return false;
  }

  if (!pattern.includes("*")) {
    return entity === pattern;
  }

  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const regexPattern = "^" + escaped.replace(/\*/g, ".*") + "$";
  const regex = new RegExp(regexPattern, "i");

  return regex.test(entity);
}

function matchesAnyPattern(entity: string, patterns?: string[]): boolean {
  if (!patterns || patterns.length === 0) {
    return false;
  }
  return patterns.some(p => matchesPattern(entity, p));
}

function mapManyToOneEdges(
  logicalName: string,
  relationships: Awaited<ReturnType<typeof loadEntityRelationships>>
): TraversalRelationshipEdge[] {
  return relationships.manyToOne
    .filter((rel) => !!rel.navigationPropertyName && !!rel.referencedEntity)
    .map((rel) => ({
      fromEntity: logicalName,
      toEntity: rel.referencedEntity ?? "",
      navigationPropertyName: rel.navigationPropertyName,
      relationshipType: "ManyToOne",
      direction: "manyToOne" as const,
      schemaName: rel.schemaName,
      referencingAttribute: rel.referencingAttribute
    }));
}

function mapOneToManyEdges(
  logicalName: string,
  relationships: Awaited<ReturnType<typeof loadEntityRelationships>>
): TraversalRelationshipEdge[] {
  return relationships.oneToMany
    .filter((rel) => !!rel.navigationPropertyName && !!rel.referencingEntity)
    .map((rel) => ({
      fromEntity: logicalName,
      toEntity: rel.referencingEntity ?? "",
      navigationPropertyName: rel.navigationPropertyName,
      relationshipType: "OneToMany",
      direction: "oneToMany" as const,
      schemaName: rel.schemaName,
      referencingAttribute: rel.referencingAttribute
    }));
}

function mapManyToManyEdges(
  logicalName: string,
  relationships: Awaited<ReturnType<typeof loadEntityRelationships>>
): TraversalRelationshipEdge[] {
  return relationships.manyToMany
    .filter((rel) => !!rel.navigationPropertyName && !!rel.targetEntity)
    .map((rel) => ({
      fromEntity: logicalName,
      toEntity: rel.targetEntity ?? "",
      navigationPropertyName: rel.navigationPropertyName,
      relationshipType: "ManyToMany",
      direction: "manyToMany" as const,
      schemaName: rel.schemaName
    }));
}

function buildTraversalNode(
  option: TraversalEntityOption,
  relationships: Awaited<ReturnType<typeof loadEntityRelationships>>
): TraversalEntityNode {
  return {
    logicalName: option.logicalName,
    entitySetName: option.entitySetName,
    primaryIdAttribute: option.primaryIdAttribute,
    primaryNameAttribute: option.primaryNameAttribute,
    fieldLogicalNames: option.fieldLogicalNames ?? [],
    outboundRelationships: [
      ...mapManyToOneEdges(option.logicalName, relationships),
      ...mapOneToManyEdges(option.logicalName, relationships),
      ...mapManyToManyEdges(option.logicalName, relationships)
    ]
  };
}

async function loadTraversalEntityOptions(
  ctx: CommandContext
): Promise<TraversalEntityOption[]> {
  const client = ctx.getClient();
  const token = await ctx.getToken(ctx.getScope());
  const defs = await loadEntityDefs(ctx, client, token);

  return defs
    .map((def) => ({
      logicalName: def.logicalName,
      entitySetName: def.entitySetName,
      primaryIdAttribute: def.primaryIdAttribute,
      primaryNameAttribute: def.primaryNameAttribute,
      fieldLogicalNames: []
    }))
    .sort((left, right) => left.logicalName.localeCompare(right.logicalName));
}

async function pickEntityOption(
  title: string,
  placeHolder: string,
  options: TraversalEntityOption[]
): Promise<TraversalEntityOption | undefined> {
  const picked = await vscode.window.showQuickPick(
    options.map((option) => ({
      label: option.logicalName,
      description: option.entitySetName,
      option
    })),
    {
      title,
      placeHolder,
      ignoreFocusOut: true,
      matchOnDescription: true
    }
  );

  return picked?.option;
}

async function buildFocusedTraversalGraph(
  ctx: CommandContext,
  source: TraversalEntityOption,
  target: TraversalEntityOption
): Promise<TraversalGraph> {
  const client = ctx.getClient();
  const token = await ctx.getToken(ctx.getScope());
  const defs = await loadEntityDefs(ctx, client, token);

  const entities: Record<string, TraversalEntityNode> = {};

  async function ensureEntityNode(logicalNameOrEntitySetName: string): Promise<void> {
    const byLogical = findEntityByLogicalName(defs, logicalNameOrEntitySetName);
    const byEntitySet = findEntityByEntitySetName(defs, logicalNameOrEntitySetName);
    const def = byLogical ?? byEntitySet;

    if (!def) {
      return;
    }

    const key = def.logicalName.trim().toLowerCase();
    if (entities[key]) {
      return;
    }

    const relationships = await loadEntityRelationships(ctx, client, token, def.logicalName);
    entities[key] = buildTraversalNode(
      {
        logicalName: def.logicalName,
        entitySetName: def.entitySetName,
        primaryIdAttribute: def.primaryIdAttribute,
        primaryNameAttribute: def.primaryNameAttribute,
        fieldLogicalNames: []
      },
      relationships
    );
  }

  await ensureEntityNode(source.logicalName);
  await ensureEntityNode(target.logicalName);

  const queue = [source.logicalName, target.logicalName];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    const normalized = current.trim().toLowerCase();

    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    await ensureEntityNode(current);

    const node = entities[normalized];
    if (!node) {
      continue;
    }

    for (const edge of node.outboundRelationships) {
      if (!seen.has(edge.toEntity.toLowerCase())) {
        await ensureEntityNode(edge.toEntity);
      }
    }
  }

  return { entities };
}

function normalizeTraversalTableName(value: string): string {
  return value.trim().toLowerCase();
}

function getTraversalListSetting(settingName: string): string[] {
  const value = vscode.workspace
    .getConfiguration("dvQuickRun")
    .get<unknown[]>(settingName, []);

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => normalizeTraversalTableName(item))
    .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index);
}

function loadTraversalScopeSettings(ctx: CommandContext): TraversalScopeSettings {
  const allowedTables = new Set(getTraversalListSetting("traversal.allowedTables"));
  const excludedTables = new Set(getTraversalListSetting("traversal.excludedTables"));

  logInfo(
    ctx.output,
    `[Traversal] Scope applied: allowed=${allowedTables.size} patterns; excluded=${excludedTables.size} patterns`
  );

  if (allowedTables.size > 0) {
    logDebug(
      ctx.output,
      `[Traversal] Allowed patterns: ${Array.from(allowedTables).join(", ")}`
    );
  }

  if (excludedTables.size > 0) {
    logDebug(
      ctx.output,
      `[Traversal] Excluded patterns: ${Array.from(excludedTables).join(", ")}`
    );
  }

  if ([...excludedTables].some((p) => p.trim() === "*")) {
    logWarn(
      ctx.output,
      '[Traversal] Warning: excludedTables contains "*" — all tables will be excluded.'
    );
  }

  return {
    allowedTables,
    excludedTables,
    scopeSignature: JSON.stringify({
      allowedTables: [...allowedTables].sort(),
      excludedTables: [...excludedTables].sort()
    })
  };
}

function isTraversalEntityInScope(
  logicalName: string,
  sourceEntity: string,
  targetEntity: string,
  settings: TraversalScopeSettings
): boolean {
  const normalized = normalizeTraversalTableName(logicalName);

  // Always allow source + target
  if (normalized === sourceEntity || normalized === targetEntity) {
    return true;
  }

  const allowedPatterns = [...settings.allowedTables];
  const excludedPatterns = [...settings.excludedTables];

  // Allowed (inclusion gate)
  if (allowedPatterns.length > 0) {
    if (!matchesAnyPattern(normalized, allowedPatterns)) {
      return false;
    }
  }

  // Excluded (veto)
  if (matchesAnyPattern(normalized, excludedPatterns)) {
    return false;
  }

  return true;
}

function applyTraversalScopeToGraph(
  graph: TraversalGraph,
  sourceEntity: string,
  targetEntity: string,
  settings: TraversalScopeSettings
): TraversalGraph {
  const normalizedSource = normalizeTraversalTableName(sourceEntity);
  const normalizedTarget = normalizeTraversalTableName(targetEntity);
  const scopedEntities: Record<string, TraversalEntityNode> = {};

  for (const [logicalName, node] of Object.entries(graph.entities)) {
    if (!isTraversalEntityInScope(logicalName, normalizedSource, normalizedTarget, settings)) {
      continue;
    }

    scopedEntities[logicalName] = {
      ...node,
      outboundRelationships: node.outboundRelationships.filter((edge) =>
        isTraversalEntityInScope(edge.toEntity, normalizedSource, normalizedTarget, settings)
      )
    };
  }

  return {
    entities: scopedEntities
  };
}

function buildCompactRouteLabel(route: TraversalRoute): string {
  return `${route.entities.join(" -> ")} (${route.hopCount} ${route.hopCount === 1 ? "hop" : "hops"})`;
}

function humanizeVariantHop(raw: string): string {
  let friendly = raw
    .replace(/^msemr_/i, "")
    .replace(/^bu_/i, "")
    .replace(/^msa_/i, "")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();

  const replacements: Array<[RegExp, string]> = [
    [/primarycontactid/gi, "primary contact"],
    [/contact customer accounts/gi, "customer accounts"],
    [/patient identifier/gi, "patient identifier"],
    [/authorcareplan contact/gi, "author care plan contact"],
    [/careplanactivity/gi, "care plan activity"],
    [/care plan activity/gi, "care plan activity"],
    [/careplan/gi, "care plan"],
    [/account primary contact/gi, "account primary contact"],
    [/managingpartnerid/gi, "managing partner"],
    [/managing organization/gi, "managing organization"],
    [/qualification1issuer/gi, "qualification issuer"],
    [/task/gi, "task"]
  ];

  for (const [pattern, value] of replacements) {
    friendly = friendly.replace(pattern, value);
  }

  return friendly.replace(/\s+/g, " ").trim().toLowerCase();
}

function buildVariantChainLabel(route: TraversalRoute): string {
  const hops = route.edges.map((edge) => humanizeVariantHop(edge.navigationPropertyName));
  return `via ${hops.join(" -> ")}`;
}

function getVariantDisplaySection(
  item: RankedRouteWithFeasibility,
  successMap: Map<string, TraversalHistoryEntry>
): string {
  const routeHistory = successMap.get(item.route.routeId);

  if (routeHistory) {
    return "Proven routes";
  }

  return getVariantConfidenceSection(item);
}

function getVariantConfidenceSection(
  item: ReturnType<typeof buildRankedTraversalRoutes>[number]
): string {
  if (item.route.confidence === "high" && item.score >= 0) {
    return "High confidence";
  }

  if (item.score >= 0) {
    return "Medium confidence";
  }

  return "Low confidence";
}

function getFeasibilityRank(status: RouteFeasibilityStatus): number {
  switch (status) {
    case "selectable":
      return 3;
    case "warning":
      return 2;
    default:
      return 1;
  }
}

function buildFeasibilityPrefix(status: RouteFeasibilityStatus): string {
  switch (status) {
    case "selectable":
      return "✓";
    case "warning":
      return "⚠";
    default:
      return "✕";
  }
}

function getBlockedRuntimePlaceholderReason(queryPath: string): string {
  if (queryPath.includes("__RUNTIME_VALUE__")) {
    return "Requires unsupported runtime value propagation";
  }

  return "This route cannot be executed safely yet";
}

function assessExecutionPlanFeasibility(
  graph: TraversalGraph,
  plan: TraversalExecutionPlan
): RouteFeasibility {
  const firstStep = plan.steps[0];

  if (!firstStep) {
    return {
      status: "unselectable",
      reason: "Execution plan did not produce a runnable first step"
    };
  }

  const stepPlan = buildStepExecutionPlan(graph, plan, firstStep, undefined, 1);

  if (!stepPlan.queries.length) {
    return {
      status: "unselectable",
      reason: "Execution plan did not produce runnable queries"
    };
  }

  const blockedQuery = stepPlan.queries.find((query) =>
    query.queryPath.includes("__RUNTIME_VALUE__")
  );

  if (blockedQuery) {
    return {
      status: "unselectable",
      reason: getBlockedRuntimePlaceholderReason(blockedQuery.queryPath)
    };
  }

  if (stepPlan.usedFallback || stepPlan.mode === "chained_queries") {
    return {
      status: "warning",
      reason: "Runs via fallback chained queries"
    };
  }

  if (stepPlan.mode === "nested_expand" || firstStep.hopCount > 1) {
    return {
      status: "warning",
      reason: "Runnable, but uses a more complex nested expand"
    };
  }

  return {
    status: "selectable",
    reason: "Runnable with a direct first step"
  };
}

function assessRouteFeasibility(
  graph: TraversalGraph,
  item: RankedRouteItem
): RouteFeasibility {
  const plannedRoute = buildPlannedTraversalRoute(item.route);
  const planFeasibilities = plannedRoute.candidatePlans.map((plan) =>
    assessExecutionPlanFeasibility(graph, plan)
  );

  const bestPlan = [...planFeasibilities].sort(
    (left, right) => getFeasibilityRank(right.status) - getFeasibilityRank(left.status)
  )[0];

  if (!bestPlan) {
    return {
      status: "unselectable",
      reason: "No runnable itinerary was generated"
    };
  }

  if (bestPlan.status === "selectable") {
    if (item.route.confidence === "high" && item.score >= 0) {
      return bestPlan;
    }

    return {
      status: "warning",
      reason: "Runnable, but this route is lower confidence"
    };
  }

  return bestPlan;
}

function summarizeGroupFeasibility(
  items: RankedRouteWithFeasibility[]
): Record<RouteFeasibilityStatus, number> {
  return items.reduce<Record<RouteFeasibilityStatus, number>>(
    (summary, item) => {
      summary[item.feasibility.status] += 1;
      return summary;
    },
    {
      selectable: 0,
      warning: 0,
      unselectable: 0
    }
  );
}

function buildGroupFeasibilityPrefix(items: RankedRouteWithFeasibility[]): string {
  const summary = summarizeGroupFeasibility(items);

  if (summary.selectable > 0 && summary.unselectable === 0 && summary.warning === 0) {
    return buildFeasibilityPrefix("selectable");
  }

  if (summary.selectable === 0 && summary.warning === 0) {
    return buildFeasibilityPrefix("unselectable");
  }

  return buildFeasibilityPrefix("warning");
}

function buildGroupFeasibilityDetail(items: RankedRouteWithFeasibility[]): string {
  const summary = summarizeGroupFeasibility(items);
  const parts = [
    `${items.length} variant${items.length === 1 ? "" : "s"}`,
    `${summary.selectable} ready`,
    `${summary.warning} caution`,
    `${summary.unselectable} blocked`
  ];

  return parts.join(" • ");
}

function hasEntityLoop(route: TraversalRoute): boolean {
  const seen = new Set<string>();

  for (const entity of route.entities) {
    const normalized = entity.trim().toLowerCase();
    if (seen.has(normalized)) {
      return true;
    }

    seen.add(normalized);
  }

  return false;
}

function isLikelyNoisyFallbackGroup(group: CompactRankedRouteGroup): boolean {
  return group.items.every((item) => item.feasibility.status !== "selectable")
    && (group.hopCount > 3 || group.items.every((item) => hasEntityLoop(item.route)));
}

function buildDefaultVisibleRouteGroups(
  groups: CompactRankedRouteGroup[]
): { visibleGroups: CompactRankedRouteGroup[]; hiddenGroupCount: number } {
  const readyGroups = groups.filter((group) =>
    group.items.some((item) => item.feasibility.status === "selectable")
  );

  const fallbackGroups = groups.filter((group) =>
    group.items.some((item) => item.feasibility.status === "warning")
    && group.items.every((item) => item.feasibility.status !== "unselectable")
    && group.items.every((item) => item.feasibility.status !== "selectable")
  );

  const preferredFallbackGroups = fallbackGroups.filter((group) => !isLikelyNoisyFallbackGroup(group));
  const noisyFallbackGroups = fallbackGroups.filter((group) => isLikelyNoisyFallbackGroup(group));
  const fallbackBudget = readyGroups.length > 0 ? 5 : 8;
  const visibleFallbackGroups = preferredFallbackGroups.slice(0, fallbackBudget);

  const visibleGroups = [
    ...readyGroups,
    ...visibleFallbackGroups
  ];

  const hiddenGroupCount = groups.length - visibleGroups.length;

  if (visibleGroups.length > 0 || noisyFallbackGroups.length === 0) {
    return {
      visibleGroups,
      hiddenGroupCount
    };
  }

  const fallbackOnlyGroups = [...preferredFallbackGroups, ...noisyFallbackGroups].slice(0, fallbackBudget);

  return {
    visibleGroups: fallbackOnlyGroups,
    hiddenGroupCount: groups.length - fallbackOnlyGroups.length
  };
}

function buildExpandedRouteGroups(groups: CompactRankedRouteGroup[]): CompactRankedRouteGroup[] {
  return groups.filter((group) =>
    group.items.some((item) => item.feasibility.status !== "unselectable")
  );
}

function buildShowMoreRouteDetail(hiddenGroupCount: number): string {
  return hiddenGroupCount > 0
    ? `Reveal ${hiddenGroupCount} more caution-only or long/indirect routes.`
    : "Browse more discovered routes.";
}

function countEntityRevisits(route: TraversalRoute): number {
  const seen = new Set<string>();
  let revisits = 0;

  for (const entity of route.entities) {
    const normalized = entity.trim().toLowerCase();
    if (seen.has(normalized)) {
      revisits += 1;
      continue;
    }

    seen.add(normalized);
  }

  return revisits;
}

function countSystemishEntities(route: TraversalRoute): number {
  const noisyEntities = new Set([
    "activitypointer",
    "connection",
    "duplicaterecord",
    "postfollow",
    "postregarding",
    "postrole",
    "principalobjectattributeaccess",
    "processsession",
    "syncerror",
    "slakpinstance",
    "systemuser",
    "team",
    "businessunit",
    "transactioncurrency",
    "knowledgearticle",
    "knowledgebaserecord",
    "sharepointdocumentlocation",
    "recurringappointmentmaster"
  ]);

  return route.entities.reduce((count, entity) => {
    return count + (noisyEntities.has(entity.trim().toLowerCase()) ? 1 : 0);
  }, 0);
}

function buildVariantDisplayScore(item: RankedRouteWithFeasibility): number {
  const feasibilityBase =
    item.feasibility.status === "selectable"
      ? 1000
      : item.feasibility.status === "warning"
        ? 500
        : 0;

  const confidenceBonus =
    item.route.confidence === "high"
      ? 120
      : item.route.confidence === "medium"
        ? 60
        : 0;

  const hopPenalty = item.route.hopCount * 25;
  const revisitPenalty = countEntityRevisits(item.route) * 120;
  const noisyEntityPenalty = countSystemishEntities(item.route) * 35;

  return feasibilityBase + confidenceBonus + item.score - hopPenalty - revisitPenalty - noisyEntityPenalty;
}

function buildVariantFingerprint(route: TraversalRoute): string {
  const edgePath = route.edges
    .map((edge) => `${edge.fromEntity}->${edge.toEntity}:${edge.navigationPropertyName}`)
    .join("|");

  return `${route.sourceEntity}|${route.targetEntity}|${route.hopCount}|${edgePath}`;
}

function dedupeAndRankGroupVariants(
  items: RankedRouteWithFeasibility[]
): RankedRouteWithFeasibility[] {
  const deduped = new Map<string, RankedRouteWithFeasibility>();

  for (const item of items) {
    const key = buildVariantFingerprint(item.route);
    const existing = deduped.get(key);

    if (!existing) {
      deduped.set(key, item);
      continue;
    }

    if (buildVariantDisplayScore(item) > buildVariantDisplayScore(existing)) {
      deduped.set(key, item);
    }
  }

  return [...deduped.values()].sort((left, right) => {
    const scoreDiff = buildVariantDisplayScore(right) - buildVariantDisplayScore(left);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    if (left.route.hopCount !== right.route.hopCount) {
      return left.route.hopCount - right.route.hopCount;
    }

    return left.route.routeId.localeCompare(right.route.routeId);
  });
}

function buildDefaultVisibleVariants(
  items: RankedRouteWithFeasibility[]
): { visibleItems: RankedRouteWithFeasibility[]; hiddenCount: number } {
  const ranked = dedupeAndRankGroupVariants(items);
  const ready = ranked.filter((item) => item.feasibility.status === "selectable");
  const caution = ranked.filter((item) => item.feasibility.status === "warning");

  const visibleItems =
    ready.length > 0
      ? [...ready.slice(0, 3), ...caution.slice(0, 2)]
      : caution.slice(0, 5);

  return {
    visibleItems,
    hiddenCount: Math.max(0, ranked.length - visibleItems.length)
  };
}

function buildCompactRouteGroups(
  graph: TraversalGraph,
  ranked: ReturnType<typeof buildRankedTraversalRoutes>
): CompactRankedRouteGroup[] {
  const groups = new Map<string, CompactRankedRouteGroup>();

  for (const item of ranked) {
    const itemWithFeasibility: RankedRouteWithFeasibility = {
      ...item,
      feasibility: assessRouteFeasibility(graph, item)
    };

    const label = buildCompactRouteLabel(item.route);
    const existing = groups.get(label);

    if (existing) {
      existing.items.push(itemWithFeasibility);
      existing.isBestMatch = existing.isBestMatch || item.isBestMatch;
      continue;
    }

    groups.set(label, {
      groupKey: label,
      label,
      hopCount: item.route.hopCount,
      isBestMatch: item.isBestMatch,
      items: [itemWithFeasibility]
    });
  }

  return [...groups.values()].sort((left, right) => {
    const leftTopScore = left.items[0]?.score ?? 0;
    const rightTopScore = right.items[0]?.score ?? 0;

    if (leftTopScore !== rightTopScore) {
      return rightTopScore - leftTopScore;
    }

    if (left.hopCount !== right.hopCount) {
      return left.hopCount - right.hopCount;
    }

    return left.label.localeCompare(right.label);
  });
}

async function pickTraversalRouteFromQuickPick(
  ctx: CommandContext,
  graph: TraversalGraph,
  routes: TraversalRoute[]
): Promise<TraversalRoute | undefined> {
  const sourceEntity = routes[0]?.sourceEntity;
  const targetEntity = routes[0]?.targetEntity;

  const successMap =
    sourceEntity && targetEntity
      ? getSuccessfulTraversalRouteMap(ctx, sourceEntity, targetEntity)
      : new Map();

  const orderedRoutes = sortRoutesByHistoricalSuccess(routes, successMap);

  if (successMap.size > 0 && sourceEntity && targetEntity) {
    logInfo(
      ctx.output,
      `Traversal history: found ${successMap.size} previously successful route(s) for ${sourceEntity} -> ${targetEntity}.`
    );
  }

  let prepared = pickerModelCache.get(orderedRoutes);

  if (!prepared) {
    const ranked = buildRankedTraversalRoutes(orderedRoutes);
    const grouped = buildCompactRouteGroups(graph, ranked);
    const expandedGroups = buildExpandedRouteGroups(grouped);

    const { visibleGroups: defaultVisibleGroups, hiddenGroupCount } =
      buildDefaultVisibleRouteGroups(expandedGroups);

    const bestMatches = defaultVisibleGroups.filter((item) => item.isBestMatch);

    prepared = {
      grouped,
      expandedGroups,
      defaultVisibleGroups,
      bestMatches,
      hiddenGroupCount
    };

      pickerModelCache.set(orderedRoutes, prepared);
  }

  const showingBestMatchOnly = prepared.bestMatches.length > 0;
  const initialGroups =
    prepared.bestMatches.length > 0
      ? prepared.bestMatches
      : prepared.defaultVisibleGroups;

  const pickFromList = async (
    title: string,
    placeHolder: string,
    items: CompactRankedRouteGroup[],
    includeShowAll: boolean
  ): Promise<RoutePickerChoice | undefined> => {
    const picks: RouteQuickPickItem[] = items.map((item) => {
      const singleRoute = item.items.length === 1 ? item.items[0] : undefined;
      const prefix = singleRoute
        ? buildFeasibilityPrefix(singleRoute.feasibility.status)
        : buildGroupFeasibilityPrefix(item.items);

      const singleRouteHistory = singleRoute ? successMap.get(singleRoute.route.routeId) : undefined;
      const successBadge = buildSuccessfulRouteBadgeText(singleRouteHistory);

      const description = successBadge
        ? "⭐ Previously successful"
        : item.isBestMatch
          ? "Suggested"
          : undefined;

      return {
        choiceKind: item.items.length === 1 ? "route" : "route_group",
        route: singleRoute?.route,
        groupKey: item.groupKey,
        feasibility: singleRoute?.feasibility,
        label: `${prefix} ${item.label}`,
        description,
        detail: singleRoute
          ? singleRoute.feasibility.reason
          : buildGroupFeasibilityDetail(item.items)
      };
    });

    if (includeShowAll) {
      picks.push({
        choiceKind: "show_all",
        label: "Show more routes…",
        description: "Browse more practical routes",
        detail: buildShowMoreRouteDetail(prepared.hiddenGroupCount)
      });
    }

    while (true) {
      const selected = await vscode.window.showQuickPick(picks, {
        title,
        placeHolder,
        ignoreFocusOut: true,
        matchOnDescription: true,
        matchOnDetail: true
      });

      if (!selected) {
        return undefined;
      }

      if (selected.choiceKind === "route" && selected.route) {
        if (selected.feasibility?.status === "unselectable") {
          await vscode.window.showWarningMessage(
            `This route variant is not runnable yet: ${selected.feasibility.reason}`
          );
          continue;
        }

        return {
          choiceKind: "route",
          route: selected.route
        };
      }

      if (selected.choiceKind === "route_group" && selected.groupKey) {
        return {
          choiceKind: "route_group",
          groupKey: selected.groupKey
        };
      }

      return {
        choiceKind: "show_all"
      };
    }
  };

  const pickVariantForGroup = async (
    group: CompactRankedRouteGroup
  ): Promise<TraversalRoute | undefined> => {
    if (group.items.length === 1) {
      return group.items[0]?.feasibility.status === "unselectable"
        ? undefined
        : group.items[0]?.route;
    }

    const rankedItems = dedupeAndRankGroupVariants(group.items);
    const { visibleItems, hiddenCount } = buildDefaultVisibleVariants(rankedItems);

    const buildVariantPicks = (
      items: RankedRouteWithFeasibility[],
      includeShowMore: boolean
    ): Array<
      vscode.QuickPickItem & {
        route?: TraversalRoute;
        feasibility?: RouteFeasibility;
        choiceKind?: "variant" | "show_more_variants";
      }
    > => {
      const picks: Array<
        vscode.QuickPickItem & {
          route?: TraversalRoute;
          feasibility?: RouteFeasibility;
          choiceKind?: "variant" | "show_more_variants";
        }
      > = [];

      let lastSection: string | undefined;

      for (const item of items) {
        const section = getVariantDisplaySection(item, successMap);

        if (section !== lastSection) {
          picks.push({
            kind: vscode.QuickPickItemKind.Separator,
            label: section
          });
          lastSection = section;
        }

        const routeHistory = successMap.get(item.route.routeId);
        const successBadge = buildSuccessfulRouteBadgeText(routeHistory);

        picks.push({
          choiceKind: "variant",
          label: `${buildFeasibilityPrefix(item.feasibility.status)} ${buildVariantChainLabel(item.route)}`,
          description: successBadge ? `⭐ ${successBadge}` : undefined,
          detail: undefined,
          route: item.route,
          feasibility: item.feasibility
        });
      }

      if (includeShowMore && hiddenCount > 0) {
        picks.push({
          choiceKind: "show_more_variants",
          label: "Show more variants…",
          description: `${hiddenCount} more variant${hiddenCount === 1 ? "" : "s"}`,
          detail: "Reveal lower-ranked variants for this route family."
        });
      }

      return picks;
    };

    const chooseFromPicks = async (
      items: RankedRouteWithFeasibility[],
      includeShowMore: boolean,
      placeHolder: string
    ): Promise<TraversalRoute | "show_more" | undefined> => {
      while (true) {
        const selected = await vscode.window.showQuickPick(
          buildVariantPicks(items, includeShowMore),
          {
            title: `DV Quick Run: ${group.label}`,
            placeHolder,
            ignoreFocusOut: true,
            matchOnDescription: true,
            matchOnDetail: true
          }
        );

        if (!selected) {
          return undefined;
        }

        if (selected.choiceKind === "show_more_variants") {
          return "show_more";
        }

        if (selected.feasibility?.status === "unselectable") {
          await vscode.window.showWarningMessage(
            `This variant is not runnable yet: ${selected.feasibility.reason}`
          );
          continue;
        }

        return selected.route;
      }
    };

    const firstSelection = await chooseFromPicks(
      visibleItems,
      hiddenCount > 0,
      "Choose the best-ranked relationship chain to use"
    );

    if (!firstSelection || firstSelection !== "show_more") {
      return firstSelection;
    }

    const fullSelection = await chooseFromPicks(
      rankedItems,
      false,
      "Choose from all variants in this route family"
    );

    return fullSelection === "show_more" ? undefined : fullSelection;
  };

  const firstPick = await pickFromList(
    "DV Quick Run: Best Match",
    showingBestMatchOnly
      ? "Here's what I think you want"
      : "Choose a route",
    initialGroups,
    showingBestMatchOnly
  );

  if (!firstPick) {
    return undefined;
  }

  if (firstPick.choiceKind === "route") {
    return firstPick.route;
  }

  if (firstPick.choiceKind === "route_group") {
    const group = prepared.grouped.find((item) => item.groupKey === firstPick.groupKey);
    return group ? pickVariantForGroup(group) : undefined;
  }

  const fullPick = await pickFromList(
    "DV Quick Run: All Routes",
    "Choose from all discovered routes",
    prepared.expandedGroups,
    false
  );

  if (!fullPick) {
    return undefined;
  }

  if (fullPick.choiceKind === "route") {
    return fullPick.route;
  }

  if (fullPick.choiceKind === "route_group") {
    const group = prepared.grouped.find((item) => item.groupKey === fullPick.groupKey);
    return group ? pickVariantForGroup(group) : undefined;
  }

  return undefined;
}

async function pickExecutionPlanFromQuickPick(
  graph: TraversalGraph,
  plannedRoute: PlannedTraversalRoute
): Promise<TraversalExecutionPlan | undefined> {
  const picks = plannedRoute.candidatePlans.map((plan) => {
    const feasibility = assessExecutionPlanFeasibility(graph, plan);
    const prefix = buildFeasibilityPrefix(feasibility.status);

    return {
      label: `${prefix} ${buildExecutionPlanLabel(plan)}`,
      description: plan.recommended ? `${plan.rationale} • recommended` : plan.rationale,
      detail: `${buildExecutionPlanDescription(plan)} • ${feasibility.reason}`,
      plan,
      feasibility
    };
  });

  while (true) {
    const picked = await vscode.window.showQuickPick(picks, {
      title: "DV Quick Run: Choose Itinerary",
      placeHolder: "Choose how the route should be dissected",
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (!picked) {
      return undefined;
    }

    if (picked.feasibility.status === "unselectable") {
      await vscode.window.showWarningMessage(
        `This itinerary is not runnable yet: ${picked.feasibility.reason}`
      );
      continue;
    }

    return picked.plan;
  }
}

async function executeFirstStepDefault(
  ctx: CommandContext,
  graph: TraversalGraph,
  route: TraversalRoute,
  itinerary: TraversalExecutionPlan,
  progress?: TraversalProgressReporter
): Promise<void> {
  const firstStep = itinerary.steps[0];

  if (!firstStep) {
    return;
  }

  clearActiveTraversalProgress();

  logInfo(ctx.output, "Find Path to Table");
  logInfo(
    ctx.output,
    `Selected route: ${buildReadableTraversalRouteLabel(route)} (${buildTraversalRouteDescription(route)})`
  );
  logInfo(ctx.output, `Selected itinerary: ${itinerary.label}`);
  logInfo(ctx.output, `Executing Step 1/${itinerary.steps.length}: ${firstStep.stageLabel}`);
  logInfo(ctx.output, `Main mission target: ${firstStep.toEntity}`);
  logInfo(ctx.output, "Queries executed:");

  progress?.report(`Running step 1 of ${itinerary.steps.length}: ${firstStep.stageLabel}`, 70);

  const landedNodeForViewer = graph.entities[firstStep.toEntity];
  const activeEnvironment = ctx.envContext.getActiveEnvironment();
  const environmentKey = activeEnvironment?.name ?? "default";
  const sessionId = buildTraversalSessionId();
  const debugLabel = buildTraversalDebugLabel(
    route.sourceEntity,
    route.targetEntity,
    route.routeId,
    environmentKey
  );

  const execution = await executeTraversalStep(
    ctx,
    graph,
    itinerary,
    firstStep,
    undefined,
    1,
    {
      traversalContext: buildTraversalViewerContext({
        sessionId,
        itinerary,
        currentStepIndex: 0,
        currentEntityName: firstStep.toEntity,
        requiredCarryField: landedNodeForViewer?.primaryIdAttribute
      })
    }
  );

  if (execution.landing.ids.length === 0) {
    logInfo(
      ctx.output,
      `This variant did not produce usable data at ${firstStep.toEntity}. Try another variant.`
    );
    return;
  }

  logInfo(ctx.output, `Step 1/${itinerary.steps.length} complete: landed on ${execution.landing.entityName}`);

  const landedNode = graph.entities[execution.landing.entityName];
  if (landedNode?.primaryIdAttribute) {
    logInfo(ctx.output, `PKs: ${landedNode.primaryIdAttribute}`);
  }

  const insightActions = appendTraversalInsightActions({
    route,
    itinerary,
    step: firstStep,
    executionPlan: execution.executionPlan,
    landing: execution.landing
  });

  if (insightActions.length) {
    logInfo(ctx.output, "Enhance results (optional):");

    for (const action of insightActions) {
      logInfo(ctx.output, `  - ${action.title} — ${action.description}`);
    }

    logInfo(
      ctx.output,
      "These actions apply to the current leg only. Continue Traversal carries only traversal continuation state."
    );
  }

  const traversalProgress = {
    sessionId,
    debugLabel,
    route,
    itinerary,
    currentStepIndex: 0,
    graph,
    lastLanding: execution.landing,
    currentStepInsightActions: insightActions,
    nextQuerySequenceNumber: 1 + execution.executedQueryCount
  };

  progress?.report(`Step 1 complete: landed on ${execution.landing.entityName}`, 25);

  if (itinerary.steps.length > 1) {
    setActiveTraversalProgress(traversalProgress);

    const nextStep = itinerary.steps[1];
    if (nextStep) {
      logInfo(
        ctx.output,
        `Step 1/${itinerary.steps.length} complete: landed on ${execution.landing.entityName}`
      );
      logInfo(ctx.output, `Next step available: ${nextStep.stageLabel}`);
      logInfo(ctx.output, "👉 Run: DV Quick Run: Continue Traversal");
    }
  }
}

function createDefaultDeps(ctx: CommandContext): FindPathToTableDeps {
  return {
    loadEntityOptions: loadTraversalEntityOptions,
    pickSourceEntity: async (options) =>
      pickEntityOption(
        "DV Quick Run: Find Path to Table",
        "Pick the starting table",
        options
      ),
    pickTargetEntity: async (options, source) =>
      pickEntityOption(
        "DV Quick Run: Find Path to Table",
        `Pick the destination table (source: ${source.logicalName})`,
        options.filter((option) => option.logicalName !== source.logicalName)
      ),
    buildTraversalGraph: buildFocusedTraversalGraph,
    pickTraversalRoute: async (graph, routes) =>
    pickTraversalRouteFromQuickPick(ctx, graph, routes),
    pickExecutionPlan: pickExecutionPlanFromQuickPick,
    executeFirstStep: executeFirstStepDefault,
    showInfoMessage: (message) => vscode.window.showInformationMessage(message)
  };
}

export async function runFindPathToTableWorkflow(
  ctx: CommandContext,
  deps: FindPathToTableDeps,
  progress?: TraversalProgressReporter
): Promise<void> {
  progress?.report("Loading Dataverse tables...", 5);
  const entityOptions = await deps.loadEntityOptions(ctx);
  if (!entityOptions.length) {
    await deps.showInfoMessage("DV Quick Run: No Dataverse tables were available for traversal.");
    return;
  }

  const source = await deps.pickSourceEntity(entityOptions);
  if (!source) {
    return;
  }

  const target = await deps.pickTargetEntity(entityOptions, source);
  if (!target) {
    return;
  }

  if (source.logicalName === target.logicalName) {
    await deps.showInfoMessage("DV Quick Run: Source and destination tables are the same.");
    return;
  }

  const { graph, routes } = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `DV Quick Run: Finding routes (${source.logicalName} -> ${target.logicalName})`,
      cancellable: false
    },
    async (routeProgress) => {
      const activeEnvironment = ctx.envContext.getActiveEnvironment();
      const traversalScope = loadTraversalScopeSettings(ctx);

      const environmentKey =
        activeEnvironment?.url?.trim().toLowerCase() ??
        activeEnvironment?.name?.trim().toLowerCase() ??
        "default";

      const normalizedSource = source.logicalName.trim().toLowerCase();
      const normalizedTarget = target.logicalName.trim().toLowerCase();
      const maxDepth = 5;

      const routeCacheKey = {
        environmentId: `${environmentKey}::${traversalScope.scopeSignature}`,
        sourceTable: normalizedSource,
        targetTable: normalizedTarget,
        maxDepth
      };

      routeProgress.report({ message: "Checking cached traversal routes...", increment: 10 });
      const cachedRoutes = TraversalCacheService.getRoute(routeCacheKey);

      if (cachedRoutes) {
        logDebug(ctx.output, "Route discovery cache: HIT");
        logDebug(ctx.output, `Using cached routes for ${normalizedSource} -> ${normalizedTarget}`);

        routeProgress.report({ message: "Using cached traversal routes...", increment: 70 });

        const cachedGraph = TraversalCacheService.getMetadata(environmentKey);
        if (!cachedGraph) {
          logWarn(
            ctx.output,
            "Route cache hit but traversal metadata cache was empty. Rebuilding graph."
          );
        } else {
          routeProgress.report({
            message: `Found ${cachedRoutes.length} practical route${cachedRoutes.length === 1 ? "" : "s"}.`,
            increment: 20
          });

          return {
            graph: cachedGraph,
            routes: cachedRoutes
          };
        }
      } else {
        logDebug(ctx.output, "Route discovery cache: MISS");
      }

      routeProgress.report({ message: "Checking cached Dataverse traversal metadata...", increment: 10 });
      let graph = TraversalCacheService.getMetadata(environmentKey);

      if (graph) {
        logDebug(ctx.output, "Traversal metadata cache: HIT");
        routeProgress.report({ message: "Using cached Dataverse traversal metadata...", increment: 25 });
      } else {
        logDebug(ctx.output, "Traversal metadata cache: MISS");
        routeProgress.report({ message: "Building traversal graph...", increment: 25 });

        const graphStart = Date.now();
        graph = await deps.buildTraversalGraph(ctx, source, target);
        TraversalCacheService.setMetadata(environmentKey, graph);
        logDebug(ctx.output, `Traversal metadata build: ${Date.now() - graphStart}ms`);
      }

      routeProgress.report({ message: "Exploring practical routes...", increment: 35 });

      const routeStart = Date.now();
      const scopedGraph = applyTraversalScopeToGraph(
        graph,
        source.logicalName,
        target.logicalName,
        traversalScope
      );

      const discoveredRoutes = buildTraversalRoutes(scopedGraph, {
        sourceEntity: source.logicalName,
        targetEntity: target.logicalName
      });

      const routes = getPracticalTraversalRoutes(discoveredRoutes);
      TraversalCacheService.setRoute(routeCacheKey, routes);

      logDebug(ctx.output, `Route exploration: ${Date.now() - routeStart}ms`);
      logDebug(ctx.output, "Route discovery cache: STORED");

      routeProgress.report({
        message: `Found ${routes.length} practical route${routes.length === 1 ? "" : "s"}.`,
        increment: 20
      });

      return { graph, routes };
    }
  );

  if (!routes.length) {
    logWarn(ctx.output, `No traversal route found from ${source.logicalName} to ${target.logicalName}.`);
    await deps.showInfoMessage(
      `DV Quick Run: No route found from ${source.logicalName} to ${target.logicalName}.`
    );
    return;
  }

  const selectedRoute = await deps.pickTraversalRoute(graph, routes);
  if (!selectedRoute) {
    return;
  }

  progress?.report(`Planning execution for ${selectedRoute.sourceEntity} -> ${selectedRoute.targetEntity}...`, 10);
  const plannedRoute = buildPlannedTraversalRoute(selectedRoute);
  const selectedPlan = await deps.pickExecutionPlan(graph, plannedRoute);

  if (!selectedPlan) {
    return;
  }

  await deps.executeFirstStep(ctx, graph, selectedRoute, selectedPlan, progress);
}

export async function runFindPathToTableAction(ctx: CommandContext): Promise<void> {
  await runAction(ctx, "DV Quick Run: Find Path to Table failed. Check Output.", async () => {

    const existingProgress = getActiveTraversalProgress();

    if (existingProgress) {
      const replaceChoice = await vscode.window.showWarningMessage(
        "You have an active guided traversal in progress. Starting a new traversal will end the current one.",
        { modal: false },
        "Start New Traversal",
        "Cancel"
      );

      if (replaceChoice !== "Start New Traversal") {
        return;
      }

      clearActiveTraversalProgress();
      logInfo(ctx.output, `Replaced active traversal session: ${existingProgress.debugLabel}`);
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "DV Quick Run: Find Path to Table",
        cancellable: false
      },
      async (progress) => {
        const reporter: TraversalProgressReporter = {
          report: (message: string, increment?: number) => progress.report({ message, increment })
        };

        await runFindPathToTableWorkflow(ctx, createDefaultDeps(ctx), reporter);
      }
    );
  });
}

export {
  buildFocusedTraversalGraph,
  buildReadableTraversalRouteLabel,
  buildTraversalRouteDescription
};