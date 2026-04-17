import type { RankedTraversalRoute } from "../../shared/traversal/traversalSelection.js";

export type TraversalGraphRouteWindow = {
  startIndex: number;
  visibleCount: number;
  totalRoutes: number;
  maxVisibleCount: number;
};

export type TraversalGraphControlState = {
  canExpandToMax: boolean;
  canShiftNext: boolean;
  canShiftPrevious: boolean;
};

export type TraversalGraphNodeRole =
  | "source"
  | "target"
  | "intermediate";

export type TraversalGraphNodeStyling = {
  isOnSelectedRoute: boolean;
  isOnBestRoute: boolean;
  isFocusedByKeyword: boolean;
  isSystemHeavy: boolean;
  isLoopWarning: boolean;
  isDimmed: boolean;
};

export type TraversalGraphNodeMetrics = {
  visibleRouteCount: number;
  bestVisibleRank?: number;
};

export type TraversalGraphNodeLayout = {
  x?: number;
  y?: number;
};

export type TraversalGraphNodeViewModel = {
  id: string;
  logicalName: string;
  label: string;
  role: TraversalGraphNodeRole;
  styling: TraversalGraphNodeStyling;
  metrics: TraversalGraphNodeMetrics;
  layout?: TraversalGraphNodeLayout;
};

export type TraversalGraphEdgeStyling = {
  isOnSelectedRoute: boolean;
  isOnBestRoute: boolean;
  isFocusedByKeyword: boolean;
  isSystemHeavy: boolean;
  isLoopWarning: boolean;
  isBlocked: boolean;
  isDimmed: boolean;
};

export type TraversalGraphEdgeMetrics = {
  visibleRouteCount: number;
  bestVisibleRank?: number;
};

export type TraversalGraphEdgeViewModel = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  navigationPropertyName: string;
  label: string;
  routeIds: string[];
  styling: TraversalGraphEdgeStyling;
  metrics: TraversalGraphEdgeMetrics;
};

export type TraversalGraphRouteSemantics = {
  isBestMatch: boolean;
  isSelected: boolean;
  isFocusedByKeyword: boolean;
  isSystemHeavy: boolean;
  isLoopBack: boolean;
  isBlocked: boolean;
  isPractical: boolean;
};

export type TraversalGraphRouteReasoning = {
  positive: string[];
  warnings: string[];
};


export type TraversalGraphRouteVariantViewModel = {
  routeId: string;
  rank: number;
  label: string;
  subtitle?: string;
  variantKey?: string;
  navigationChain: string[];
  confidence: "high" | "medium";
  isSelected: boolean;
};

export type TraversalGraphRouteGroupViewModel = {
  groupId: string;
  rank: number;
  label: string;
  entities: string[];
  variantCount: number;
  selectedVariantRouteId?: string;
  bestVariantRouteId: string;
  isSelected: boolean;
  isBestMatch: boolean;
  variants: TraversalGraphRouteVariantViewModel[];
};

export type TraversalGraphRouteViewModel = {
  routeId: string;
  rank: number;
  label: string;
  entities: string[];
  edgeIds: string[];
  hopCount: number;
  confidence: "high" | "medium";
  score?: number;
  semantics: TraversalGraphRouteSemantics;
  reasoning: TraversalGraphRouteReasoning;
};

export type TraversalGraphPanelAction = {
  label: "Use this route";
  routeId?: string;
  enabled: boolean;
};

export type TraversalGraphSidePanelModel = {
  selectedRouteId?: string;
  selectedGroupId?: string;
  title?: string;
  subtitle?: string;
  rank?: number;
  hopCount?: number;
  confidence?: "high" | "medium";
  confidenceExplanation: string[];
  positiveReasons: string[];
  comparisonReasons: string[];
  warningReasons: string[];
  variantsTitle?: string;
  variants: TraversalGraphRouteVariantViewModel[];
  action: TraversalGraphPanelAction;
};

export type TraversalGraphFocusState = {
  keyword?: string;
  normalizedKeyword?: string;
  hasActiveFocus: boolean;
};

export type TraversalGraphSessionLayoutState = {
  positionsByNodeId: Record<string, { x: number; y: number }>;
};

export type TraversalGraphViewModel = {
  sourceEntity: string;
  targetEntity: string;
  routeWindow: TraversalGraphRouteWindow;
  controls: TraversalGraphControlState;
  focus: TraversalGraphFocusState;
  selectedRouteId?: string;
  nodes: TraversalGraphNodeViewModel[];
  edges: TraversalGraphEdgeViewModel[];
  routes: TraversalGraphRouteViewModel[];
  routeGroups: TraversalGraphRouteGroupViewModel[];
  sidePanel: TraversalGraphSidePanelModel;
};

export type BuildTraversalGraphViewModelArgs = {
  sourceEntity: string;
  targetEntity: string;
  rankedRoutes: RankedTraversalRoute[];
  routeWindow: {
    startIndex: number;
    visibleCount: number;
    maxVisibleCount: number;
  };
  selectedRouteId?: string;
  focusedKeyword?: string;
  layoutState?: TraversalGraphSessionLayoutState;
};

export type TraversalGraphSelectableRoute = {
  routeId: string;
  rank: number;
  isBestMatch: boolean;
  isFocusedByKeyword: boolean;
};

export type ResolveTraversalGraphSelectionArgs = {
  visibleRoutes: TraversalGraphSelectableRoute[];
  currentSelectedRouteId?: string;
  focusedKeyword?: string;
};

export type TraversalGraphSelectionResolution = {
  selectedRouteId?: string;
  selectionSource:
    | "preserved-current"
    | "best-visible-default"
    | "best-focused-fallback"
    | "first-visible-fallback"
    | "none";
};
