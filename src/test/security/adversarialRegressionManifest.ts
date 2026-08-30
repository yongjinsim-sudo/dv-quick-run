import type { AttackFamily } from "./adversarialCase.js";

export interface AdversarialFamilyRegistration {
  readonly family: AttackFamily;
  readonly title: string;
  readonly primaryOwner: string;
  readonly supportingOwners?: readonly string[];
}

export const adversarialFamilyRegistry: readonly AdversarialFamilyRegistration[] = [
  { family: "A01", title: "Hostile Dataverse value injection", primaryOwner: "hostileContentAuthority.test.ts" },
  { family: "A02", title: "Hostile metadata injection", primaryOwner: "hostileContentAuthority.test.ts" },
  { family: "A03", title: "Malicious Business Path artifact", primaryOwner: "maliciousBusinessPathArtifacts.test.ts" },
  { family: "A04", title: "Capability spoofing / confusion", primaryOwner: "capabilityEntitlementAbuse.test.ts" },
  { family: "A05", title: "Entitlement bypass", primaryOwner: "capabilityEntitlementAbuse.test.ts" },
  { family: "A06", title: "Environment confusion", primaryOwner: "environmentIdentifierReplayAbuse.test.ts" },
  { family: "A07", title: "Identifier manipulation", primaryOwner: "environmentIdentifierReplayAbuse.test.ts" },
  { family: "A08", title: "Replay / stale authority", primaryOwner: "environmentIdentifierReplayAbuse.test.ts" },
  { family: "A09", title: "Unsafe tool chaining", primaryOwner: "toolChainingInvestigationAbuse.test.ts" },
  { family: "A10", title: "Traversal explosion / cycles", primaryOwner: "traversalResourceAbuse.test.ts" },
  { family: "A11", title: "Oversized / malformed payloads", primaryOwner: "traversalResourceAbuse.test.ts" },
  { family: "A12", title: "Workspace / path escape", primaryOwner: "workspaceFileContainment.test.ts" },
  { family: "A13", title: "Secret / diagnostic exfiltration", primaryOwner: "secretDiagnosticExfiltration.test.ts" },
  { family: "A14", title: "Evidence / prose confusion", primaryOwner: "hostileContentAuthority.test.ts" },
  {
    family: "A15",
    title: "Business Path governance escalation",
    primaryOwner: "maliciousBusinessPathArtifacts.test.ts"
  },
  {
    family: "A16",
    title: "Exact-route fallback bypass",
    primaryOwner: "businessPathLifecycleAbuse.test.ts",
    supportingOwners: ["toolChainingInvestigationAbuse.test.ts"]
  },
  { family: "A17", title: "Cross-surface semantic drift", primaryOwner: "crossSurfaceSemanticParity.test.ts" },
  {
    family: "A18",
    title: "Error-state confusion",
    primaryOwner: "businessPathLifecycleAbuse.test.ts"
  },
  { family: "A19", title: "Resource / budget abuse", primaryOwner: "traversalResourceAbuse.test.ts" },
  {
    family: "A20",
    title: "Mutation-by-content",
    primaryOwner: "hostileContentAuthority.test.ts",
    supportingOwners: ["workspaceFileContainment.test.ts", "toolChainingInvestigationAbuse.test.ts"]
  }
] as const;

export const adversarialFixtureOwners = {
  hostileText: "fixtures/hostileText.ts",
  hostileMetadata: "fixtures/hostileMetadata.ts",
  maliciousBusinessPaths: "fixtures/hostileBusinessPaths.ts",
  malformedIdentifiers: "fixtures/malformedIdentifiers.ts",
  oversizedPayloads: "fixtures/oversizedPayloads.ts",
  pathologicalGraphs: "fixtures/pathologicalGraphs.ts",
  providerErrorsAndFakeSecrets: "fixtures/providerErrors.ts"
} as const;
