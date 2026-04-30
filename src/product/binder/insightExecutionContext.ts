export type InsightTier = "queryShape" | "resultSample" | "external";

export interface InsightExecutionContext {
  readonly startedAt: number;
  readonly maxMs: number;
  readonly maxRows: number;
  readonly maxColumns: number;
  readonly allowExternal: boolean;
}

export interface InsightExecutionContextOptions {
  maxMs?: number;
  maxRows?: number;
  maxColumns?: number;
  allowExternal?: boolean;
}

export const DEFAULT_RESULT_INSIGHT_MAX_MS = 2500;
export const DEFAULT_RESULT_INSIGHT_MAX_ROWS = 20;
export const DEFAULT_RESULT_INSIGHT_MAX_COLUMNS = 40;

export function createInsightExecutionContext(
  options: InsightExecutionContextOptions = {}
): InsightExecutionContext {
  return {
    startedAt: Date.now(),
    maxMs: options.maxMs ?? DEFAULT_RESULT_INSIGHT_MAX_MS,
    maxRows: options.maxRows ?? DEFAULT_RESULT_INSIGHT_MAX_ROWS,
    maxColumns: options.maxColumns ?? DEFAULT_RESULT_INSIGHT_MAX_COLUMNS,
    allowExternal: options.allowExternal ?? false
  };
}

export function isInsightBudgetExceeded(ctx: InsightExecutionContext): boolean {
  return Date.now() - ctx.startedAt > ctx.maxMs;
}
