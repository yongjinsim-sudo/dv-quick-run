export interface WorkflowAccelerationContext {
  readonly sourceSurface: string;
  readonly entityLogicalName?: string;
  readonly recordId?: string;
  readonly queryText?: string;
}

export interface WorkflowAccelerationAction {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly enabled: boolean;
  readonly premiumOnly?: boolean;
}

export interface WorkflowAccelerationProvider {
  getAccelerationActions(context: WorkflowAccelerationContext): readonly WorkflowAccelerationAction[];
}
