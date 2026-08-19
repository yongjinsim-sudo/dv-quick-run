import type {
  BusinessPathArtifact,
  BusinessPathRevalidationResult
} from "../core/businessPaths/index.js";
import type { DvqrMcpFreeToolResult } from "./mcpToolResults.js";
import type { McpBusinessPathRuntimeValidationApplicationService } from "./mcpBusinessPathRuntimeValidationApplicationService.js";
import {
  buildPreferredBusinessPathRuntimeArgs
} from "./mcpBusinessPathRuntimeReuse.js";

export interface McpPreferredBusinessPathRuntimeValidationRequest {
  readonly artifact: BusinessPathArtifact;
  readonly revalidation: BusinessPathRevalidationResult;
  readonly sourceRecordId: string;
  readonly runtimeArguments?: Readonly<Record<string, unknown>>;
  readonly maxCandidates?: number;
  readonly maxRecordsPerStep?: number;
  readonly maxProbeRequests?: number;
  readonly maxDepth?: number;
}

/**
 * Reuses the existing Business Path runtime validator for a saved Preferred path.
 *
 * This service does not implement traversal, discovery, ranking, or row probing.
 * It only supplies the exact saved path identity to the existing validator after
 * current metadata revalidation has already established `valid`.
 */
export class McpPreferredBusinessPathRuntimeValidationService {
  public constructor(
    private readonly runtimeValidator: Pick<
      McpBusinessPathRuntimeValidationApplicationService,
      "validateBusinessPaths"
    >
  ) {}

  public async validatePreferredPath(
    request: McpPreferredBusinessPathRuntimeValidationRequest
  ): Promise<DvqrMcpFreeToolResult> {
    return await this.runtimeValidator.validateBusinessPaths(
      buildPreferredBusinessPathRuntimeArgs(request)
    );
  }
}
