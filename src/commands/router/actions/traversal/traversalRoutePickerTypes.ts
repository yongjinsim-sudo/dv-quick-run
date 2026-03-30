import type { TraversalHistoryEntry } from "../shared/traversal/traversalHistoryStore.js";
import { buildRankedTraversalRoutes } from "../shared/traversal/traversalSelection.js";
import type { TraversalRoute } from "../shared/traversal/traversalTypes.js";

export type RouteFeasibilityStatus = "selectable" | "warning" | "unselectable";

export type RouteFeasibility = {
  status: RouteFeasibilityStatus;
  reason: string;
};

export type RankedRouteItem = ReturnType<typeof buildRankedTraversalRoutes>[number];

export type RankedRouteWithFeasibility = RankedRouteItem & {
  feasibility: RouteFeasibility;
};

export type CompactRankedRouteGroup = {
  groupKey: string;
  label: string;
  hopCount: number;
  isBestMatch: boolean;
  items: RankedRouteWithFeasibility[];
};

export function buildCompactRouteLabel(route: TraversalRoute): string {
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

export function buildVariantChainLabel(route: TraversalRoute): string {
  const hops = route.edges.map((edge) => humanizeVariantHop(edge.navigationPropertyName));
  return `via ${hops.join(" -> ")}`;
}

function getVariantConfidenceSection(item: RankedRouteItem): string {
  if (item.route.confidence === "high" && item.score >= 0) {
    return "High confidence";
  }

  if (item.score >= 0) {
    return "Medium confidence";
  }

  return "Low confidence";
}

export function getVariantDisplaySection(
  item: RankedRouteWithFeasibility,
  successMap: Map<string, TraversalHistoryEntry>
): string {
  const routeHistory = successMap.get(item.route.routeId);

  if (routeHistory) {
    return "Proven routes";
  }

  return getVariantConfidenceSection(item);
}
