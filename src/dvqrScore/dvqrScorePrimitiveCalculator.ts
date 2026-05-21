import type { OperationalContextViewModel } from "../product/operationalContext/operationalContextTypes.js";
import type { OperationalProfileModel } from "../product/operationalProfile/operationalProfileTypes.js";

export type DvqrScorePrimitiveKey =
  | "relationships"
  | "plugins"
  | "workflows"
  | "solutionParticipation"
  | "activityParticipation"
  | "customisationDensity"
  | "ownershipModel";

export type DvqrScorePrimitiveValues = Record<DvqrScorePrimitiveKey, number>;

function parseLeadingNumber(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const match = value.replace(/,/g, "").match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : 0;
}

function dimensionRawValue(profile: OperationalProfileModel, dimensionId: string): number {
  const dimension = profile.dimensions.find((item) => item.id === dimensionId);
  const evidenceValue = dimension?.evidence[0]?.value;
  return parseLeadingNumber(evidenceValue ?? dimension?.valueLabel);
}

function countContextEvidence(context: OperationalContextViewModel | undefined, predicate: (evidenceType: string) => boolean): number {
  return context?.sections.flatMap((section) => section.evidence).filter((item) => predicate(item.evidenceType)).length ?? 0;
}

export function calculateDvqrScorePrimitives(profile: OperationalProfileModel): DvqrScorePrimitiveValues {
  const operationalContext = profile.operationalContext;
  const workflowParticipation = dimensionRawValue(profile, "realTimeWorkflows")
    + dimensionRawValue(profile, "businessRules")
    + profile.evidence
      .filter((item) => item.kind === "flow" || item.kind === "workflow" || item.kind === "asyncOperation")
      .map((item) => parseLeadingNumber(item.value))
      .reduce((total, value) => total + value, 0);

  const managedDimension = profile.dimensions.find((item) => item.id === "managed");
  const auditingDimension = profile.dimensions.find((item) => item.id === "auditing");

  return {
    relationships: dimensionRawValue(profile, "relationships"),
    plugins: dimensionRawValue(profile, "automation"),
    workflows: workflowParticipation,
    solutionParticipation: countContextEvidence(operationalContext, (type) => type === "SolutionParticipation"),
    activityParticipation: auditingDimension?.band === "none" ? 0 : 1,
    customisationDensity: managedDimension?.band === "none" ? 0 : 1,
    ownershipModel: countContextEvidence(operationalContext, (type) => type === "Owner")
  };
}
