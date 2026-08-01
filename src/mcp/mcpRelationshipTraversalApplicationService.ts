import type { McpRankedRelationshipPath } from "./mcpRelationshipIntelligence.js";
import { selectRelationshipPath } from "./mcpRelationshipIntent.js";
import { buildRelationshipPathGuidance } from "./mcpRelationshipGuidance.js";
import { explainRelationshipPath } from "./mcpRelationshipExplainability.js";
import { presentRelationshipExplainability } from "./mcpRelationshipPresentation.js";
import { mapStructuredExecutionError } from "./mcpStructuredErrors.js";
import { rankRuntimeObservations, relationshipPathFamily, selectDiverseRelationshipPaths } from "./mcpRelationshipRuntimeEvidence.js";
import { McpRelationshipMetadataRepository } from "./mcpRelationshipMetadataRepository.js";
import { McpRelationshipProbeService, type McpRelationshipProbeResult } from "./mcpRelationshipProbeService.js";
import { stringArg } from "./mcpRequestArguments.js";
import type { DvqrMcpFreeToolResult } from "./mcpToolResults.js";

export class McpRelationshipTraversalApplicationService {
  public constructor(
    private readonly metadata: McpRelationshipMetadataRepository,
    private readonly probes: McpRelationshipProbeService
  ) {}

  public async probeRelationshipPath(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const sourceTable = stringArg(args, "sourceTable");
    const targetTable = stringArg(args, "targetTable");
    const sourceRecordId = stringArg(args, "sourceRecordId");
    if (!sourceTable || !targetTable || !sourceRecordId) {
      return { ok: false, code: "InvalidArguments", message: "sourceTable, targetTable and sourceRecordId are required." };
    }

    try {
      const context = await this.metadata.metadataContext(args);
      if ("ok" in context) {
        return context;
      }

      const maxDepth = Math.max(1, Math.min(6, Number(args.maxDepth ?? 4)));
      const maxRecordsPerStep = Math.max(1, Math.min(10, Number(args.maxRecordsPerStep ?? 3)));
      const maxProbeRequests = Math.max(1, Math.min(20, Number(args.maxProbeRequests ?? 8)));
      const maxFamilies = Math.max(1, Math.min(8, Number(args.maxFamilies ?? 4)));
      const maxCandidatePaths = Math.max(1, Math.min(12, Number(args.maxCandidatePaths ?? 6)));
      const requestedTargetExpansion = args.expandTargetConcept;
      const expandTargetConcept = typeof requestedTargetExpansion === "boolean"
        ? requestedTargetExpansion
        : /^(task|tasks)$/i.test(targetTable);
      const selectedPathId = stringArg(args, "pathId");
      const relationshipHint = stringArg(args, "relationshipHint");
      const explicitSelection = Boolean(selectedPathId || relationshipHint);

      const targetCandidates = await this.metadata.resolveRuntimeTargetCandidates(
        context,
        targetTable,
        !explicitSelection && expandTargetConcept,
        Math.min(4, maxFamilies)
      );
      const discovered: McpRankedRelationshipPath[] = [];
      const targetDiscovery: Array<{ targetTable: string; pathCount: number }> = [];
      for (const candidateTarget of targetCandidates) {
        const result = await this.metadata.discoverRankedPaths(context, sourceTable, candidateTarget, maxDepth, 20);
        targetDiscovery.push({ targetTable: candidateTarget, pathCount: result.ranked.length });
        discovered.push(...result.ranked);
      }

      const deduped = [...new Map(discovered.map((path) => [path.pathId, path])).values()]
        .sort((left, right) => right.score - left.score || left.pathId.localeCompare(right.pathId));
      if (!deduped.length) {
        return { ok: false, code: "InvalidArguments", message: `No verified relationship path was found from ${sourceTable} to ${targetTable}.` };
      }

      const metadataRecommendation = deduped.find((path) =>
        path.tables[path.tables.length - 1]?.toLowerCase() === targetTable.toLowerCase()
      ) ?? deduped[0];
      let candidates: readonly McpRankedRelationshipPath[];
      if (explicitSelection) {
        const selected = selectRelationshipPath(deduped, selectedPathId, relationshipHint);
        if (!selected) {
          return {
            ok: false,
            code: relationshipHint ? "UnknownNavigationProperty" : "InvalidArguments",
            message: relationshipHint
              ? `No verified path matched the requested relationship ${relationshipHint}. No runtime probe was executed.`
              : "pathId did not match a verified relationship path."
          };
        }
        candidates = [selected];
      } else {
        candidates = selectDiverseRelationshipPaths(deduped, { maxFamilies, maxCandidates: maxCandidatePaths });
      }

      const budget = { remaining: maxProbeRequests };
      const probeResults: McpRelationshipProbeResult[] = [];
      for (const candidate of candidates) {
        if (budget.remaining <= 0) {
          break;
        }
        probeResults.push(await this.probes.probeRankedRelationshipPath(context, candidate, sourceRecordId, maxRecordsPerStep, budget));
      }

      const observations = rankRuntimeObservations(probeResults.map((result) => result.observation));
      const runtimeWinner = observations.find((observation) => observation.reachedTarget);
      const runtimeRecommendationPath = runtimeWinner
        ? deduped.find((path) => path.pathId === runtimeWinner.pathId)
        : undefined;
      const probesUsed = maxProbeRequests - budget.remaining;
      const runtimeRecommendation = runtimeWinner && runtimeRecommendationPath
        ? {
            pathId: runtimeWinner.pathId,
            tables: runtimeWinner.tables,
            targetTable: runtimeWinner.targetTable,
            family: runtimeWinner.family,
            investigationScore: runtimeWinner.investigationScore,
            runtimeEvidenceScore: runtimeWinner.runtimeEvidenceScore,
            finalTargetRecordCount: runtimeWinner.finalTargetRecordCount,
            explainability: presentRelationshipExplainability(explainRelationshipPath(runtimeRecommendationPath, { rank: 1 })),
            guidance: buildRelationshipPathGuidance(runtimeRecommendationPath)
          }
        : undefined;

      const summary = runtimeRecommendation
        ? `Evidence-guided probing observed ${runtimeRecommendation.finalTargetRecordCount} target record${runtimeRecommendation.finalTargetRecordCount === 1 ? "" : "s"} through ${runtimeRecommendation.tables.join(" → ")}. Metadata ranking remains unchanged; this is the top observed workflow for the current investigation.`
        : `Evidence-guided probing found no target rows across ${probeResults.length} bounded candidate path${probeResults.length === 1 ? "" : "s"}. The metadata recommendation remains valid, but no runtime workflow was observed for this source record.`;

      return {
        ok: true,
        summary,
        structuredContent: {
          contractVersion: "dvqr-mcp-relationship-probe-v5",
          mode: explicitSelection ? "ExplicitPathProbe" : "EvidenceGuidedTraversal",
          sourceTable,
          requestedTargetTable: targetTable,
          resolvedTargetCandidates: targetCandidates,
          targetDiscovery,
          sourceRecordId,
          metadataRecommendation: {
            pathId: metadataRecommendation.pathId,
            tables: metadataRecommendation.tables,
            targetTable: metadataRecommendation.tables[metadataRecommendation.tables.length - 1],
            score: metadataRecommendation.score,
            scoreKind: metadataRecommendation.scoreKind,
            family: relationshipPathFamily(metadataRecommendation),
            explainability: presentRelationshipExplainability(explainRelationshipPath(metadataRecommendation, { rank: 1 })),
            guidance: buildRelationshipPathGuidance(metadataRecommendation)
          },
          runtimeRecommendation,
          runtimeEvidence: {
            status: runtimeRecommendation ? "ObservedWorkflowRecommended" : "NoObservedWorkflow",
            observations,
            candidatesConsidered: candidates.map((candidate) => ({
              pathId: candidate.pathId,
              tables: candidate.tables,
              targetTable: candidate.tables[candidate.tables.length - 1],
              family: relationshipPathFamily(candidate),
              metadataScore: candidate.score
            })),
            probesUsed,
            probesRemaining: budget.remaining,
            familiesExplored: [...new Set(observations.map((observation) => observation.family))].length,
            pathsProbed: probeResults.length
          },
          probeResults: probeResults.map((result) => ({
            observation: result.observation,
            reachedTarget: result.reachedTarget,
            finalTargetRecordIds: result.finalTargetRecordIds,
            probeRequestsUsed: result.probeRequestsUsed,
            steps: result.steps
          })),
          bounds: {
            maxDepth,
            maxRecordsPerStep,
            maxProbeRequests,
            maxFamilies,
            maxCandidatePaths,
            expandTargetConcept
          },
          suggestedNextActions: runtimeRecommendation
            ? [
                "Use the observed workflow recommendation for this investigation while preserving the separate metadata recommendation.",
                "Generate a metadata-verified query for the observed path by passing its exact pathId to dvqr_generate_relationship_query.",
                "Treat the runtime result as source-record-specific evidence, not persistent organisational truth."
              ]
            : [
                "Retain the top metadata path as structurally valid.",
                "Try a different representative source record or increase the bounded probe budget cautiously.",
                "Do not infer that an empty sampled path is invalid."
              ],
          limitations: [
            "Runtime evidence is investigation-scoped and is never persisted into metadata ranking.",
            "A successful probe proves only that matching records were observed for this source record at this time.",
            "No-match results do not invalidate metadata relationships.",
            "Concept expansion is deterministic and bounded; related target tables still require business interpretation."
          ]
        }
      };
    } catch (error) {
      const structuredError = mapStructuredExecutionError(error);
      return { ok: false, code: "ExecutionFailed", message: structuredError.summary, structuredError };
    }
  }
}
