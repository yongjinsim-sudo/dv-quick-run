import { pathMatchesRelationshipHint, selectRelationshipPath } from "./mcpRelationshipIntent.js";
import { buildRelationshipPathGuidance } from "./mcpRelationshipGuidance.js";
import { explainRelationshipPath } from "./mcpRelationshipExplainability.js";
import { presentRelationshipExplainability } from "./mcpRelationshipPresentation.js";
import { generateRelationshipQuery } from "./mcpRelationshipQueryGenerator.js";
import { mapStructuredExecutionError } from "./mcpStructuredErrors.js";
import { McpRelationshipMetadataRepository } from "./mcpRelationshipMetadataRepository.js";
import { stringArg } from "./mcpRequestArguments.js";
import type { DvqrMcpFreeToolResult } from "./mcpToolResults.js";

export class McpRelationshipQueryApplicationService {
  public constructor(private readonly metadata: McpRelationshipMetadataRepository) {}

  public async generateRelationshipQuery(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const sourceTable = stringArg(args, "sourceTable"); const targetTable = stringArg(args, "targetTable");
    if (!sourceTable || !targetTable) {
      return { ok: false, code: "InvalidArguments", message: "sourceTable and targetTable are required." };
    }
    try {
      const context = await this.metadata.metadataContext(args);
      if ("ok" in context) {
        return context;
      }
      const maxDepth = Math.max(1, Math.min(6, Number(args.maxDepth ?? 4)));
      const { ranked } = await this.metadata.discoverRankedPaths(context, sourceTable, targetTable, maxDepth, 10);
      if (!ranked.length) {
        return { ok: false, code: "InvalidArguments", message: `No verified relationship path was found from ${sourceTable} to ${targetTable}.` };
      }
      const selectedPathId = stringArg(args, "pathId");
      const relationshipHint = stringArg(args, "relationshipHint");
      const selected = selectRelationshipPath(ranked, selectedPathId, relationshipHint);
      if (!selected) {
        if (relationshipHint) {
          return {
            ok: false,
            code: "UnknownNavigationProperty",
            message: `No metadata-verified relationship named ${relationshipHint} connects ${sourceTable} to ${targetTable}. No query was generated.`,
            structuredContent: {
              contractVersion: "dvqr-mcp-relationship-query-refusal-v1",
              sourceTable,
              targetTable,
              relationshipHint,
              relationshipHintMatched: false,
              queryGenerated: false,
              placeholderQueryAllowed: false,
              evidenceBoundary: "DVQR did not emit a query because the requested relationship could not be verified from Dataverse metadata.",
              suggestedNextActions: [
                "Run dvqr_resolve_navigation_property to inspect exact direct navigation properties.",
                "Run dvqr_find_relationship_paths to inspect verified alternatives.",
                "Do not substitute or invent a navigation property."
              ]
            }
          };
        }
        return { ok: false, code: "InvalidArguments", message: "pathId did not match a verified relationship path. Copy pathId exactly from dvqr_find_relationship_paths; do not construct or guess it." };
      }
      const shapes = await Promise.all(selected.tables.map((table) => this.metadata.fetchEntityShape(context.baseEnvironmentUrl, context.token, table)));
      const generated = generateRelationshipQuery(selected, shapes, stringArg(args, "sourceRecordId"), Math.max(1, Math.min(20, Number(args.maxRecordsPerStep ?? 5))));
      const relationshipHintHonoured = relationshipHint ? pathMatchesRelationshipHint(selected, relationshipHint) : false;
      const explainability = explainRelationshipPath(selected, { relationshipHintHonoured, rank: 1 });
      return { ok: true, summary: `Generated a ${generated.recommendedMode} query plan for ${selected.tables.join(" → ")} · metadata confidence ${explainability.confidenceDisplay}.`, structuredContent: { contractVersion: "dvqr-mcp-relationship-query-v6", relationshipHint, relationshipHintHonoured: relationshipHint ? relationshipHintHonoured : undefined, selectedPath: { assessment: selected.assessment, score: selected.score, tables: selected.tables, explainability: presentRelationshipExplainability(explainability), guidance: buildRelationshipPathGuidance(selected, { relationshipHintHonoured }) }, generated } };
    } catch (error) { const structuredError = mapStructuredExecutionError(error); return { ok: false, code: "ExecutionFailed", message: structuredError.summary, structuredError }; }
  }
}
