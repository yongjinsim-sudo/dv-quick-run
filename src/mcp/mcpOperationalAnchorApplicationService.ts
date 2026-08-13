import { rankOperationalAnchors } from "./mcpOperationalAnchorDiscovery.js";
import { mapStructuredExecutionError } from "./mcpStructuredErrors.js";
import { stringArg } from "./mcpRequestArguments.js";
import type { DvqrMcpFreeToolResult } from "./mcpToolResults.js";
import type { McpRelationshipEdge } from "./mcpRelationshipIntelligence.js";
import { McpRelationshipMetadataRepository } from "./mcpRelationshipMetadataRepository.js";

export class McpOperationalAnchorApplicationService {
  public constructor(private readonly metadata: McpRelationshipMetadataRepository) {}

  public async discoverOperationalAnchors(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const sourceTable = stringArg(args, "sourceTable");
    if (!sourceTable) {
      return { ok: false, code: "InvalidArguments", message: "sourceTable is required." };
    }
    try {
      const context = await this.metadata.metadataContext(args);
      if ("ok" in context) return context;
      const maxDepth = Math.max(1, Math.min(5, Number(args.maxDepth ?? 3)));
      const maxResults = Math.max(1, Math.min(20, Number(args.maxResults ?? 8)));
      const maxTablesInspected = Math.max(10, Math.min(100, Number(args.maxTablesInspected ?? 60)));
      const catalogue = await this.metadata.fetchEntityCatalogue(context.baseEnvironmentUrl, context.token);
      const queue: Array<{ table: string; depth: number }> = [{ table: sourceTable, depth: 0 }];
      const inspected = new Set<string>();
      const depthByTable = new Map<string, number>([[sourceTable.toLowerCase(), 0]]);
      const edges: McpRelationshipEdge[] = [];
      const relationshipInspectionFailures: Array<{ table: string; depth: number; message: string }> = [];
      while (queue.length && inspected.size < maxTablesInspected) {
        const current = queue.shift()!;
        const key = current.table.toLowerCase();
        if (inspected.has(key)) continue;
        inspected.add(key);
        if (current.depth >= maxDepth) continue;
        let tableEdges: McpRelationshipEdge[];
        try {
          tableEdges = await this.metadata.fetchRelationships(context.baseEnvironmentUrl, context.token, current.table);
        } catch (error) {
          // Pass 10.7.5.1: relationship-context is foundational metadata evidence and should
          // remain usable when a *downstream* table cannot expose relationship metadata.
          // Preserve the source-table failure as fatal, because without source relationships
          // there is no honest relationship context to persist. For later breadth-expansion
          // failures, record bounded coverage loss and continue rather than failing the whole
          // managed provider.
          if (key === sourceTable.toLowerCase()) throw error;
          relationshipInspectionFailures.push({
            table: current.table,
            depth: current.depth,
            message: error instanceof Error ? error.message : "Relationship metadata inspection failed."
          });
          continue;
        }
        edges.push(...tableEdges);
        for (const edge of tableEdges) {
          const next = edge.toTable.toLowerCase();
          const nextDepth = current.depth + 1;
          if (!depthByTable.has(next) || nextDepth < depthByTable.get(next)!) depthByTable.set(next, nextDepth);
          if (nextDepth < maxDepth && !inspected.has(next)) queue.push({ table: edge.toTable, depth: nextDepth });
        }
      }
      const anchors = rankOperationalAnchors({ sourceTable, entities: catalogue, edges, depthByTable, maxResults });
      const operationalAnchors = anchors.filter((anchor) => anchor.role === "OperationalAnchor");
      const workItems = anchors.filter((anchor) => anchor.role === "WorkItem");
      const capabilityOrder = ["Governance", "Domain", "Scheduling", "Coordination", "Execution", "Integration"] as const;
      const capabilityModel = capabilityOrder.map((capability) => {
        const objects = anchors
          .filter((anchor) => anchor.capabilityProfile.some((signal) => signal.capability === capability))
          .map((anchor) => ({
            logicalName: anchor.logicalName,
            displayName: anchor.displayName,
            role: anchor.role,
            score: anchor.capabilityProfile.find((signal) => signal.capability === capability)!.score,
            evidence: anchor.capabilityProfile.find((signal) => signal.capability === capability)!.evidence
          }))
          .sort((left, right) => right.score - left.score || left.logicalName.localeCompare(right.logicalName));
        return objects.length ? { capability, confidence: objects[0].score >= 70 ? "high" : objects[0].score >= 40 ? "medium" : "low", objects } : undefined;
      }).filter((item): item is NonNullable<typeof item> => !!item);
      const primaryCapability = capabilityModel
        .filter((item) => item.objects.some((object) => object.role === "OperationalAnchor"))
        .sort((left, right) => right.objects[0].score - left.objects[0].score || left.capability.localeCompare(right.capability))[0];
      const confidenceState = (score?: number) => score === undefined
        ? "Unknown"
        : score >= 70
          ? "HighConfidence"
          : score >= 40
            ? "MediumConfidence"
            : "RuntimeVerificationRecommended";
      const capabilityLandscape = [
        { layer: "CoreDomain", label: "Core Domain", capabilities: ["Domain"] },
        { layer: "Coordination", label: "Coordination", capabilities: ["Coordination"] },
        { layer: "Execution", label: "Execution", capabilities: ["Execution", "Scheduling"] },
        { layer: "Governance", label: "Governance", capabilities: ["Governance"] },
        { layer: "Platform", label: "Platform", capabilities: ["Integration"] }
      ].map((layer) => ({
        ...layer,
        capabilities: capabilityModel
          .filter((item) => layer.capabilities.includes(item.capability))
          .map((item) => ({
            capability: item.capability,
            confidenceState: confidenceState(item.objects[0]?.score),
            evidenceType: "StructuralMetadata",
            objects: item.objects.slice(0, 5)
          }))
      })).filter((layer) => layer.capabilities.length > 0);
      const conclusionCard = (title: string, candidate: typeof anchors[number] | undefined) => candidate ? {
        title,
        subject: candidate.logicalName,
        displayName: candidate.displayName,
        confidenceState: confidenceState(candidate.score),
        score: candidate.score,
        evidenceType: "StructuralMetadata",
        whyWeBelieveThis: candidate.reasons.slice(0, 5).map((reason) => reason.message),
        runtimeStatus: "NotProbed",
        uncertainty: "This conclusion is metadata-derived. Runtime participation must be verified separately."
      } : {
        title,
        confidenceState: "Unknown",
        evidenceType: "InsufficientEvidence",
        whyWeBelieveThis: [],
        runtimeStatus: "NotProbed",
        uncertainty: "No bounded metadata candidate was strong enough to support this conclusion."
      };
      const learnFirst = [operationalAnchors[0], ...operationalAnchors.slice(1, 3), workItems[0]]
        .filter((item, index, all): item is NonNullable<typeof item> => !!item && all.findIndex((candidate) => candidate?.logicalName === item.logicalName) === index)
        .map((item) => ({ logicalName: item.logicalName, displayName: item.displayName, reason: item.reasons[0]?.message }));
      return {
        ok: true,
        summary: operationalAnchors.length
          ? `Top metadata-derived operational anchor: ${operationalAnchors[0].logicalName} (${operationalAnchors[0].score}/100).`
          : `No high-confidence operational anchor was found within depth ${maxDepth}.`,
        structuredContent: {
          contractVersion: "dvqr-mcp-business-capability-understanding-v3",
          sourceTable,
          searchBounds: { maxDepth, maxResults, maxTablesInspected },
          discoveryCoverage: {
            tablesInspected: inspected.size,
            graphEdgesInspected: edges.length,
            explorationComplete: queue.length === 0 && relationshipInspectionFailures.length === 0,
            relationshipMetadataFailures: relationshipInspectionFailures.length,
            inaccessibleOrFailedTables: relationshipInspectionFailures.slice(0, 12)
          },
          recommendationBasis: "StructuralMetadataFirstWithSupportingSemantics",
          investigationSummary: {
            primaryBusinessCapability: primaryCapability?.capability,
            primaryOperationalAnchor: operationalAnchors[0]?.logicalName,
            primaryWorkExecutionLayer: workItems[0]?.logicalName,
            overallConfidenceState: confidenceState(operationalAnchors[0]?.score),
            evidencePosture: "MetadataDerivedRuntimeUnverified",
            plainEnglishNarrative: operationalAnchors.length
              ? `${sourceTable} participates in a metadata-derived capability landscape organised around ${operationalAnchors[0].displayName ?? operationalAnchors[0].logicalName}. Downstream execution appears to occur through ${workItems[0]?.displayName ?? workItems[0]?.logicalName ?? "work-item-like tables"}. Runtime evidence is still required before claiming that any specific record follows this architecture.`
              : `DV Quick Run did not find enough bounded metadata evidence to describe a reliable operational architecture from ${sourceTable}.`
          },
          confidenceFramework: {
            HighConfidence: "Strong bounded structural evidence supports the conclusion; runtime may still be unverified.",
            MediumConfidence: "Meaningful structural evidence exists, but important corroboration is limited.",
            RuntimeVerificationRecommended: "Metadata suggests the conclusion, but bounded runtime probing is recommended before relying on it.",
            Unknown: "The available metadata and runtime evidence are insufficient to support a conclusion."
          },
          capabilityLandscape,
          architecturalConclusions: [
            conclusionCard("Primary Operational Anchor", operationalAnchors[0]),
            conclusionCard("Primary Work Execution Layer", workItems[0]),
            conclusionCard("Primary Governance Layer", anchors.find((anchor) => anchor.primaryCapability === "Governance")),
            conclusionCard("Primary Scheduling Layer", anchors.find((anchor) => anchor.primaryCapability === "Scheduling")),
            conclusionCard("Primary Integration Layer", anchors.find((anchor) => anchor.primaryCapability === "Integration"))
          ],
          businessCapabilityModel: capabilityModel,
          recommendedAnchor: operationalAnchors[0],
          operationalAnchors,
          supportingAnchors: anchors.filter((anchor) => anchor.role === "SupportingAnchor"),
          downstreamWorkItems: workItems,
          executiveSummary: {
            ifIJoinedTomorrow: {
              learnFirst,
              ignoreInitially: ["Generic platform infrastructure", "Low-signal administrative tables", "Unverified semantic matches"],
              onboardingValue: "Use this bounded architecture model to reduce initial manual schema exploration; no fixed time saving is claimed."
            }
          },
          suggestedNextActions: operationalAnchors.length
            ? [
                "Review capabilityLandscape and architecturalConclusions before choosing an investigation starting point.",
                "Run dvqr_find_relationship_paths from the source table to the recommended anchor.",
                "Then discover paths from the recommended anchor to task-like or activity-like work items.",
                "Provide sourceRecordId to dvqr_probe_relationship_path for bounded runtime evidence after the workflow path is metadata verified."
              ]
            : ["Increase maxDepth cautiously or inspect the supporting anchors."],
          limitations: [
            "Capability classification and anchor ranking are metadata-derived; they do not claim runtime data exists.",
            "A work-item table can be important evidence without being the business anchor that explains why the work exists.",
            "Runtime probing and domain interpretation remain separate from metadata anchor ranking.",
            ...(relationshipInspectionFailures.length > 0
              ? [`Relationship metadata could not be inspected for ${relationshipInspectionFailures.length} downstream table${relationshipInspectionFailures.length === 1 ? "" : "s"}; relationship-context is partial rather than failed.`]
              : [])
          ]
        }
      };
    } catch (error) {
      const structuredError = mapStructuredExecutionError(error);
      return { ok: false, code: "ExecutionFailed", message: structuredError.summary, structuredError };
    }
  }


}
