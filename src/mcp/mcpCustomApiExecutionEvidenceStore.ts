import { randomUUID } from "crypto";

export interface McpCustomApiExecutionEvidence {
  readonly executionId: string;
  readonly recordedAtUtc: string;
  readonly uniqueName: string;
  readonly environmentUrl?: string;
  readonly previewId?: string;
  readonly executed: boolean;
  readonly response?: unknown;
  readonly expectedOutputs?: readonly { readonly uniqueName: string; readonly type: string }[];
  readonly executionContext?: Readonly<Record<string, unknown>>;
  readonly transport?: string;
  readonly nativeFetchFailure?: unknown;
  readonly structuredError?: unknown;
  readonly message?: string;
}

export class McpCustomApiExecutionEvidenceStore {
  private readonly executions = new Map<string, McpCustomApiExecutionEvidence>();
  private latestExecutionId: string | undefined;

  public constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly idFactory: () => string = () => `dvqr-execution-${randomUUID()}`
  ) {}

  public record(evidence: Omit<McpCustomApiExecutionEvidence, "executionId" | "recordedAtUtc">): McpCustomApiExecutionEvidence {
    const stored: McpCustomApiExecutionEvidence = {
      ...evidence,
      executionId: this.idFactory(),
      recordedAtUtc: new Date(this.now()).toISOString()
    };
    this.executions.set(stored.executionId, stored);
    this.latestExecutionId = stored.executionId;
    return stored;
  }

  public get(executionId: string): McpCustomApiExecutionEvidence | undefined {
    return this.executions.get(executionId);
  }

  public getLatest(): McpCustomApiExecutionEvidence | undefined {
    return this.latestExecutionId ? this.executions.get(this.latestExecutionId) : undefined;
  }
}
