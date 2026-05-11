import type {
  ExecutionReplayProvider,
  InvestigationComparisonProvider,
  InvestigationContinuationProvider,
  WorkflowAccelerationProvider
} from "../contracts/index.js";
import {
  NoopExecutionReplayProvider,
  NoopInvestigationComparisonProvider,
  NoopInvestigationContinuationProvider,
  NoopWorkflowAccelerationProvider
} from "./noopPremiumProviders.js";

export interface PremiumProviderRegistry {
  readonly investigationContinuation: InvestigationContinuationProvider;
  readonly investigationComparison: InvestigationComparisonProvider;
  readonly workflowAcceleration: WorkflowAccelerationProvider;
  readonly executionReplay: ExecutionReplayProvider;
}

const defaultPremiumProviderRegistry: PremiumProviderRegistry = {
  investigationContinuation: new NoopInvestigationContinuationProvider(),
  investigationComparison: new NoopInvestigationComparisonProvider(),
  workflowAcceleration: new NoopWorkflowAccelerationProvider(),
  executionReplay: new NoopExecutionReplayProvider()
};

let activePremiumProviderRegistry: PremiumProviderRegistry = defaultPremiumProviderRegistry;

export function getPremiumProviderRegistry(): PremiumProviderRegistry {
  return activePremiumProviderRegistry;
}

export function registerPremiumProviderRegistry(registry: PremiumProviderRegistry): void {
  activePremiumProviderRegistry = registry;
}

export function resetPremiumProviderRegistry(): void {
  activePremiumProviderRegistry = defaultPremiumProviderRegistry;
}
