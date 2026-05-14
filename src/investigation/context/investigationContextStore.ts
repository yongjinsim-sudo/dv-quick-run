import type { InvestigationContext, InvestigationContextPatch } from "./investigationContextTypes.js";

function createContextId(): string {
  return `ctx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class InvestigationContextStore {
  private currentContext: InvestigationContext;
  private readonly listeners = new Set<(context: InvestigationContext) => void>();

  constructor(now: () => string = () => new Date().toISOString()) {
    this.currentContext = {
      id: createContextId(),
      source: "unknown",
      lastUpdatedUtc: now()
    };
  }

  getCurrent(): InvestigationContext {
    return {
      ...this.currentContext,
      currentEntity: this.currentContext.currentEntity ? { ...this.currentContext.currentEntity } : undefined,
      currentQuery: this.currentContext.currentQuery ? { ...this.currentContext.currentQuery } : undefined,
      selectedRecord: this.currentContext.selectedRecord ? { ...this.currentContext.selectedRecord } : undefined,
      traversal: this.currentContext.traversal ? { ...this.currentContext.traversal } : undefined,
      runtime: this.currentContext.runtime
        ? {
          ...this.currentContext.runtime,
          providerIds: this.currentContext.runtime.providerIds ? [...this.currentContext.runtime.providerIds] : undefined
        }
        : undefined,
      batch: this.currentContext.batch ? { ...this.currentContext.batch } : undefined,
      capabilityExecution: this.currentContext.capabilityExecution ? { ...this.currentContext.capabilityExecution } : undefined
    };
  }

  update(patch: InvestigationContextPatch, now: () => string = () => new Date().toISOString()): InvestigationContext {
    this.currentContext = {
      ...this.currentContext,
      ...patch,
      currentEntity: patch.currentEntity ? { ...this.currentContext.currentEntity, ...patch.currentEntity } : this.currentContext.currentEntity,
      currentQuery: patch.currentQuery ? { ...this.currentContext.currentQuery, ...patch.currentQuery } : this.currentContext.currentQuery,
      selectedRecord: patch.selectedRecord ? { ...this.currentContext.selectedRecord, ...patch.selectedRecord } : this.currentContext.selectedRecord,
      traversal: patch.traversal ? { ...this.currentContext.traversal, ...patch.traversal } : this.currentContext.traversal,
      runtime: patch.runtime
        ? {
          ...this.currentContext.runtime,
          ...patch.runtime,
          providerIds: patch.runtime.providerIds ? [...patch.runtime.providerIds] : this.currentContext.runtime?.providerIds
        }
        : this.currentContext.runtime,
      batch: patch.batch ? { ...this.currentContext.batch, ...patch.batch } : this.currentContext.batch,
      capabilityExecution: patch.capabilityExecution
        ? { ...this.currentContext.capabilityExecution, ...patch.capabilityExecution }
        : this.currentContext.capabilityExecution,
      lastUpdatedUtc: now()
    };

    const current = this.getCurrent();
    this.notifyListeners(current);
    return current;
  }

  onDidChange(listener: (context: InvestigationContext) => void): { dispose: () => void } {
    this.listeners.add(listener);

    return {
      dispose: () => {
        this.listeners.delete(listener);
      }
    };
  }

  private notifyListeners(context: InvestigationContext): void {
    this.listeners.forEach((listener) => {
      listener(context);
    });
  }

  reset(now: () => string = () => new Date().toISOString()): InvestigationContext {
    this.currentContext = {
      id: createContextId(),
      source: "unknown",
      lastUpdatedUtc: now()
    };

    const current = this.getCurrent();
    this.notifyListeners(current);
    return current;
  }
}

export const investigationContextStore = new InvestigationContextStore();
