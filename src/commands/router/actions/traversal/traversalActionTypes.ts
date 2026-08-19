export type TraversalEntityOption = {
  logicalName: string;
  entitySetName: string;
  primaryIdAttribute?: string;
  primaryNameAttribute?: string;
  fieldLogicalNames?: string[];
};

export type TraversalProgressReporter = {
  report: (message: string, increment?: number) => void;
};

import type { TraversalRoute } from "../shared/traversal/traversalTypes.js";

export type TraversalStartOptions = {
  isBestMatchRoute?: boolean;
  routeOptions?: TraversalRoute[];
  /**
   * Exact Preferred Business Path execution is record-scoped, like the MCP
   * runtime validator. Without this seed, traversal must not broaden to the
   * whole source table.
   */
  sourceRecordId?: string;
};

export type TraversalScopeSettings = {
  allowedTables: Set<string>;
  excludedTables: Set<string>;
  scopeSignature: string;
};
