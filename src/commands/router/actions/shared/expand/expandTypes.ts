export type ExpandShapeKind = "sibling" | "nested";

export type ExpandCandidate = {
  sourceEntityLogicalName: string;
  navigationPropertyName: string;
  targetEntityLogicalName: string;
  relationshipType: string;
  isCollection: boolean;
  displayLabel: string;
  description?: string;
};

export type SelectedExpandFieldSet = {
  navigationPropertyName: string;
  selectedFieldLogicalNames: string[];
};

export type ExpandPlanEntry = {
  navigationPropertyName: string;
  targetEntityLogicalName: string;
  selectedFieldLogicalNames: string[];
  nestedChildren?: ExpandPlanEntry[];
  depth: number;
};

export type ExpandPlan = {
  kind: ExpandShapeKind;
  sourceEntityLogicalName: string;
  entries: ExpandPlanEntry[];
};
