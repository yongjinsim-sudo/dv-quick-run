import * as vscode from "vscode";
import { CommandContext } from "../../../../context/commandContext.js";
import { logDebug } from "../../../../../utils/logger.js";

export type MetadataLoadOptions = {
  silent?: boolean;
  suppressOutput?: boolean;
  /**
   * Bypass in-memory and persisted metadata caches for evidence capture paths.
   * Snapshot evidence must prefer fresh Dataverse metadata over browsing caches.
   */
  forceRefresh?: boolean;
};

export function appendOutput(
  ctx: CommandContext,
  message: string,
  options?: MetadataLoadOptions
): void {
  if (!options?.suppressOutput) {
    logDebug(ctx.output, message);
  }
}

export async function runMetadataLoad<T>(
  title: string,
  factory: () => Promise<T>,
  options?: MetadataLoadOptions
): Promise<T> {
  if (options?.silent) {
    return factory();
  }

  return vscode.window.withProgress<T>(
    {
      location: vscode.ProgressLocation.Notification,
      title,
      cancellable: false
    },
    async () => await factory()
  );
}

export function normalizeMetadataName(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}
