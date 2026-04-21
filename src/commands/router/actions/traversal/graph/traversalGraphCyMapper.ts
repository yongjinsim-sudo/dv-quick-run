import type {
  TraversalGraphEdgeViewModel,
  TraversalGraphNodeViewModel,
  TraversalGraphViewModel
} from "./traversalGraphTypes.js";

export type TraversalGraphCyNodeElement = {
  group: "nodes";
  data: {
    id: string;
    label: string;
    logicalName: string;
    role: "source" | "target" | "intermediate";
    routeCount: number;
    bestVisibleRank?: number;
    preferredRouteId?: string;
    classes: string[];
  };
  position?: {
    x: number;
    y: number;
  };
};

export type TraversalGraphCyEdgeElement = {
  group: "edges";
  data: {
    id: string;
    source: string;
    target: string;
    label: string;
    navigationPropertyName: string;
    routeIds: string[];
    visibleRouteCount: number;
    bestVisibleRank?: number;
    preferredRouteId?: string;
    classes: string[];
  };
};

export type TraversalGraphCyElement =
  | TraversalGraphCyNodeElement
  | TraversalGraphCyEdgeElement;

export function buildTraversalGraphNodeClasses(
  node: TraversalGraphNodeViewModel
): string[] {
  const classes = [`role-${node.role}`];

  if (node.styling.isOnSelectedRoute) {
    classes.push("selected-route");
  }


  if (node.styling.isSystemHeavy) {
    classes.push("system-heavy");
  }

  if (node.styling.isLoopWarning) {
    classes.push("loop-warning");
  }

  if (node.styling.isDimmed) {
    classes.push("dimmed");
  }

  return classes;
}

export function buildTraversalGraphEdgeClasses(
  edge: TraversalGraphEdgeViewModel
): string[] {
  const classes: string[] = [];

  if (edge.styling.isOnSelectedRoute) {
    classes.push("selected-route");
  }


  if (edge.styling.isSystemHeavy) {
    classes.push("system-heavy");
  }

  if (edge.styling.isLoopWarning) {
    classes.push("loop-warning");
  }

  if (edge.styling.isBlocked) {
    classes.push("blocked");
  }

  if (edge.styling.isDimmed) {
    classes.push("dimmed");
  }

  return classes;
}

export function mapTraversalGraphNodeToCyElement(
  node: TraversalGraphNodeViewModel
): TraversalGraphCyNodeElement {
  const data: TraversalGraphCyNodeElement["data"] = {
    id: node.id,
    label: node.label,
    logicalName: node.logicalName,
    role: node.role,
    routeCount: node.metrics.visibleRouteCount,
    bestVisibleRank: node.metrics.bestVisibleRank,
    classes: buildTraversalGraphNodeClasses(node)
  };

  if (node.preferredRouteId !== undefined) {
    data.preferredRouteId = node.preferredRouteId;
  }

  return {
    group: "nodes",
    data,
    position:
      node.layout?.x !== undefined && node.layout?.y !== undefined
        ? {
            x: node.layout.x,
            y: node.layout.y
          }
        : undefined
  };
}

export function mapTraversalGraphEdgeToCyElement(
  edge: TraversalGraphEdgeViewModel
): TraversalGraphCyEdgeElement {
  return {
    group: "edges",
    data: {
      id: edge.id,
      source: edge.fromNodeId,
      target: edge.toNodeId,
      label: edge.label,
      navigationPropertyName: edge.navigationPropertyName,
      routeIds: [...edge.routeIds],
      visibleRouteCount: edge.metrics.visibleRouteCount,
      bestVisibleRank: edge.metrics.bestVisibleRank,
      classes: buildTraversalGraphEdgeClasses(edge)
    }
  };
}

export function mapTraversalGraphViewModelToCy(args: {
  graph: TraversalGraphViewModel;
}): {
  elements: TraversalGraphCyElement[];
} {
  const nodes = [...args.graph.nodes]
    .sort(compareNodesForCy)
    .map(mapTraversalGraphNodeToCyElement);
  const edges = [...args.graph.edges]
    .sort(compareEdgesForCy)
    .map(mapTraversalGraphEdgeToCyElement);

  return {
    elements: [...nodes, ...edges]
  };
}

function compareNodesForCy(
  left: TraversalGraphNodeViewModel,
  right: TraversalGraphNodeViewModel
): number {
  const roleDelta = rankNodeRole(left.role) - rankNodeRole(right.role);
  if (roleDelta !== 0) {
    return roleDelta;
  }

  return left.logicalName.localeCompare(right.logicalName);
}

function compareEdgesForCy(
  left: TraversalGraphEdgeViewModel,
  right: TraversalGraphEdgeViewModel
): number {
  const leftRank = left.metrics.bestVisibleRank ?? Number.MAX_SAFE_INTEGER;
  const rightRank = right.metrics.bestVisibleRank ?? Number.MAX_SAFE_INTEGER;

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  const labelDelta = left.label.localeCompare(right.label);
  if (labelDelta !== 0) {
    return labelDelta;
  }

  return left.id.localeCompare(right.id);
}

function rankNodeRole(role: TraversalGraphNodeViewModel["role"]): number {
  switch (role) {
    case "source":
      return 0;
    case "target":
      return 1;
    case "intermediate":
      return 2;
  }
}
