import type { PremiumProviderRegistry } from "../../core/providerRegistry/index.js";
import {
  NoopExecutionReplayProvider,
  NoopInvestigationComparisonProvider,
  NoopInvestigationContinuationProvider,
  NoopWorkflowAccelerationProvider
} from "../../core/providerRegistry/index.js";

export function createDefaultPremiumProviderRegistry(): PremiumProviderRegistry {
  return {
    investigationContinuation: new NoopInvestigationContinuationProvider(),
    investigationComparison: new NoopInvestigationComparisonProvider(),
    workflowAcceleration: new NoopWorkflowAccelerationProvider(),
    executionReplay: new NoopExecutionReplayProvider()
  };
}
