import type {
  BusinessPathArtifact,
  BusinessPathRevalidationResult
} from "../core/businessPaths/index.js";
import { BusinessPathRevalidationService, businessPathDisplayChain } from "../core/businessPaths/index.js";
import { WorkspaceBusinessPathRepository } from "../runtime/businessPaths/workspaceBusinessPathRepository.js";
import { McpBusinessPathMetadataProvider, businessPathEnvironmentIdentity } from "./mcpBusinessPathMetadataProvider.js";
import type { McpRelationshipMetadataRepository, McpMetadataContext } from "./mcpRelationshipMetadataRepository.js";
import type { DvqrMcpRuntimeConfiguration } from "./mcpRuntimeConfiguration.js";
import { resolveMcpWorkspaceBinding, type McpWorkspaceBinding } from "./mcpWorkspaceBinding.js";

function validationRank(state: BusinessPathRevalidationResult["state"]): number {
  switch (state) {
    case "valid": return 0;
    case "unknown": return 1;
    case "stale": return 2;
  }
}

export interface McpPreferredBusinessPathProjection {
  readonly path: BusinessPathArtifact;
  readonly validation: BusinessPathRevalidationResult;
  readonly presentationRank: number;
  readonly route: string;
  readonly relationshipSchemaNames: readonly string[];
  readonly workspaceRole: "Preferred";
  readonly currentMetadata: "valid" | "stale" | "unknown";
  readonly historicalRuntimeVerification: {
    readonly status: "verified" | "not-runtime-verified";
    readonly verifiedAt?: string;
    readonly environment?: string;
    readonly observedTargetRows?: number | null;
  };
}

export class McpPreferredBusinessPathConsumptionService {
  public constructor(
    private readonly metadata: McpRelationshipMetadataRepository,
    private readonly config: DvqrMcpRuntimeConfiguration
  ) {}

  public workspaceBinding(): McpWorkspaceBinding {
    return resolveMcpWorkspaceBinding(this.config);
  }

  public async resolve(
    context: McpMetadataContext,
    sourceTable: string,
    targetTable: string
  ): Promise<readonly McpPreferredBusinessPathProjection[]> {
    const binding = this.workspaceBinding();
    if (!binding.available) {
      return [];
    }

    const repository = new WorkspaceBusinessPathRepository(binding.workspaceRoot);
    const matching = repository
      .findMatching(sourceTable, targetTable)
      .filter((artifact) => artifact.state === "preferred");

    if (!matching.length) return [];

    const revalidator = new BusinessPathRevalidationService(
      new McpBusinessPathMetadataProvider(this.metadata, context)
    );
    const environmentId = businessPathEnvironmentIdentity(context.baseEnvironmentUrl);
    const results: McpPreferredBusinessPathProjection[] = [];

    for (const artifact of matching) {
      const validation = await revalidator.revalidate(artifact, environmentId);
      results.push({
        path: artifact,
        validation,
        presentationRank: 0,
        route: businessPathDisplayChain(artifact),
        relationshipSchemaNames: [...artifact.hops]
          .sort((left, right) => left.ordinal - right.ordinal)
          .map((hop) => hop.relationshipSchemaName),
        workspaceRole: "Preferred",
        currentMetadata: validation.state,
        historicalRuntimeVerification: artifact.verification?.status === "verified"
          ? {
              status: "verified",
              ...(artifact.verification.verifiedAt ? { verifiedAt: artifact.verification.verifiedAt } : {}),
              ...(artifact.verification.environment?.identity ? { environment: artifact.verification.environment.identity } : {}),
              ...(artifact.verification.observedTargetRows !== undefined
                ? { observedTargetRows: artifact.verification.observedTargetRows }
                : {})
            }
          : { status: "not-runtime-verified" }
      });
    }

    return results.sort((left, right) => {
      const leftPriority = left.path.priority ?? Number.MAX_SAFE_INTEGER;
      const rightPriority = right.path.priority ?? Number.MAX_SAFE_INTEGER;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      const validity = validationRank(left.validation.state) - validationRank(right.validation.state);
      if (validity !== 0) return validity;
      const leftVerifiedAt = left.path.verification?.verifiedAt ?? "";
      const rightVerifiedAt = right.path.verification?.verifiedAt ?? "";
      if (leftVerifiedAt !== rightVerifiedAt) return rightVerifiedAt.localeCompare(leftVerifiedAt);
      return left.path.id.localeCompare(right.path.id);
    }).map((item, index) => ({ ...item, presentationRank: index + 1 }));
  }
}
