export type ReconstructionArtifactKind = "DVAF" | "DVIM" | "DVCE" | "DVEVM" | "DVBUR";
export type ReconstructionArtifactSupportLevel = "Supported" | "ReviewRequired" | "Partial" | "Unsupported";

export interface ReconstructionArtifactReference {
  readonly kind: ReconstructionArtifactKind;
  readonly artifactFileName: string;
  readonly entityLogicalName: string;
  readonly attributeLogicalName?: string;
  readonly displayName?: string;
  readonly reason: string;
  readonly support: ReconstructionArtifactSupportLevel;
  readonly sourceProvider?: string;
  readonly source?: string;
  readonly notes: readonly string[];
}

export interface ReconstructionArtifactCandidateViewModel {
  readonly utilityId: ReconstructionArtifactKind;
  readonly utilityName: string;
  readonly candidateTitle: string;
  readonly entityLabel: string;
  readonly attributeLabel?: string;
  readonly reason: string;
  readonly support: ReconstructionArtifactSupportLevel;
  readonly artifactFileName: string;
  readonly sourceProvider?: string;
  readonly description: string;
  readonly notes: readonly string[];
}

export const reconstructionArtifactIntro = "DV Quick Run exported reconstruction intent artifacts for external preview. These artifacts do not imply the source is correct, the target is wrong, or changes should be applied without external verification.";

export function toReconstructionArtifactCandidateViewModel(reference: ReconstructionArtifactReference): ReconstructionArtifactCandidateViewModel {
  const utility = utilityMetadata(reference.kind);
  return {
    utilityId: reference.kind,
    utilityName: utility.utilityName,
    candidateTitle: `${reference.kind} Reconstruction Candidate`,
    entityLabel: reference.entityLogicalName,
    attributeLabel: reference.attributeLogicalName
      ? reference.displayName
        ? `${reference.displayName} (${reference.attributeLogicalName})`
        : reference.attributeLogicalName
      : undefined,
    reason: reference.reason,
    support: reference.support,
    artifactFileName: reference.artifactFileName,
    sourceProvider: reference.sourceProvider,
    description: reference.notes[0] ?? utility.defaultDescription,
    notes: reference.notes.slice(1)
  };
}

function utilityMetadata(kind: ReconstructionArtifactKind): { readonly utilityName: string; readonly defaultDescription: string } {
  switch (kind) {
    case "DVAF":
      return {
        utilityName: "DV Attribute Factory",
        defaultDescription: "DV Quick Run exported source-side metadata reconstruction intent for external preview in DV Attribute Factory."
      };
    case "DVIM":
      return {
        utilityName: "DV Identity Manager",
        defaultDescription: "DV Quick Run exported source-side identity participation intent for external preview in DV Identity Manager."
      };
    case "DVCE":
      return {
        utilityName: "DV Choice Editor",
        defaultDescription: "DV Quick Run exported source-side choice reconstruction intent for external preview in DV Choice Editor."
      };
    case "DVEVM":
      return {
        utilityName: "DV Environment Variable Manager",
        defaultDescription: "DV Quick Run exported source-side environment variable reconstruction intent for external preview in DV Environment Variable Manager."
      };
    case "DVBUR":
      return {
        utilityName: "DV Bulk Upsert Runner",
        defaultDescription: "DV Quick Run exported source-side data reconstruction intent for external preview in DV Bulk Upsert Runner."
      };
    default:
      return {
        utilityName: "DV ForgeLab Utility",
        defaultDescription: "DV Quick Run exported source-side reconstruction intent for external preview in a DV ForgeLab utility."
      };
  }
}
