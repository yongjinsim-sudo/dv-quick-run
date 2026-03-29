import type { ActiveTraversalProgress } from "./traversalTypes.js";

let activeTraversalProgress: ActiveTraversalProgress | undefined;

export function setActiveTraversalProgress(progress: ActiveTraversalProgress): void {
  activeTraversalProgress = progress;
}

export function getActiveTraversalProgress(): ActiveTraversalProgress | undefined {
  return activeTraversalProgress;
}

export function clearActiveTraversalProgress(): void {
  activeTraversalProgress = undefined;
}

export function isActiveTraversalSession(sessionId: string): boolean {
  return !!activeTraversalProgress && activeTraversalProgress.sessionId === sessionId;
}