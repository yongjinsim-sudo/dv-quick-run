export const DVQR_SCORE_NORMALIZATION_VERSION = "dvqr-density-v1";

export interface DvqrScorePrimitiveDefinition {
  key: string;
  label: string;
  maxContribution: number;
  softCap: number;
  explanation: string;
}

export const DVQR_SCORE_PRIMITIVES: readonly DvqrScorePrimitiveDefinition[] = [
  {
    key: "relationships",
    label: "Broad Relationship Surface",
    maxContribution: 25,
    softCap: 600,
    explanation: "Relationship fanout increases investigation spread and nearby traversal surface area."
  },
  {
    key: "plugins",
    label: "Heavy Runtime Participation",
    maxContribution: 25,
    softCap: 300,
    explanation: "Plugin participation increases runtime execution density and operational touchpoints."
  },
  {
    key: "workflows",
    label: "Significant Orchestration Density",
    maxContribution: 20,
    softCap: 20,
    explanation: "Workflow and flow participation increases orchestration density and asynchronous investigation context."
  },
  {
    key: "solutionParticipation",
    label: "Operational Packaging Participation",
    maxContribution: 10,
    softCap: 12,
    explanation: "Solution participation adds operational packaging and layering context."
  },
  {
    key: "activityParticipation",
    label: "Activity Timeline Participation",
    maxContribution: 5,
    softCap: 2,
    explanation: "Activity participation can add operational timeline and interaction context."
  },
  {
    key: "customisationDensity",
    label: "Customisation Footprint",
    maxContribution: 5,
    softCap: 3,
    explanation: "Managed/custom metadata evidence adds customization-footprint context."
  },
  {
    key: "ownershipModel",
    label: "Ownership Complexity",
    maxContribution: 5,
    softCap: 1,
    explanation: "Ownership model evidence adds contextual ownership complexity and operational variability."
  }
];
