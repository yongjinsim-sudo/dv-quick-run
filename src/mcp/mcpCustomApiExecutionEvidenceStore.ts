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

export interface McpCustomApiExecutionEvidenceScope {
  readonly environmentUrl?: string;
  readonly uniqueName?: string;
}

export interface McpCustomApiExecutionEvidenceRepository {
  record(evidence: Omit<McpCustomApiExecutionEvidence, "executionId" | "recordedAtUtc">): McpCustomApiExecutionEvidence;
  get(executionId: string): McpCustomApiExecutionEvidence | undefined;
  getLatest(scope?: McpCustomApiExecutionEvidenceScope): McpCustomApiExecutionEvidence | undefined;
}

export interface McpCustomApiExecutionEvidenceStoreOptions {
  readonly maxEntries?: number;
  readonly retentionMs?: number;
}

function normalizedUrl(value: string | undefined): string | undefined {
  return value?.trim().replace(/\/+$/, "").toLowerCase();
}

export class McpCustomApiExecutionEvidenceStore implements McpCustomApiExecutionEvidenceRepository {
  private readonly executions = new Map<string, McpCustomApiExecutionEvidence>();
  private readonly maxEntries: number;
  private readonly retentionMs: number;

  public constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly idFactory: () => string = () => `dvqr-execution-${randomUUID()}`,
    options: McpCustomApiExecutionEvidenceStoreOptions = {}
  ) {
    this.maxEntries = Math.max(1, options.maxEntries ?? 1000);
    this.retentionMs = Math.max(0, options.retentionMs ?? 24 * 60 * 60 * 1000);
  }

  public record(evidence: Omit<McpCustomApiExecutionEvidence, "executionId" | "recordedAtUtc">): McpCustomApiExecutionEvidence {
    this.prune();
    const stored: McpCustomApiExecutionEvidence = structuredClone({
      ...evidence,
      executionId: this.idFactory(),
      recordedAtUtc: new Date(this.now()).toISOString()
    });
    this.executions.set(stored.executionId, stored);
    this.enforceCapacity();
    return structuredClone(stored);
  }

  public get(executionId: string): McpCustomApiExecutionEvidence | undefined {
    this.prune();
    const evidence = this.executions.get(executionId);
    return evidence ? structuredClone(evidence) : undefined;
  }

  public getLatest(scope: McpCustomApiExecutionEvidenceScope = {}): McpCustomApiExecutionEvidence | undefined {
    this.prune();
    const environmentUrl = normalizedUrl(scope.environmentUrl);
    const matches = [...this.executions.values()].filter((item) =>
      (!environmentUrl || normalizedUrl(item.environmentUrl) === environmentUrl)
      && (!scope.uniqueName || item.uniqueName === scope.uniqueName)
    );
    const latest = matches.at(-1);
    return latest ? structuredClone(latest) : undefined;
  }

  public get size(): number {
    this.prune();
    return this.executions.size;
  }

  private prune(): void {
    if (this.retentionMs === 0) return;
    const cutoff = this.now() - this.retentionMs;
    for (const [executionId, evidence] of this.executions) {
      if (Date.parse(evidence.recordedAtUtc) <= cutoff) this.executions.delete(executionId);
    }
  }

  private enforceCapacity(): void {
    while (this.executions.size > this.maxEntries) {
      const oldest = this.executions.keys().next().value as string | undefined;
      if (!oldest) break;
      this.executions.delete(oldest);
    }
  }
}
