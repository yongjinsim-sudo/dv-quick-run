export type ReconstructionArtifactKind = "DVAF";
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
