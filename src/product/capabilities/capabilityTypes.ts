export type CapabilityLevel = 0 | 1 | 2 | 3;

export interface CapabilitySet {
  queryDoctor: CapabilityLevel;
  investigationDepth: CapabilityLevel;
  traversalDepth: CapabilityLevel;
}
