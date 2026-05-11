export interface ExecutionReplayContext {
  readonly queryText?: string;
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly environmentUrl?: string;
}

export interface ExecutionReplayResult {
  readonly title: string;
  readonly summary: string;
  readonly replayed: boolean;
}

export interface ExecutionReplayProvider {
  replay(context: ExecutionReplayContext): Promise<ExecutionReplayResult | undefined>;
}
