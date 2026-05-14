import type { InvestigationContext } from "./investigationContextTypes.js";

export function formatInvestigationContextSummary(context: InvestigationContext): string {
  const parts = [
    context.environmentName ? `Environment: ${context.environmentName}` : undefined,
    context.currentEntity?.logicalName ? `Entity: ${context.currentEntity.logicalName}` : undefined,
    context.currentQuery?.queryType ? `Query: ${context.currentQuery.queryType}` : undefined,
    context.batch?.activeLabel ? `Selected batch: ${context.batch.activeLabel}` : undefined,
    context.capabilityExecution?.operationUniqueName ? `Capability: ${context.capabilityExecution.operationUniqueName}` : undefined,
    context.selectedRecord?.id ? `Record: ${context.selectedRecord.id}` : undefined,
    context.traversal?.selectedRouteId ? `Route: ${context.traversal.selectedRouteId}` : undefined,
    context.runtime?.correlationId ? `Correlation: ${context.runtime.correlationId}` : undefined
  ].filter((part): part is string => !!part);

  return parts.length > 0 ? parts.join(" • ") : "No active investigation context";
}
