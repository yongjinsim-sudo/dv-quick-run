import { pathMatchesRelationshipHint } from "./mcpRelationshipIntent.js";
import { buildRelationshipPathGuidance } from "./mcpRelationshipGuidance.js";
import { describeRelationshipPurpose, explainRelationshipPath } from "./mcpRelationshipExplainability.js";
import { presentRelationshipExplainability, presentRelationshipPurpose } from "./mcpRelationshipPresentation.js";
import { mapStructuredExecutionError } from "./mcpStructuredErrors.js";
import { selectDiverseRelationshipPaths } from "./mcpRelationshipRuntimeEvidence.js";
import { McpRelationshipMetadataRepository } from "./mcpRelationshipMetadataRepository.js";
import { stringArg } from "./mcpRequestArguments.js";
import type { DvqrMcpFreeToolResult } from "./mcpToolResults.js";

export class McpRelationshipPathDiscoveryApplicationService {
  public constructor(private readonly metadata: McpRelationshipMetadataRepository) {}

  public async findRelationshipPaths(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const sourceTable = stringArg(args, "sourceTable"); const targetTable = stringArg(args, "targetTable");
    if (!sourceTable || !targetTable) {
      return { ok:false, code:"InvalidArguments", message:"sourceTable and targetTable are required." };
    }
    try {
      const context = await this.metadata.metadataContext(args);
      if ("ok" in context) {
        return context;
      }
      const maxDepth = Math.max(1, Math.min(6, Number(args.maxDepth ?? 4)));
      const maxPaths = Math.max(1, Math.min(50, Number(args.maxPaths ?? 10)));
      const { ranked, nodes, edges, coverage } = await this.metadata.discoverRankedPaths(context, sourceTable, targetTable, maxDepth, maxPaths);
      const relationshipHint = stringArg(args, "relationshipHint");
      const hintedPath = relationshipHint ? ranked.find((path) => pathMatchesRelationshipHint(path, relationshipHint)) : undefined;
      const presentationPaths = hintedPath
        ? [hintedPath, ...selectDiverseRelationshipPaths(ranked.filter((path) => path.pathId !== hintedPath.pathId), { maxFamilies: 4, maxCandidates: 4 })]
        : selectDiverseRelationshipPaths(ranked, { maxFamilies: 5, maxCandidates: 5 });
      const compactPaths = presentationPaths.slice(0, 5).map((path, index) => ({
        rank: index + 1,
        assessment: path.assessment,
        score: path.score,
        tables: path.tables,
        pathId: path.pathId,
        explainability: presentRelationshipExplainability(explainRelationshipPath(path, { relationshipHintHonoured: !!relationshipHint && pathMatchesRelationshipHint(path, relationshipHint), rank: index + 1 })),
        whySelected: explainRelationshipPath(path, { relationshipHintHonoured: !!relationshipHint && pathMatchesRelationshipHint(path, relationshipHint), rank: index + 1 }).whySelected,
        guidance: buildRelationshipPathGuidance(path, { relationshipHintHonoured: !!relationshipHint && pathMatchesRelationshipHint(path, relationshipHint) }),
        hops: path.hops.map((hop) => ({ fromTable: hop.fromTable, toTable: hop.toTable, navigationProperty: hop.navigationProperty, relationshipType: hop.relationshipType, direction: hop.direction, referencingAttribute: hop.referencingAttribute, polymorphicTargetQualified: hop.polymorphicTargetQualified, purpose: presentRelationshipPurpose(describeRelationshipPurpose(hop)) }))
      }));
      return { ok:true, summary: presentationPaths.length ? `Top metadata-ranked path: ${presentationPaths[0].tables.join(" → ")} · ${compactPaths[0]?.explainability.confidence ?? "metadata verified"}.` : `No verified relationship path was found within depth ${maxDepth}.`, structuredContent: {
        contractVersion:"dvqr-mcp-relationship-paths-v6", sourceTable, targetTable, relationshipHint, relationshipHintMatched: relationshipHint ? !!hintedPath : undefined, searchBounds:{ maxDepth, maxPaths, graphNodesInspected:nodes.size, graphEdgesInspected:edges.length },
        discoveryCoverage: coverage,
        recommendationBasis: relationshipHint && hintedPath ? "ExplicitRelationshipIntent" : "DeterministicMetadataRanking",
        recommendedPath:compactPaths[0], alternatives:compactPaths.slice(1),
        suggestedNextActions: ranked.length ? ["Run dvqr_generate_relationship_query with this source and target to create metadata-verified query templates.", "Provide sourceRecordId to dvqr_probe_relationship_path for bounded evidence-guided traversal across materially different path families.", "For a generic target such as task, allow deterministic target-concept expansion so custom task tables can be evaluated separately from the standard activity table."] : ["Increase maxDepth cautiously or verify the table logical names."],
        limitations:["Metadata-valid paths are not proof that matching records exist.", "Up to five diverse path families are returned inline to avoid near-identical relationships consuming the entire MCP response.", "Discovery continues beyond direct matches so bounded operational workflow bridges can be considered."]
      }};
    } catch(error) { const structuredError=mapStructuredExecutionError(error); return { ok:false, code:"ExecutionFailed", message:structuredError.summary, structuredError }; }
  }
}
