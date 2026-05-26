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
  ComparisonSnapshotMetadata,
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
