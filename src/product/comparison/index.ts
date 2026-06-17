export {
  createComparisonEvidenceSnapshot,
  createOperationalComparisonSnapshotDocument,
  flattenComparisonSnapshotDocuments,
  normalizeComparisonEnvironmentIdentity,
  validateComparisonSnapshotDocument
} from "./comparisonSnapshotBuilder.js";
export type {
  ComparisonEnvironmentIdentity,
  ComparisonEvidenceSnapshot,
  ComparisonSnapshotEvidenceType,
  ComparisonSnapshotIntegrity,
  ComparisonSnapshotLineage,
  ComparisonSnapshotLineageOrigin,
  ComparisonSnapshotMetadata,
  ComparisonSnapshotTrustState,
  ComparisonSnapshotValidationResult,
  OperationalComparisonSnapshotDocument
} from "./comparisonSnapshotTypes.js";

export {
  buildSnapshotRegistryEntry,
  clearComparisonSnapshotRegistry,
  createSnapshotId,
  deleteComparisonSnapshot,
  getFavouriteComparisonSnapshotIds,
  getRegisteredComparisonSnapshots,
  registerComparisonSnapshot,
  setComparisonSnapshotFavourite,
  setComparisonSnapshotLabel
} from "./comparisonSnapshotRegistry.js";
export type { ComparisonSnapshotRegistryEntry } from "./comparisonSnapshotRegistry.js";

export {
  calculateOperationalComparisonSnapshotHash,
  COMPARISON_SNAPSHOT_CANONICALIZATION,
  COMPARISON_SNAPSHOT_INTEGRITY_ALGORITHM,
  verifyOperationalComparisonSnapshotIntegrity
} from "./comparisonSnapshotIntegrity.js";

export {
  buildSnapshotFileName,
  buildSnapshotWorkspaceFileUri,
  slugSnapshotSegment,
  buildSnapshotWorkspaceLayout,
  createEvidenceWorkspace,
  copySnapshotFilePath,
  copySnapshotWorkspacePath,
  ensureSnapshotWorkspace,
  openComparisonWorkspaceFolder,
  openReportWorkspaceFolder,
  ensureSnapshotWorkspaceFileParent,
  openSnapshotWorkspaceFolder,
  resolveSnapshotWorkspace,
  revealSnapshotFileInExplorer
} from "./snapshotWorkspaceService.js";
export type { CreatedEvidenceWorkspace, SnapshotWorkspaceLayout, SnapshotWorkspaceResolution } from "./snapshotWorkspaceService.js";

export { resolveSnapshotSelection } from "./snapshotSelectionService.js";
export type { SnapshotSelectionDescriptor, SnapshotSelectionMode } from "./snapshotSelectionService.js";
