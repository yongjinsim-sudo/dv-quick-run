import { DVQR_MCP_CONTRACT_VERSION, type DvqrMcpCapabilityManifestV1 } from "./mcpContracts.js";
import { DVQR_MCP_TOOL_CATALOGUE } from "./mcpToolCatalogue.js";

export function createDvqrMcpCapabilityManifest(): DvqrMcpCapabilityManifestV1 {
  return {
    contractVersion: DVQR_MCP_CONTRACT_VERSION,
    product: "DV Quick Run",
    releaseVersion: "0.15.7",
    mode: "local-read-only-foundation",
    transport: "unbound",
    mutationAuthority: "none",
    evidenceAcquisition: "none",
    tools: DVQR_MCP_TOOL_CATALOGUE,
    limitations: [
      "The semantic foundation itself acquires no evidence; the live stdio runtime separately exposes bounded Free read-only query tools.",
      "Readiness operations do not mutate workspaces; Pro investigation-session tools may create bounded local state under .dvforgelab/dvqr/investigations.",
      "Authentication, hosted topology, and server lifecycle remain transport concerns outside the semantic adapter.",
      "DVQR provides bounded Mini RCA interpretation and does not establish operational approval."
    ]
  };
}
