import type {
  ExecutionReplayContext,
  ExecutionReplayProvider,
  ExecutionReplayResult,
  InvestigationComparisonContext,
  InvestigationComparisonProvider,
  InvestigationComparisonResult,
  InvestigationContinuationAction,
  InvestigationContinuationContext,
  InvestigationContinuationProvider,
  WorkflowAccelerationAction,
  WorkflowAccelerationContext,
  WorkflowAccelerationProvider
} from "../contracts/index.js";

export class NoopInvestigationContinuationProvider implements InvestigationContinuationProvider {
  public getContinuationActions(_context: InvestigationContinuationContext): readonly InvestigationContinuationAction[] {
    return [];
  }
}

export class NoopInvestigationComparisonProvider implements InvestigationComparisonProvider {
  public async compare(_context: InvestigationComparisonContext): Promise<InvestigationComparisonResult | undefined> {
    return undefined;
  }
}

export class NoopWorkflowAccelerationProvider implements WorkflowAccelerationProvider {
  public getAccelerationActions(_context: WorkflowAccelerationContext): readonly WorkflowAccelerationAction[] {
    return [];
  }
}

export class NoopExecutionReplayProvider implements ExecutionReplayProvider {
  public async replay(_context: ExecutionReplayContext): Promise<ExecutionReplayResult | undefined> {
    return undefined;
  }
}
