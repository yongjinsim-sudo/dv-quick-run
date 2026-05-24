// Compatibility shim for older imports.
// Public core builds must not depend on ignored /src/pro implementation files.
import type { PremiumProviderRegistry } from "../../core/providerRegistry/index.js";
import {
  NoopExecutionReplayProvider,
  NoopInvestigationComparisonProvider,
  NoopInvestigationContinuationProvider,
  NoopWorkflowAccelerationProvider
} from "../../core/providerRegistry/index.js";

export function createNoopPremiumProviderRegistry(): PremiumProviderRegistry {
  return {
    investigationContinuation: new NoopInvestigationContinuationProvider(),
    investigationComparison: new NoopInvestigationComparisonProvider(),
    workflowAcceleration: new NoopWorkflowAccelerationProvider(),
    executionReplay: new NoopExecutionReplayProvider()
  };
}
