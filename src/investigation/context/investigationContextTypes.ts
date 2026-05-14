export type InvestigationSource =
  | "resultViewer"
  | "explain"
  | "queryDoctor"
  | "guidedTraversal"
  | "executionInsights"
  | "operationalProfile"
  | "capabilityExplorer"
  | "hub"
  | "unknown";

export interface InvestigationEntityContext {
  logicalName?: string;
  displayName?: string;
  primaryIdAttribute?: string;
}

export interface InvestigationQueryContext {
  queryText?: string;
  queryType?: "odata" | "fetchxml" | "batch" | "unknown";
}

export interface InvestigationRecordContext {
  id?: string;
  entityLogicalName?: string;
  displayLabel?: string;
}

export interface InvestigationTraversalContext {
  sourceEntity?: string;
  targetEntity?: string;
  selectedRouteId?: string;
}

export interface InvestigationRuntimeContext {
  correlationId?: string;
  requestId?: string;
  operationId?: string;
  providerIds?: string[];
}

export interface InvestigationCapabilityExecutionContext {
  kind: "customApiExecution";
  operationUniqueName: string;
  operationDisplayName?: string;
  operationKind?: "Action" | "Function";
  bindingKind?: "Bound" | "Unbound" | "Unknown";
  boundEntityLogicalName?: string;
  status?: "previewed" | "completed" | "failed";
  method?: "GET" | "POST";
  path?: string;
  statusCode?: number;
  durationMs?: number;
  executedAtUtc?: string;
}

export interface InvestigationBatchContext {
  activeItemKey?: string;
  activeLabel?: string;
  activeEntityLogicalName?: string;
  activeEntityDisplayName?: string;
  activeRowCount?: number;
  totalItems?: number;
}

export interface InvestigationContext {
  id: string;
  environmentName?: string;
  environmentUrl?: string;
  source?: InvestigationSource;
  currentEntity?: InvestigationEntityContext;
  currentQuery?: InvestigationQueryContext;
  selectedRecord?: InvestigationRecordContext;
  traversal?: InvestigationTraversalContext;
  runtime?: InvestigationRuntimeContext;
  batch?: InvestigationBatchContext;
  capabilityExecution?: InvestigationCapabilityExecutionContext;
  surfaceState?: InvestigationSurfaceState;
  lastUpdatedUtc: string;
}

export type InvestigationContextPatch = Partial<Omit<InvestigationContext, "id" | "lastUpdatedUtc">>;


export interface InvestigationSurfaceState {
  resultViewerOpen?: boolean;
  operationalProfileOpen?: boolean;
  executionInsightsOpen?: boolean;
  recoverable?: boolean;
  expired?: boolean;
  staleReason?: string;
}
