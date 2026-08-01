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


export type McpCustomApiExecutionPreviewConsumeResult =
  | { readonly ok: true; readonly session: McpCustomApiExecutionPreviewSession }
  | { readonly ok: false; readonly reason: "missing" | "expired" | "consumed" };

export class McpCustomApiExecutionPreviewSessionStore {
  private readonly sessions = new Map<string, McpCustomApiExecutionPreviewSession>();

  public constructor(
    private readonly ttlMs = 10 * 60 * 1000,
    private readonly now: () => number = () => Date.now(),
    private readonly idFactory: () => string = () => `dvqr-preview-${randomUUID()}`
  ) {}

  public create(plan: McpCustomApiExecutionPreviewContract): McpCustomApiExecutionPreviewSession {
    this.expireStale();
    const createdAt = this.now();
    const session: McpCustomApiExecutionPreviewSession = {
      previewId: this.idFactory(),
      plan,
      createdAtUtc: new Date(createdAt).toISOString(),
      expiresAtUtc: new Date(createdAt + this.ttlMs).toISOString(),
      status: "awaiting-confirmation"
    };
    this.sessions.set(session.previewId, session);
    return session;
  }

  public get(previewId: string): McpCustomApiExecutionPreviewSession | undefined {
    const session = this.sessions.get(previewId);
    if (!session) return undefined;
    if (session.status === "awaiting-confirmation" && Date.parse(session.expiresAtUtc) <= this.now()) {
      session.status = "expired";
    }
    return session;
  }

  public consume(previewId: string): McpCustomApiExecutionPreviewConsumeResult {
    // JavaScript runs this map lookup and state transition synchronously, so no
    // second caller can observe awaiting-confirmation after this method returns.
    const session = this.sessions.get(previewId);
    if (!session) {
      return { ok: false, reason: "missing" };
    }
    if (session.status === "awaiting-confirmation" && Date.parse(session.expiresAtUtc) <= this.now()) {
      session.status = "expired";
    }
    if (session.status === "expired") {
      return { ok: false, reason: "expired" };
    }
    if (session.status === "consumed") {
      return { ok: false, reason: "consumed" };
    }
    session.status = "consumed";
    return { ok: true, session };
  }

  private expireStale(): void {
    for (const session of this.sessions.values()) {
      if (session.status === "awaiting-confirmation" && Date.parse(session.expiresAtUtc) <= this.now()) {
        session.status = "expired";
      }
    }
  }
}
