import { buildPlannedTraversalRoute } from "../shared/traversal/traversalPlanGenerator.js";
import { buildStepExecutionPlan } from "../shared/traversal/traversalStepExecutor.js";
import type {
  TraversalExecutionPlan,
  TraversalGraph
} from "../shared/traversal/traversalTypes.js";
import type {
  RankedRouteItem,
  RankedRouteWithFeasibility,
  RouteFeasibility,
  RouteFeasibilityStatus
} from "./traversalRoutePickerTypes.js";

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

export function buildFeasibilityPrefix(status: RouteFeasibilityStatus): string {
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

export function assessExecutionPlanFeasibility(
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

export function assessRouteFeasibility(
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

export function buildGroupFeasibilityPrefix(items: RankedRouteWithFeasibility[]): string {
  const summary = summarizeGroupFeasibility(items);

  if (summary.selectable > 0 && summary.unselectable === 0 && summary.warning === 0) {
    return buildFeasibilityPrefix("selectable");
  }

  if (summary.selectable === 0 && summary.warning === 0) {
    return buildFeasibilityPrefix("unselectable");
  }

  return buildFeasibilityPrefix("warning");
}

export function buildGroupFeasibilityDetail(items: RankedRouteWithFeasibility[]): string {
  const summary = summarizeGroupFeasibility(items);
  const parts = [
    `${items.length} variant${items.length === 1 ? "" : "s"}`,
    `${summary.selectable} ready`,
    `${summary.warning} caution`,
    `${summary.unselectable} blocked`
  ];

  return parts.join(" • ");
}
