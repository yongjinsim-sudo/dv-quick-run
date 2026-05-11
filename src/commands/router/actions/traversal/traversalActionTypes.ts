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
};

export type TraversalScopeSettings = {
  allowedTables: Set<string>;
  excludedTables: Set<string>;
  scopeSignature: string;
};
