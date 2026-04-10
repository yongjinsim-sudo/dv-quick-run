import type { RelationshipType } from "../../../../../metadata/metadataModel.js";

export type TraversalConfidence = "high" | "medium";

export type TraversalRelationshipDirection =
  | "manyToOne"
  | "oneToMany"
  | "manyToMany"
  | "unknown";

export type TraversalRelationshipEdge = {
  fromEntity: string;
  toEntity: string;
  navigationPropertyName: string;
  relationshipType: RelationshipType;
  direction: TraversalRelationshipDirection;
  schemaName?: string;
  referencingAttribute?: string;
};

export type TraversalEntityNode = {
  logicalName: string;
  entitySetName: string;
  primaryIdAttribute?: string;
  primaryNameAttribute?: string;
  fieldLogicalNames: string[];
  outboundRelationships: TraversalRelationshipEdge[];
};

export type TraversalGraph = {
  entities: Record<string, TraversalEntityNode>;
};

export type TraversalRequest = {
  sourceEntity: string;
  targetEntity: string;
};

/*
 * Legacy types — keep for now so older files still compile.
 * New runtime should move toward TraversalRoute / TraversalExecutionPlan.
 */
export type TraversalPlan = {
  sourceEntity: string;
  targetEntity: string;
  candidatePaths: TraversalPath[];
};

export type TraversalPath = {
  pathId: string;
  hops: number;
  confidence: TraversalConfidence;
  summaryLabel: string;
  legs: TraversalLeg[];
};

export type TraversalLeg = {
  legNumber: number;
  fromEntity: string;
  toEntity: string;
  viaRelationship: string;
  fromField: string;
  toField: string;
  queryTemplate: string;
  requiredValueField: string;
  nextPlaceholder?: string;
  isFinal: boolean;
};

export type TraversalSession = {
  sessionId: string;
  selectedPathId: string;
  currentLegIndex: number;
  selectedValuesByLeg: Record<number, string>;
  plan: TraversalPlan;
};

export type TraversalStage = {
  stageNumber: number;
  sourceEntity: string;
  checkpointEntity: string;
  candidatePaths: TraversalPath[];
  preferredPathId?: string;
};

export type TraversalRoutePlan = {
  sourceEntity: string;
  targetEntity: string;
  stageEntities: string[];
  stages: TraversalStage[];
  routeLabel: string;
  reachedTarget: boolean;
};

/*
 * New route + itinerary model.
 */
export type TraversalSubpath = {
  subpathId: string;
  originEntity: string;
  targetEntity: string;
  entities: string[];
  edges: TraversalRelationshipEdge[];
  hopCount: number;
};

export type TraversalRoute = {
  routeId: string;
  sourceEntity: string;
  targetEntity: string;
  entities: string[];
  edges: TraversalRelationshipEdge[];
  hopCount: number;
  meetingEntity?: string;
  confidence: TraversalConfidence;
};

export type TraversalBreakpoint = {
  entity: string;
  entityIndex: number;
  score: number;
  reasons: string[];
};

export type TraversalExecutionStep = {
  stepNumber: number;
  fromEntity: string;
  toEntity: string;
  entities: string[];
  edges: TraversalRelationshipEdge[];
  hopCount: number;
  stageLabel: string;
};

export type TraversalExecutionPlan = {
  planId: string;
  label: "Compact" | "Mixed" | "Detailed";
  rationale: string;
  steps: TraversalExecutionStep[];
  recommended?: boolean;
};

export type PlannedTraversalRoute = {
  route: TraversalRoute;
  breakpoints: TraversalBreakpoint[];
  candidatePlans: TraversalExecutionPlan[];
  recommendedPlanId?: string;
};

export type TraversalExplainVerbosity = "off" | "minimal" | "verbose";

export type TraversalExecutionMode =
  | "direct"
  | "nested_expand"
  | "sibling_expand"
  | "hybrid"
  | "chained_queries";

export type TraversalStepQuery = {
  queryNumber: number;
  queryPath: string;
  sourceEntity: string;
  targetEntity: string;
  purpose: string;
};

export type TraversalEnrichmentCandidate = {
  sourceEntity: string;
  targetEntity: string;
  relationshipName: string;
  kind: "sibling" | "reference" | "semantic";
  rationale: string;
};

export type TraversalStepExecutionPlan = {
  mode: TraversalExecutionMode;
  mainMissionTarget: string;
  queries: TraversalStepQuery[];
  rationale: string[];
  usedFallback: boolean;
  enrichmentCandidates: TraversalEnrichmentCandidate[];
};

export type TraversalLandingContext = {
  entityName: string;
  ids: string[];
};


export type TraversalInsightActionKind =
  | "enrich_current_leg"
  | "inspect_related"
  | "manual_test_hook";

export type TraversalInsightAction = {
  actionId: string;
  title: string;
  description: string;
  kind: TraversalInsightActionKind;
  appliesToCurrentLegOnly: boolean;
};

export type TraversalInsightActionContext = {
  route: TraversalRoute;
  itinerary: TraversalExecutionPlan;
  step: TraversalExecutionStep;
  executionPlan: TraversalStepExecutionPlan;
  landing: TraversalLandingContext;
};

export type TraversalViewerContext = {
  openedFrom: "guidedTraversal";
  traversalSessionId: string;
  legIndex: number;
  legCount: number;
  hasNextLeg: boolean;
  nextLegLabel?: string;
  nextLegEntityName?: string;
  requiredCarryField?: string;
  currentEntityName?: string;
  isFinalLeg: boolean;
  canSiblingExpand?: boolean;
  canRunBatch?: boolean;
  canRunOptimizedBatch?: boolean;
  showBanner?: boolean;
  bannerTitle?: string;
  bannerSubtitle?: string;
};

export type ContinueTraversalRequest = {
  traversalSessionId: string;
  legIndex: number;
  carryField: string;
  carryValue: string;
};

export type ActiveTraversalProgress = {
  sessionId: string;
  debugLabel: string;
  route: TraversalRoute;
  itinerary: TraversalExecutionPlan;
  currentStepIndex: number;
  graph: TraversalGraph;
  lastLanding?: TraversalLandingContext;
  currentStepInput?: TraversalLandingContext;
  selectedInputsByStep?: Record<number, TraversalLandingContext | undefined>;
  selectedCarryValuesByStep?: Record<number, string | undefined>;
  currentStepSiblingExpandClause?: string;
  siblingExpandClausesByStep?: Record<number, string>;
  currentStepInsightActions?: TraversalInsightAction[];
  nextQuerySequenceNumber?: number;
  executedQueries?: TraversalStepQuery[];
  executedQueriesByStep?: Record<number, TraversalStepQuery[]>;
  isCompleted?: boolean;
};