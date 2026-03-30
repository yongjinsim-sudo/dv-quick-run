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

export type TraversalScopeSettings = {
  allowedTables: Set<string>;
  excludedTables: Set<string>;
  scopeSignature: string;
};
