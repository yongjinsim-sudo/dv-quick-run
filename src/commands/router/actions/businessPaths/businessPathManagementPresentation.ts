import type {
  BusinessPathArtifact,
  BusinessPathRevalidationResult
} from "../../../../core/businessPaths/index.js";
import {
  businessPathDisplayChain,
  businessPathVerificationLabel
} from "../../../../core/businessPaths/index.js";

export interface BusinessPathLibraryItemModel {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly detail: string;
}

export interface BusinessPathDetailModel {
  readonly title: string;
  readonly lines: readonly string[];
}

export function buildBusinessPathLibraryItem(
  artifact: BusinessPathArtifact
): BusinessPathLibraryItemModel {
  const preferred = artifact.state === "preferred";
  const stateLabel = preferred ? "Preferred" : artifact.state === "saved" ? "Saved" : "Disabled";
  return {
    id: artifact.id,
    label: `${preferred ? "★" : "○"} ${artifact.name}`,
    description: [
      stateLabel,
      artifact.priority !== undefined ? `Priority ${artifact.priority}` : undefined,
      businessPathVerificationLabel(artifact)
    ].filter(Boolean).join(" · "),
    detail: businessPathDisplayChain(artifact)
  };
}

export function buildBusinessPathDetail(
  artifact: BusinessPathArtifact,
  revalidation?: BusinessPathRevalidationResult
): BusinessPathDetailModel {
  const ordered = [...artifact.hops].sort((left, right) => left.ordinal - right.ordinal);
  const lines = [
    `Path ID: ${artifact.id}`,
    `State: ${artifact.state === "preferred" ? "Preferred" : artifact.state === "saved" ? "Saved" : "Disabled"}`,
    `Route: ${businessPathDisplayChain(artifact)}`,
    `Priority: ${artifact.priority ?? "Default"}`,
    `Verification: ${businessPathVerificationLabel(artifact)}`,
    artifact.verification?.environment?.identity
      ? `Historically verified environment: ${artifact.verification.environment.identity}`
      : undefined,
    revalidation ? `Current metadata: ${revalidation.state}` : "Current metadata: Not checked",
    revalidation?.issues[0]?.message
      ? `Validation note: ${revalidation.issues[0].message}`
      : undefined,
    artifact.description ? `Description: ${artifact.description}` : undefined,
    "Exact hops:",
    ...ordered.map((hop) =>
      `  ${hop.ordinal}. ${hop.fromTable} → ${hop.toTable} · ${hop.relationshipSchemaName}`
    ),
    `Promoted from: ${artifact.provenance.promotedFrom}`,
    `Updated: ${artifact.updatedAt}`
  ].filter((value): value is string => Boolean(value));

  return {
    title: artifact.name,
    lines
  };
}
