import * as vscode from "vscode";
import { randomUUID } from "crypto";
import type { ComparisonSnapshotLineage, OperationalComparisonSnapshotDocument } from "./comparisonSnapshotTypes.js";

const SNAPSHOT_REGISTRY_KEY = "dvQuickRun.comparison.snapshotRegistry.v1";
const SNAPSHOT_FAVOURITES_KEY = "dvQuickRun.comparison.snapshotFavourites.v1";
const MAX_REGISTRY_ITEMS = 100;

export interface ComparisonSnapshotRegistryEntry {
  readonly snapshotId: string;
  readonly fileUri: string;
  readonly label: string;
  readonly environmentLabel: string;
  readonly environmentUrl?: string;
  readonly entityLogicalName?: string;
  readonly entityDisplayName?: string;
  readonly capturedAtIso: string;
  readonly sourceFeature: string;
  readonly evidenceTypes: readonly string[];
  readonly lineage?: ComparisonSnapshotLineage;
  readonly isFavourite?: boolean;
}

export function createSnapshotId(): string {
  return randomUUID();
}

export function buildSnapshotRegistryEntry(args: {
  readonly document: OperationalComparisonSnapshotDocument;
  readonly fileUri: vscode.Uri;
  readonly snapshotId?: string;
}): ComparisonSnapshotRegistryEntry {
  const operationalProfile = args.document.evidenceSnapshots.find((snapshot) => snapshot.evidenceType === "OperationalProfile")?.evidence as {
    readonly entityLogicalName?: string;
    readonly entityDisplayName?: string;
  } | undefined;

  const identity = args.document.snapshotIdentity;
  const entityLogicalName = identity?.entityLogicalName ?? operationalProfile?.entityLogicalName;
  const entityDisplayName = identity?.entityDisplayName ?? operationalProfile?.entityDisplayName;
  const evidenceTypes = [...new Set(args.document.evidenceSnapshots.map((snapshot) => snapshot.evidenceType))].sort();
  const entityLabel = entityDisplayName ?? entityLogicalName ?? "Operational snapshot";
  const environmentLabel = identity?.environmentLabel ?? args.document.environment.label;
  const snapshotId = args.snapshotId ?? identity?.snapshotId ?? createSnapshotId();

  return {
    snapshotId,
    fileUri: args.fileUri.toString(),
    label: identity?.label ?? `${entityLabel} · ${environmentLabel}`,
    environmentLabel,
    environmentUrl: identity?.environmentUrl ?? args.document.environment.environmentUrl,
    entityLogicalName,
    entityDisplayName,
    capturedAtIso: identity?.capturedAtIso ?? args.document.capturedAtIso,
    sourceFeature: identity?.sourceFeature ?? args.document.sourceFeature,
    evidenceTypes,
    lineage: args.document.lineage
  };
}

export function getFavouriteComparisonSnapshotIds(context: vscode.ExtensionContext): readonly string[] {
  return context.globalState.get<readonly string[]>(SNAPSHOT_FAVOURITES_KEY, []);
}

export function getRegisteredComparisonSnapshots(context: vscode.ExtensionContext): readonly ComparisonSnapshotRegistryEntry[] {
  const favouriteIds = new Set(getFavouriteComparisonSnapshotIds(context));
  const entries = context.globalState.get<readonly ComparisonSnapshotRegistryEntry[]>(SNAPSHOT_REGISTRY_KEY, []);
  return entries
    .filter((entry) => Boolean(entry.fileUri && entry.environmentLabel && entry.capturedAtIso))
    .map((entry) => ({ ...entry, isFavourite: favouriteIds.has(entry.snapshotId) }))
    .sort((left, right) => {
      if (left.isFavourite !== right.isFavourite) {
        return left.isFavourite ? -1 : 1;
      }

      return right.capturedAtIso.localeCompare(left.capturedAtIso);
    });
}

export async function registerComparisonSnapshot(
  context: vscode.ExtensionContext,
  entry: ComparisonSnapshotRegistryEntry
): Promise<void> {
  const current = getRegisteredComparisonSnapshots(context).filter((existing) => existing.fileUri !== entry.fileUri);
  const next = [entry, ...current].slice(0, MAX_REGISTRY_ITEMS);
  await context.globalState.update(SNAPSHOT_REGISTRY_KEY, next);
}

export async function setComparisonSnapshotFavourite(
  context: vscode.ExtensionContext,
  snapshotId: string,
  isFavourite: boolean
): Promise<void> {
  const current = new Set(getFavouriteComparisonSnapshotIds(context));
  if (isFavourite) {
    current.add(snapshotId);
  } else {
    current.delete(snapshotId);
  }

  await context.globalState.update(SNAPSHOT_FAVOURITES_KEY, [...current]);
}


export async function setComparisonSnapshotLabel(
  context: vscode.ExtensionContext,
  snapshotId: string,
  label: string
): Promise<void> {
  const trimmed = label.trim();
  const current = context.globalState.get<readonly ComparisonSnapshotRegistryEntry[]>(SNAPSHOT_REGISTRY_KEY, []);
  const next = current.map((entry) => entry.snapshotId === snapshotId
    ? { ...entry, label: trimmed || entry.label }
    : entry);
  await context.globalState.update(SNAPSHOT_REGISTRY_KEY, next);
}

export async function deleteComparisonSnapshot(
  context: vscode.ExtensionContext,
  snapshotId: string
): Promise<void> {
  const current = context.globalState.get<readonly ComparisonSnapshotRegistryEntry[]>(SNAPSHOT_REGISTRY_KEY, []);
  const next = current.filter((entry) => entry.snapshotId !== snapshotId);
  await context.globalState.update(SNAPSHOT_REGISTRY_KEY, next);

  const favourites = getFavouriteComparisonSnapshotIds(context).filter((id) => id !== snapshotId);
  await context.globalState.update(SNAPSHOT_FAVOURITES_KEY, favourites);
}

export async function clearComparisonSnapshotRegistry(context: vscode.ExtensionContext): Promise<void> {
  await context.globalState.update(SNAPSHOT_REGISTRY_KEY, []);
  await context.globalState.update(SNAPSHOT_FAVOURITES_KEY, []);
}
