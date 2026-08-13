import { randomUUID } from "crypto";
import type { McpCustomApiExecutionPreviewContract } from "./mcpCustomApiExecutionPreviewApplicationService.js";

export type McpCustomApiExecutionPreviewSessionStatus = "awaiting-confirmation" | "consumed" | "expired";

export interface McpCustomApiExecutionPreviewSession {
  readonly previewId: string;
  readonly plan: McpCustomApiExecutionPreviewContract;
  readonly createdAtUtc: string;
  readonly expiresAtUtc: string;
  status: McpCustomApiExecutionPreviewSessionStatus;
}

export interface McpCustomApiExecutionPreviewSessionStoreOptions {
  readonly terminalRetentionMs?: number;
  readonly maxEntries?: number;
}

export type McpCustomApiExecutionPreviewConsumeResult =
  | { readonly ok: true; readonly session: McpCustomApiExecutionPreviewSession }
  | { readonly ok: false; readonly reason: "missing" | "expired" | "consumed" };

function cloneSession(session: McpCustomApiExecutionPreviewSession): McpCustomApiExecutionPreviewSession {
  return structuredClone(session);
}

export class McpCustomApiExecutionPreviewSessionStore {
  private readonly sessions = new Map<string, McpCustomApiExecutionPreviewSession>();
  private readonly terminalRetentionMs: number;
  private readonly maxEntries: number;

  public constructor(
    private readonly ttlMs = 10 * 60 * 1000,
    private readonly now: () => number = () => Date.now(),
    private readonly idFactory: () => string = () => `dvqr-preview-${randomUUID()}`,
    options: McpCustomApiExecutionPreviewSessionStoreOptions = {}
  ) {
    this.terminalRetentionMs = Math.max(0, options.terminalRetentionMs ?? 30 * 60 * 1000);
    this.maxEntries = Math.max(1, options.maxEntries ?? 1000);
  }

  public create(plan: McpCustomApiExecutionPreviewContract): McpCustomApiExecutionPreviewSession {
    this.maintain();
    const createdAt = this.now();
    const session: McpCustomApiExecutionPreviewSession = {
      previewId: this.idFactory(),
      plan: structuredClone(plan),
      createdAtUtc: new Date(createdAt).toISOString(),
      expiresAtUtc: new Date(createdAt + this.ttlMs).toISOString(),
      status: "awaiting-confirmation"
    };
    this.sessions.set(session.previewId, session);
    this.enforceCapacity();
    return cloneSession(session);
  }

  public get(previewId: string): McpCustomApiExecutionPreviewSession | undefined {
    this.maintain();
    const session = this.sessions.get(previewId);
    return session ? cloneSession(session) : undefined;
  }

  public consume(previewId: string): McpCustomApiExecutionPreviewConsumeResult {
    this.maintain();
    const session = this.sessions.get(previewId);
    if (!session) return { ok: false, reason: "missing" };
    if (session.status === "expired") return { ok: false, reason: "expired" };
    if (session.status === "consumed") return { ok: false, reason: "consumed" };
    session.status = "consumed";
    return { ok: true, session: cloneSession(session) };
  }

  public get size(): number {
    this.maintain();
    return this.sessions.size;
  }

  private maintain(): void {
    const now = this.now();
    for (const [previewId, session] of this.sessions) {
      const expiresAt = Date.parse(session.expiresAtUtc);
      if (session.status === "awaiting-confirmation" && expiresAt <= now) session.status = "expired";
      if (session.status !== "awaiting-confirmation" && expiresAt + this.terminalRetentionMs <= now) {
        this.sessions.delete(previewId);
      }
    }
    this.enforceCapacity();
  }

  private enforceCapacity(): void {
    if (this.sessions.size <= this.maxEntries) return;
    const ordered = [...this.sessions.values()].sort((left, right) => {
      const leftTerminal = left.status === "awaiting-confirmation" ? 1 : 0;
      const rightTerminal = right.status === "awaiting-confirmation" ? 1 : 0;
      return leftTerminal - rightTerminal || Date.parse(left.createdAtUtc) - Date.parse(right.createdAtUtc);
    });
    for (const session of ordered.slice(0, this.sessions.size - this.maxEntries)) {
      this.sessions.delete(session.previewId);
    }
  }
}
