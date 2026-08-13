import { McpCustomApiExecutionEvidenceStore, type McpCustomApiExecutionEvidenceRepository } from "./mcpCustomApiExecutionEvidenceStore.js";
import { McpCustomApiExecutionPreviewSessionStore } from "./mcpCustomApiExecutionPreviewSessionStore.js";

export interface DvqrMcpFreeRuntimeState {
  readonly customApiExecutionPreviewSessions: McpCustomApiExecutionPreviewSessionStore;
  readonly customApiExecutionEvidence: McpCustomApiExecutionEvidenceRepository;
}

export function createDvqrMcpFreeRuntimeState(): DvqrMcpFreeRuntimeState {
  return {
    customApiExecutionPreviewSessions: new McpCustomApiExecutionPreviewSessionStore(),
    customApiExecutionEvidence: new McpCustomApiExecutionEvidenceStore()
  };
}
