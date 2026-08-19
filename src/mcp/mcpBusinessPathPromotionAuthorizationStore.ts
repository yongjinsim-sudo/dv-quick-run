import type { BusinessPathHop } from "../core/businessPaths/index.js";

export interface BusinessPathPromotionAuthorization {
  readonly authorizationId: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly sourceTable: string;
  readonly targetTable: string;
  readonly sourceRecordId: string;
  readonly environmentIdentity: string;
  readonly pathId: string;
  readonly tables: readonly string[];
  readonly relationshipSchemaNames: readonly string[];
  readonly hops: readonly BusinessPathHop[];
  readonly observedTargetRows: number | null;
}

export interface BusinessPathPromotionAuthorizationInput {
  readonly sourceTable: string;
  readonly targetTable: string;
  readonly sourceRecordId: string;
  readonly environmentIdentity: string;
  readonly pathId: string;
  readonly tables: readonly string[];
  readonly relationshipSchemaNames: readonly string[];
  readonly hops: readonly BusinessPathHop[];
  readonly observedTargetRows: number | null;
}

export interface BusinessPathPromotionAuthorizationClock {
  nowMs(): number;
  nowIso(): string;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;


export function suggestedBusinessPathName(tables: readonly string[]): string {
  if (tables.length < 2) {
    return "Preferred Business Path";
  }
  const source = tables[0];
  const target = tables[tables.length - 1];
  const firstBridge = tables.length > 2 ? tables[1] : undefined;
  return firstBridge
    ? `${source} to ${target} via ${firstBridge}`
    : `${source} to ${target}`;
}

export class McpBusinessPathPromotionAuthorizationStore {
  private readonly authorizations = new Map<string, BusinessPathPromotionAuthorization>();

  public constructor(
    private readonly ttlMs: number = DEFAULT_TTL_MS,
    private readonly clock: BusinessPathPromotionAuthorizationClock = {
      nowMs: () => Date.now(),
      nowIso: () => new Date().toISOString()
    },
    private readonly idFactory: () => string = () =>
      `bpa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
  ) {}

  public issue(input: BusinessPathPromotionAuthorizationInput): BusinessPathPromotionAuthorization {
    this.prune();
    const issuedAtMs = this.clock.nowMs();
    const authorization: BusinessPathPromotionAuthorization = {
      authorizationId: this.idFactory(),
      issuedAt: this.clock.nowIso(),
      expiresAt: new Date(issuedAtMs + this.ttlMs).toISOString(),
      sourceTable: input.sourceTable,
      targetTable: input.targetTable,
      sourceRecordId: input.sourceRecordId,
      environmentIdentity: input.environmentIdentity,
      pathId: input.pathId,
      tables: [...input.tables],
      relationshipSchemaNames: [...input.relationshipSchemaNames],
      hops: input.hops.map((hop) => ({ ...hop })),
      observedTargetRows: input.observedTargetRows
    };
    this.authorizations.set(authorization.authorizationId, authorization);
    return authorization;
  }

  public get(authorizationId: string): BusinessPathPromotionAuthorization | undefined {
    this.prune();
    return this.authorizations.get(authorizationId);
  }

  public consume(authorizationId: string): void {
    this.authorizations.delete(authorizationId);
  }

  private prune(): void {
    const now = this.clock.nowMs();
    for (const [id, authorization] of this.authorizations) {
      if (Date.parse(authorization.expiresAt) <= now) {
        this.authorizations.delete(id);
      }
    }
  }
}

export const businessPathPromotionAuthorizations =
  new McpBusinessPathPromotionAuthorizationStore();
