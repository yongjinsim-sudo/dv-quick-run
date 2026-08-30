import { mapStructuredExecutionError } from "./mcpStructuredErrors.js";
import { stringArg } from "./mcpRequestArguments.js";
import type { DvqrMcpFreeToolResult } from "./mcpToolResults.js";
import { McpRelationshipMetadataRepository } from "./mcpRelationshipMetadataRepository.js";
import { rankBusinessPathCandidates } from "./mcpBusinessPathDiscovery.js";
import { McpPreferredBusinessPathConsumptionService } from "./mcpPreferredBusinessPathConsumptionService.js";
import type { DvqrMcpRuntimeConfiguration } from "./mcpRuntimeConfiguration.js";

export class McpBusinessPathDiscoveryApplicationService {
  private readonly preferredPaths: McpPreferredBusinessPathConsumptionService;

  public constructor(
    private readonly metadata: McpRelationshipMetadataRepository,
    config: DvqrMcpRuntimeConfiguration
  ) {
    this.preferredPaths = new McpPreferredBusinessPathConsumptionService(metadata, config);
  }

  public async discoverBusinessPaths(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const sourceTable = stringArg(args, "sourceTable");
    const targetTable = stringArg(args, "targetTable");
    if (!sourceTable || !targetTable) {
      return { ok: false, code: "InvalidArguments", message: "sourceTable and targetTable are required." };
    }

    try {
      const context = await this.metadata.metadataContext(args);
      if ("ok" in context) return context;
      const workspaceBinding = this.preferredPaths.workspaceBinding();
      const workspacePreferredPaths = await this.preferredPaths.resolve(context, sourceTable, targetTable);
      const validPreferredPaths = workspacePreferredPaths.filter((item) => item.currentMetadata === "valid");
      const primaryPreferredPath = validPreferredPaths[0] ?? workspacePreferredPaths[0];
      const maxDepth = Math.max(2, Math.min(6, Number(args.maxDepth ?? 5)));
      const maxPaths = Math.max(1, Math.min(20, Number(args.maxPaths ?? 8)));
      const discovered = await this.metadata.discoverDepthDiverseBusinessPaths(context, sourceTable, targetTable, maxDepth, Math.max(maxPaths * 2, 12));
      const catalogue = await this.metadata.fetchEntityCatalogue(context.baseEnvironmentUrl, context.token);
      const ranked = rankBusinessPathCandidates(discovered.ranked, catalogue).slice(0, maxPaths);
      const present = ranked.map((candidate, index) => ({
        rank: index + 1,
        pathId: candidate.pathId,
        tables: candidate.tables,
        bridgeTables: candidate.bridgeTables,
        hopCount: candidate.hops.length,
        assessment: candidate.assessment,
        businessPathScore: candidate.businessPathScore,
        metadataTraversalScore: candidate.metadataTraversalScore,
        evidenceState: candidate.evidenceState,
        signals: candidate.signals,
        hops: candidate.hops.map((hop) => ({
          fromTable: hop.fromTable,
          toTable: hop.toTable,
          navigationProperty: hop.navigationProperty,
          relationshipSchemaName: hop.relationshipSchemaName,
          referencingAttribute: hop.referencingAttribute,
          relationshipType: hop.relationshipType,
          direction: hop.direction,
          polymorphicTargetQualified: hop.polymorphicTargetQualified
        })),
        limitations: candidate.limitations
      }));

      const candidatesByHopCount = present.reduce<Record<string, number>>((counts, candidate) => {
        const key = String(candidate.hopCount);
        counts[key] = (counts[key] ?? 0) + 1;
        return counts;
      }, {});

      return {
        ok: true,
        summary: primaryPreferredPath
          ? `Workspace Preferred Business Path: ${primaryPreferredPath.route} · metadata ${primaryPreferredPath.currentMetadata}. Metadata-ranked alternatives remain separate${present[0] ? `; top discovered candidate: ${present[0].tables.join(" → ")} · score ${present[0].businessPathScore}/100` : ""}.`
          : present.length
            ? `Top metadata-only business-path candidate: ${present[0].tables.join(" → ")} · score ${present[0].businessPathScore}/100.`
            : `No metadata-valid business-path candidates were found from ${sourceTable} to ${targetTable} within depth ${maxDepth}.`,
        structuredContent: {
          contractVersion: "dvqr-mcp-business-path-discovery-v1.1",
          sourceTable,
          targetTable,
          discoveryMode: "MetadataOnly",
          rankingBasis: "VerifiedRelationshipMetadataPlusDeterministicBusinessSemantics",
          preferenceConsumption: {
            mode: "WorkspacePreferenceOverlay",
            workspace: workspaceBinding.available
              ? {
                  available: true,
                  workspaceRoot: workspaceBinding.workspaceRoot,
                  businessPathDirectory: workspaceBinding.businessPathDirectory,
                  source: workspaceBinding.source
                }
              : {
                  available: false,
                  source: workspaceBinding.source,
                  reason: workspaceBinding.reason
                },
            changesDiscoveryScores: false,
            topVisiblePreferredPath: primaryPreferredPath,
            workspacePreferredPaths,
            presentationRule: "A metadata-valid workspace Preferred Business Path is presented before metadata-ranked discovered alternatives without changing their scores or order."
          },
          candidateDiscoveryStrategy: "DepthDiverseWorkflowHubExpansion",
          searchBounds: {
            maxDepth,
            maxPaths,
            tablesInspected: discovered.coverage.tablesInspected,
            graphNodesInspected: discovered.nodes.size,
            graphEdgesInspected: discovered.edges.length,
            explorationComplete: discovered.coverage.explorationComplete,
            directPathsFound: discovered.coverage.directPathsFound,
            bridgedPathsFound: discovered.coverage.bridgedPathsFound,
            operationalHubsInspected: discovered.coverage.operationalHubsInspected,
            candidatesByHopCount
          },
          distinction: {
            workspacePreferred: "Explicit persisted organisational/workspace guidance; not an algorithmic score.",
            metadataValid: "Current relationship metadata revalidation state.",
            historicalRuntimeVerification: "Persisted bounded evidence from an earlier successful canonical saved-path test, when present. Any observedTargetRows value is historical and non-exhaustive; it is not a current row count.",
            currentRuntimeViable: "Unknown for this request until a source record is tested."
          },
          preferredBusinessPath: primaryPreferredPath,
          topVisibleRecommendation: primaryPreferredPath
            ? {
                kind: "WorkspacePreferredBusinessPath",
                pathId: primaryPreferredPath.path.id,
                route: primaryPreferredPath.route,
                currentMetadata: primaryPreferredPath.currentMetadata,
                historicalRuntimeVerification: primaryPreferredPath.historicalRuntimeVerification
              }
            : present[0]
              ? {
                  kind: "MetadataRankedCandidate",
                  pathId: present[0].pathId,
                  route: present[0].tables.join(" → "),
                  businessPathScore: present[0].businessPathScore
                }
              : undefined,
          metadataRecommendedCandidate: present[0],
          recommendedCandidate: present[0],
          alternatives: present.slice(1),
          candidateCount: present.length,
          suggestedNextActions: present.length ? [
            "If preferredBusinessPath is present and the user asks to reverify/revalidate it against the current environment or current metadata, use dvqr_revalidate_business_path exactly once; that metadata-only operation requires no source record. Use dvqr_verify_business_path only for an explicit runtime verification request with a source record, and use dvqr_test_business_path when the user asks to test/use the saved path for a record. Do not pair a runtime operation with dvqr_revalidate_business_path or manually reconstruct the route with OData.",
            "For discovered alternatives, use bounded runtime validation before treating them as data-viable.",
            "Validate candidates hop-by-hop before calling any route data-viable or business-preferred.",
            "Keep direct relationships as baselines; do not equate an empty direct route with a missing downstream business record.",
            "Depth-diverse discovery intentionally retains plausible multi-hop business routes even when direct relationships exist."
          ] : ["Verify the source and target logical names or increase maxDepth cautiously."],
          limitations: [
            "Pass 10.1 performs metadata-only discovery and ranking; it does not execute Dataverse record queries.",
            "A higher business-path score means stronger metadata-based business-flow signals, not proof of runtime usage.",
            "Discovery itself does not persist preference. Existing workspace Preferred paths are consumed as a presentation overlay and remain distinct from discovery scoring.",
            "Direct relationships do not suppress deeper workflow candidates; the candidate set is deliberately depth-diverse before business ranking."
          ]
        }
      };
    } catch (error) {
      const structuredError = mapStructuredExecutionError(error);
      return { ok: false, code: "ExecutionFailed", message: structuredError.summary, structuredError };
    }
  }
}
