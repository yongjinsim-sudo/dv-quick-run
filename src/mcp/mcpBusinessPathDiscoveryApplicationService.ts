import { mapStructuredExecutionError } from "./mcpStructuredErrors.js";
import { stringArg } from "./mcpRequestArguments.js";
import type { DvqrMcpFreeToolResult } from "./mcpToolResults.js";
import { McpRelationshipMetadataRepository } from "./mcpRelationshipMetadataRepository.js";
import { rankBusinessPathCandidates } from "./mcpBusinessPathDiscovery.js";

export class McpBusinessPathDiscoveryApplicationService {
  public constructor(private readonly metadata: McpRelationshipMetadataRepository) {}

  public async discoverBusinessPaths(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const sourceTable = stringArg(args, "sourceTable");
    const targetTable = stringArg(args, "targetTable");
    if (!sourceTable || !targetTable) {
      return { ok: false, code: "InvalidArguments", message: "sourceTable and targetTable are required." };
    }

    try {
      const context = await this.metadata.metadataContext(args);
      if ("ok" in context) return context;
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
        summary: present.length
          ? `Top metadata-only business-path candidate: ${present[0].tables.join(" → ")} · score ${present[0].businessPathScore}/100.`
          : `No metadata-valid business-path candidates were found from ${sourceTable} to ${targetTable} within depth ${maxDepth}.`,
        structuredContent: {
          contractVersion: "dvqr-mcp-business-path-discovery-v1.1",
          sourceTable,
          targetTable,
          discoveryMode: "MetadataOnly",
          rankingBasis: "VerifiedRelationshipMetadataPlusDeterministicBusinessSemantics",
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
            metadataValid: "Verified now",
            runtimeViable: "Unknown until hop-by-hop runtime validation",
            businessPreferred: "Unknown until runtime and investigation evidence support preference"
          },
          recommendedCandidate: present[0],
          alternatives: present.slice(1),
          candidateCount: present.length,
          suggestedNextActions: present.length ? [
            "Use the returned pathId with bounded relationship probing when a representative source record is available.",
            "Validate candidates hop-by-hop before calling any route data-viable or business-preferred.",
            "Keep direct relationships as baselines; do not equate an empty direct route with a missing downstream business record.",
            "Depth-diverse discovery intentionally retains plausible multi-hop business routes even when direct relationships exist."
          ] : ["Verify the source and target logical names or increase maxDepth cautiously."],
          limitations: [
            "Pass 10.1 performs metadata-only discovery and ranking; it does not execute Dataverse record queries.",
            "A higher business-path score means stronger metadata-based business-flow signals, not proof of runtime usage.",
            "No path is persisted as business-preferred in this pass.",
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
