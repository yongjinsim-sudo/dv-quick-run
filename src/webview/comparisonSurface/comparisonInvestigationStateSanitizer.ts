export interface ComparisonInvestigationStateSnapshot {
  readonly activeMode?: string;
  readonly baselineExportedAt?: string;
  readonly reviewedSurfaces?: readonly string[];
  readonly verifiedItems?: readonly string[];
  readonly verificationStatusByItem?: Record<string, string>;
  readonly verificationNotesByItem?: Record<string, string>;
}

function isCompleteVerificationStatus(status: string | undefined): boolean {
  return status === "VerifiedExternally" || status === "RecheckedCurrent" || status === "ResolvedOutsideDvqr";
}

function asInvestigationStateSnapshot(value: unknown): ComparisonInvestigationStateSnapshot {
  if (!value || typeof value !== "object") {
    return {};
  }

  return value as ComparisonInvestigationStateSnapshot;
}

export function extractRenderedVerificationItemIds(markup: string): readonly string[] {
  const ids = new Set<string>();
  const pattern = /data-verification-item-id="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markup)) !== null) {
    if (match[1]) {
      ids.add(match[1]);
    }
  }

  return [...ids];
}

export function sanitizeComparisonInvestigationStateForRenderedVerificationItems(
  initialInvestigationState: unknown,
  renderedVerificationItemIds: readonly string[]
): ComparisonInvestigationStateSnapshot {
  const initialState = asInvestigationStateSnapshot(initialInvestigationState);
  const renderedVerificationIdSet = new Set(renderedVerificationItemIds.filter(Boolean));

  const baseState: ComparisonInvestigationStateSnapshot = {
    activeMode: initialState.activeMode,
    baselineExportedAt: initialState.baselineExportedAt,
    reviewedSurfaces: Array.isArray(initialState.reviewedSurfaces) ? [...initialState.reviewedSurfaces] : []
  };

  if (renderedVerificationIdSet.size === 0) {
    return {
      ...baseState,
      verifiedItems: [],
      verificationStatusByItem: {},
      verificationNotesByItem: {}
    };
  }

  const sourceStatuses = initialState.verificationStatusByItem && typeof initialState.verificationStatusByItem === "object"
    ? initialState.verificationStatusByItem
    : {};
  const sourceNotes = initialState.verificationNotesByItem && typeof initialState.verificationNotesByItem === "object"
    ? initialState.verificationNotesByItem
    : {};
  const verificationStatusByItem: Record<string, string> = {};
  const verificationNotesByItem: Record<string, string> = {};

  for (const itemId of Object.keys(sourceStatuses)) {
    if (renderedVerificationIdSet.has(itemId)) {
      verificationStatusByItem[itemId] = sourceStatuses[itemId] ?? "NotReviewed";
    }
  }

  for (const itemId of Object.keys(sourceNotes)) {
    if (renderedVerificationIdSet.has(itemId)) {
      verificationNotesByItem[itemId] = sourceNotes[itemId] ?? "";
    }
  }

  const verifiedItems = new Set(
    (Array.isArray(initialState.verifiedItems) ? initialState.verifiedItems : [])
      .filter((itemId): itemId is string => typeof itemId === "string" && renderedVerificationIdSet.has(itemId))
  );

  for (const [itemId, status] of Object.entries(verificationStatusByItem)) {
    if (isCompleteVerificationStatus(status)) {
      verifiedItems.add(itemId);
    }
  }

  return {
    ...baseState,
    verifiedItems: [...verifiedItems],
    verificationStatusByItem,
    verificationNotesByItem
  };
}
