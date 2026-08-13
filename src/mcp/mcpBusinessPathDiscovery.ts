import type { DvqrMetadataEntityCandidate } from "./mcpMetadataSearch.js";
import type { McpRankedRelationshipPath, McpRelationshipEdge } from "./mcpRelationshipIntelligence.js";

export type McpBusinessPathAssessment = "StrongCandidate" | "Candidate" | "WeakCandidate" | "InfrastructureHeavy";

export interface McpBusinessPathSignal {
  readonly code: string;
  readonly points: number;
  readonly message: string;
  readonly signalKind: "structural" | "semantic" | "boundary";
}

export interface McpBusinessPathCandidate {
  readonly pathId: string;
  readonly tables: readonly string[];
  readonly bridgeTables: readonly string[];
  readonly hops: readonly McpRelationshipEdge[];
  readonly metadataTraversalScore: number;
  readonly businessPathScore: number;
  readonly assessment: McpBusinessPathAssessment;
  readonly evidenceState: {
    readonly metadataValid: true;
    readonly runtimeViable: "Unknown";
    readonly businessPreferred: "CandidateOnly";
  };
  readonly signals: readonly McpBusinessPathSignal[];
  readonly limitations: readonly string[];
}

const normalize = (value?: string) => (value ?? "").trim().toLowerCase();

function localizedLabel(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const user = record.UserLocalizedLabel;
  if (user && typeof user === "object" && !Array.isArray(user)) {
    const candidate = (user as Record<string, unknown>).Label;
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return undefined;
}

function entityText(entity: DvqrMetadataEntityCandidate | undefined, logicalName: string): string {
  return [
    logicalName,
    entity?.SchemaName,
    localizedLabel(entity?.DisplayName),
    localizedLabel(entity?.Description)
  ].filter(Boolean).map((value) => normalize(String(value))).join(" ");
}

function isInfrastructure(text: string): boolean {
  return /\b(systemuser|team|businessunit|organization|role|principal|owner|activityparty|activitypointer|processsession|workflowlog|audit)\b/.test(text);
}

function businessContainerStrength(text: string, logicalName?: string): number {
  const stem = logicalStem(logicalName ?? "");
  // Care-plan association/detail tables can be meaningful bridges without being lifecycle containers.
  // Keep the root Care Plan and Care Plan Goal semantics strong, but avoid promoting every
  // careplanactivity* helper table to canonical-container status merely because its display name
  // contains "Care Plan".
  if (/^careplanactivity(goal|outreference|outcome|performer|reason|reasoncode|reasonreference|template)$/.test(stem)) return 6;
  if (/\b(care ?plan|case|incident|episode|encounter|referral|order|work ?order|journey|application|claim|request|assessment|service plan|health ?check|plan definition|programme|program)\b/.test(text)) return 18;
  if (/\b(plan|process|project|visit|booking|appointment|service|workflow)\b/.test(text)) return 10;
  return 0;
}

function executionStrength(text: string): number {
  return /\b(task|work ?item|activity|action|appointment|booking)\b/.test(text) ? 6 : 0;
}

function logicalStem(value: string): string {
  return normalize(value).replace(/^[a-z0-9]+_/, "");
}

function ownershipSignals(edge: McpRelationshipEdge): readonly McpBusinessPathSignal[] {
  const relationText = normalize(`${edge.navigationProperty} ${edge.relationshipSchemaName ?? ""} ${edge.referencingAttribute ?? ""}`);
  const attribute = normalize(edge.referencingAttribute);
  const source = normalize(edge.fromTable);
  const sourceStem = logicalStem(source);
  const targetStem = logicalStem(edge.toTable);
  const signals: McpBusinessPathSignal[] = [];

  // A typed parent lookup is evidence of a purposeful relationship, but the lookup alone does not
  // prove lifecycle ownership. Promote it to strong parent-child ownership only when the target also
  // extends the parent's domain lineage (for example careplan -> careplanactivity).
  if (edge.direction === "oneToMany" && attribute && (attribute === source || logicalStem(attribute) === sourceStem)) {
    const hasDomainLineage = sourceStem.length >= 4 && targetStem.startsWith(sourceStem) && targetStem !== sourceStem;

    if (hasDomainLineage) {
      signals.push({
        code: "parent_child_ownership",
        points: 18,
        message: `${edge.toTable} carries a typed parent lookup (${edge.referencingAttribute}) back to ${edge.fromTable}, and the tables share a parent-child domain lineage. Together these are strong containment signals.`,
        signalKind: "semantic"
      });
      signals.push({
        code: "domain_lineage_ownership",
        points: 12,
        message: `${edge.fromTable} and ${edge.toTable} share a parent-child domain lineage in addition to the explicit typed lookup.`,
        signalKind: "semantic"
      });
    } else {
      signals.push({
        code: "typed_parent_link",
        points: 7,
        message: `${edge.toTable} carries a typed lookup (${edge.referencingAttribute}) back to ${edge.fromTable}. This supports a purposeful association but is not, by itself, treated as proof of business lifecycle ownership.`,
        signalKind: "semantic"
      });
    }
  }

  if (/patient|subject/.test(relationText)) {
    signals.push({ code: "subject_role_semantics", points: 5, message: "The relationship identifies a patient/subject role, strengthening subject-centric business relevance.", signalKind: "semantic" });
  }

  if (/reference|regardingobjectid|outcome|performer|requester|author/.test(relationText) && !signals.some((signal) => signal.code === "parent_child_ownership")) {
    signals.push({ code: "reference_link_semantics", points: -8, message: "The hop is primarily a reference/role association rather than an ownership relationship.", signalKind: "boundary" });
  }

  return signals;
}

function relationshipBusinessSignal(edge: McpRelationshipEdge): number {
  const text = normalize(`${edge.navigationProperty} ${edge.relationshipSchemaName ?? ""} ${edge.referencingAttribute ?? ""}`);
  if (/owner|businessunit|principal|createdby|modifiedby/.test(text)) return -18;
  if (/care|patient|encounter|referral|request|plan|task|activity|appointment|booking|case|incident|order|service/.test(text)) return 5;
  return 0;
}

function classify(score: number, infrastructureCount: number): McpBusinessPathAssessment {
  if (infrastructureCount > 0 && score < 55) return "InfrastructureHeavy";
  if (score >= 78) return "StrongCandidate";
  if (score >= 55) return "Candidate";
  return "WeakCandidate";
}

export function rankBusinessPathCandidate(
  path: McpRankedRelationshipPath,
  entities: readonly DvqrMetadataEntityCandidate[]
): McpBusinessPathCandidate {
  const byName = new Map(entities.map((entity) => [normalize(String(entity.LogicalName ?? "")), entity]));
  const signals: McpBusinessPathSignal[] = [];
  let score = Math.round(path.score * 0.36);

  signals.push({
    code: "metadata_path_quality",
    points: score,
    message: `Relationship-path metadata contributes ${score} weighted points from a traversal score of ${path.score}.`,
    signalKind: "structural"
  });

  if (path.bridgeTables.length === 0) {
    score += 3;
    signals.push({ code: "direct_path_baseline", points: 3, message: "Direct relationship remains a useful baseline, but directness alone is not treated as business preference.", signalKind: "structural" });
  } else {
    const continuity = Math.min(8, 3 + path.bridgeTables.length * 2);
    score += continuity;
    signals.push({ code: "business_continuity_shape", points: continuity, message: "A multi-hop route can represent business-process continuity rather than only a direct lookup.", signalKind: "structural" });
  }

  let infrastructureCount = 0;
  for (const table of path.bridgeTables) {
    const text = entityText(byName.get(normalize(table)), table);
    if (isInfrastructure(text)) {
      infrastructureCount += 1;
      score -= 28;
      signals.push({ code: "infrastructure_bridge", points: -28, message: `${table} appears to be platform or administrative infrastructure rather than a business bridge.`, signalKind: "boundary" });
      continue;
    }
    const container = businessContainerStrength(text, table);
    if (container) {
      score += container;
      signals.push({ code: "business_container_bridge", points: container, message: `${table} metadata suggests a business-process container or operational anchor.`, signalKind: "semantic" });
    }
    const execution = executionStrength(text);
    if (execution) {
      score += execution;
      signals.push({ code: "execution_bridge", points: execution, message: `${table} metadata suggests work execution or activity participation.`, signalKind: "semantic" });
    }
  }

  for (const hop of path.hops) {
    for (const ownership of ownershipSignals(hop)) {
      score += ownership.points;
      signals.push(ownership);
    }
  }

  const hopSignal = path.hops.reduce((total, hop) => total + relationshipBusinessSignal(hop), 0);
  if (hopSignal !== 0) {
    score += hopSignal;
    signals.push({
      code: hopSignal > 0 ? "business_relationship_semantics" : "administrative_relationship_semantics",
      points: hopSignal,
      message: hopSignal > 0
        ? "Relationship names contain business-domain signals that support this candidate route."
        : "Relationship names contain administrative signals that weaken this candidate route.",
      signalKind: hopSignal > 0 ? "semantic" : "boundary"
    });
  }

  const target = path.tables[path.tables.length - 1];
  const targetExecution = target ? executionStrength(entityText(byName.get(normalize(target)), target)) : 0;
  if (targetExecution && path.bridgeTables.some((table) => businessContainerStrength(entityText(byName.get(normalize(table)), table), table) > 0)) {
    score += 8;
    signals.push({ code: "container_to_execution_shape", points: 8, message: "The route connects a business container to an execution/work-item target, a common operational-flow shape.", signalKind: "semantic" });
  }

  score = Math.max(0, Math.min(100, score));
  return {
    pathId: path.pathId,
    tables: path.tables,
    bridgeTables: path.bridgeTables,
    hops: path.hops,
    metadataTraversalScore: path.score,
    businessPathScore: score,
    assessment: classify(score, infrastructureCount),
    evidenceState: { metadataValid: true, runtimeViable: "Unknown", businessPreferred: "CandidateOnly" },
    signals: signals.sort((a, b) => Math.abs(b.points) - Math.abs(a.points) || a.code.localeCompare(b.code)),
    limitations: [
      "This is metadata-only business-path discovery; it does not prove that any source record traverses the route.",
      "Business semantics are deterministic signals from table, relationship, display-name and description metadata; they are not runtime evidence.",
      "Runtime hop validation is required before a candidate can be labelled data-viable or business-preferred."
    ]
  };
}

export function rankBusinessPathCandidates(
  paths: readonly McpRankedRelationshipPath[],
  entities: readonly DvqrMetadataEntityCandidate[]
): readonly McpBusinessPathCandidate[] {
  return paths
    .map((path) => rankBusinessPathCandidate(path, entities))
    .sort((left, right) => right.businessPathScore - left.businessPathScore || right.metadataTraversalScore - left.metadataTraversalScore || left.pathId.localeCompare(right.pathId));
}
