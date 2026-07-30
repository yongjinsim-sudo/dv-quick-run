import type { DvqrMetadataEntityCandidate } from "./mcpMetadataSearch.js";
import type { McpRelationshipEdge } from "./mcpRelationshipIntelligence.js";

export interface McpOperationalAnchorReason {
  readonly code: string;
  readonly points: number;
  readonly message: string;
  readonly signalKind: "structural" | "semantic" | "ownership" | "boundary";
}

export type McpBusinessCapabilityDimension = "Governance" | "Domain" | "Scheduling" | "Coordination" | "Execution" | "Integration";

export interface McpBusinessCapabilitySignal {
  readonly capability: McpBusinessCapabilityDimension;
  readonly score: number;
  readonly confidence: "high" | "medium" | "low";
  readonly evidence: readonly string[];
}

export interface McpOperationalAnchorCandidate {
  readonly logicalName: string;
  readonly displayName?: string;
  readonly description?: string;
  readonly depthFromSource: number;
  readonly inboundRelationshipCount: number;
  readonly outboundRelationshipCount: number;
  readonly downstreamWorkItemCount: number;
  readonly score: number;
  readonly confidence: "high" | "medium" | "low";
  readonly role: "OperationalAnchor" | "SupportingAnchor" | "WorkItem" | "Infrastructure";
  readonly primaryCapability: McpBusinessCapabilityDimension;
  readonly capabilityProfile: readonly McpBusinessCapabilitySignal[];
  readonly reasons: readonly McpOperationalAnchorReason[];
  readonly limitations: readonly string[];
}

const normalize = (value?: string) => (value ?? "").trim().toLowerCase();

function label(value: unknown): string | undefined {
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

function isInfrastructure(name: string): boolean {
  return /^(systemuser|team|businessunit|organization|role|principal|owner|activityparty|activitypointer|processsession|workflowlog)$/.test(normalize(name));
}

function isWorkItem(name: string, displayName?: string, description?: string): boolean {
  return /(task|workitem|work item|appointment|activity|queueitem|queue item|booking)/.test(`${normalize(name)} ${normalize(displayName)} ${normalize(description)}`);
}

function semanticAnchorSignal(name: string, displayName?: string, description?: string): number {
  const text = `${normalize(name)} ${normalize(displayName)} ${normalize(description)}`;
  if (/(care ?plan|case|incident|episode|encounter|referral|order|work ?order|journey|application|claim|request|assessment|service)/.test(text)) return 18;
  if (/(plan|process|programme|program|project|event|visit)/.test(text)) return 10;
  return 0;
}

function capabilityProfile(input: {
  readonly name: string;
  readonly displayName?: string;
  readonly description?: string;
  readonly workItem: boolean;
  readonly infrastructure: boolean;
  readonly inbound: number;
  readonly outbound: number;
  readonly downstreamWorkItems: number;
}): readonly McpBusinessCapabilitySignal[] {
  const text = `${normalize(input.name)} ${normalize(input.displayName)} ${normalize(input.description)}`;
  const scores = new Map<McpBusinessCapabilityDimension, { score: number; evidence: string[] }>();
  const add = (capability: McpBusinessCapabilityDimension, points: number, evidence: string) => {
    const current = scores.get(capability) ?? { score: 0, evidence: [] };
    current.score += points;
    if (!current.evidence.includes(evidence)) current.evidence.push(evidence);
    scores.set(capability, current);
  };

  if (/(consent|authori[sz]|approval|policy|compliance|permission|eligib|clinicalflag|safety|risk|govern)/.test(text)) add("Governance", 70, "Metadata semantics indicate a control, eligibility, safety, approval, or governance role.");
  if (/(patient|clinical|care|health|assessment|observation|encounter|episode|claim|case|incident|service|order|request|plan)/.test(text)) add("Domain", 45, "Metadata semantics indicate a core business or domain record.");
  if (/(appointment|booking|schedule|slot|calendar|visit|response)/.test(text)) add("Scheduling", 75, "Metadata semantics indicate scheduling, booking, or engagement coordination.");
  if (/(referral|journey|process|orchestrat|coordina|assignment|queue|route|workflow|programme|program|project)/.test(text)) add("Coordination", 65, "Metadata semantics indicate routing, orchestration, or cross-stage coordination.");
  if (input.workItem || /(task|workitem|work item|activity|action)/.test(text)) add("Execution", 85, "The table represents work execution or activity evidence.");
  if (/(integration|api|sync|external|identity|portal|telemetry|correlation|import|export)/.test(text) || input.infrastructure) add("Integration", input.infrastructure ? 35 : 65, "Metadata semantics indicate integration, identity, platform, or cross-system participation.");

  if (input.inbound > 0 && input.outbound > 0) add("Coordination", Math.min(25, 8 + input.outbound * 2), "Both inbound and outbound relationships support an orchestration role.");
  if (input.downstreamWorkItems > 0) add("Coordination", Math.min(30, 12 + input.downstreamWorkItems * 5), "Downstream work-item connectivity supports a work-coordination role.");
  if (!scores.size) add("Domain", 20, "The table is structurally connected to the source but has limited capability-specific semantic evidence.");

  return [...scores.entries()]
    .map(([capability, value]) => ({
      capability,
      score: Math.max(0, Math.min(100, value.score)),
      confidence: value.score >= 70 ? "high" as const : value.score >= 40 ? "medium" as const : "low" as const,
      evidence: value.evidence
    }))
    .sort((a, b) => b.score - a.score || a.capability.localeCompare(b.capability));
}

export function rankOperationalAnchors(input: {
  readonly sourceTable: string;
  readonly entities: readonly DvqrMetadataEntityCandidate[];
  readonly edges: readonly McpRelationshipEdge[];
  readonly depthByTable: ReadonlyMap<string, number>;
  readonly maxResults?: number;
}): readonly McpOperationalAnchorCandidate[] {
  const byName = new Map(input.entities.map((entity) => [normalize(String(entity.LogicalName ?? "")), entity]));
  const inbound = new Map<string, number>();
  const outbound = new Map<string, number>();
  const downstreamWorkItems = new Map<string, Set<string>>();

  for (const edge of input.edges) {
    const from = normalize(edge.fromTable);
    const to = normalize(edge.toTable);
    outbound.set(from, (outbound.get(from) ?? 0) + 1);
    inbound.set(to, (inbound.get(to) ?? 0) + 1);
    if (isWorkItem(to)) {
      const set = downstreamWorkItems.get(from) ?? new Set<string>();
      set.add(to);
      downstreamWorkItems.set(from, set);
    }
  }

  const candidates: McpOperationalAnchorCandidate[] = [];
  for (const [table, depth] of input.depthByTable.entries()) {
    if (!table || table === normalize(input.sourceTable)) continue;
    const entity = byName.get(table);
    const displayName = label(entity?.DisplayName);
    const description = label(entity?.Description);
    const inCount = inbound.get(table) ?? 0;
    const outCount = outbound.get(table) ?? 0;
    const downstreamCount = downstreamWorkItems.get(table)?.size ?? 0;
    const reasons: McpOperationalAnchorReason[] = [];
    let score = 0;

    const connectivity = Math.min(28, (Math.min(inCount, 8) + Math.min(outCount, 8)) * 2);
    if (connectivity) {
      score += connectivity;
      reasons.push({ code: "relationship_centrality", points: connectivity, message: `${inCount} inbound and ${outCount} outbound relationship signals make this table structurally connected.`, signalKind: "structural" });
    }
    if (inCount > 0 && outCount > 0) {
      score += 14;
      reasons.push({ code: "bridge_shape", points: 14, message: "The table has both inbound and outbound relationships, which is consistent with a workflow anchor shape.", signalKind: "structural" });
    }
    if (downstreamCount > 0) {
      const points = Math.min(24, 12 + downstreamCount * 4);
      score += points;
      reasons.push({ code: "downstream_work_items", points, message: `${downstreamCount} downstream work-item-like table${downstreamCount === 1 ? " is" : "s are"} structurally reachable in one hop.`, signalKind: "structural" });
    }
    const semantic = semanticAnchorSignal(table, displayName, description);
    if (semantic) {
      score += semantic;
      reasons.push({ code: "business_container_semantics", points: semantic, message: "Metadata naming or description suggests a business process or operational container.", signalKind: "semantic" });
    }
    const ownership = normalize(String(entity?.OwnershipType ?? ""));
    if (/user|team/.test(ownership)) {
      score += 8;
      reasons.push({ code: "user_or_team_owned", points: 8, message: "User or team ownership is consistent with operational records that participate in day-to-day work.", signalKind: "ownership" });
    }
    if (depth === 1) {
      score += 8;
      reasons.push({ code: "source_proximity", points: 8, message: "The table is directly connected to the investigation source.", signalKind: "structural" });
    } else if (depth > 3) {
      score -= 6;
      reasons.push({ code: "deep_from_source", points: -6, message: `The table is ${depth} hops from the source, reducing its usefulness as an initial anchor.`, signalKind: "boundary" });
    }
    const infrastructure = isInfrastructure(table);
    const workItem = isWorkItem(table, displayName, description);
    if (infrastructure) {
      score -= 45;
      reasons.push({ code: "platform_infrastructure", points: -45, message: "The table appears to be platform or administrative infrastructure rather than a business workflow anchor.", signalKind: "boundary" });
    }
    if (workItem) {
      score -= 12;
      reasons.push({ code: "work_item_not_anchor", points: -12, message: "The table appears to represent work execution evidence rather than the business object that explains why the work exists.", signalKind: "boundary" });
    }

    const bounded = Math.max(0, Math.min(100, score));
    const capabilities = capabilityProfile({
      name: table,
      displayName,
      description,
      workItem,
      infrastructure,
      inbound: inCount,
      outbound: outCount,
      downstreamWorkItems: downstreamCount
    });
    candidates.push({
      logicalName: table,
      displayName,
      description,
      depthFromSource: depth,
      inboundRelationshipCount: inCount,
      outboundRelationshipCount: outCount,
      downstreamWorkItemCount: downstreamCount,
      score: bounded,
      confidence: bounded >= 65 ? "high" : bounded >= 40 ? "medium" : "low",
      role: infrastructure ? "Infrastructure" : workItem ? "WorkItem" : bounded >= 55 ? "OperationalAnchor" : "SupportingAnchor",
      primaryCapability: capabilities[0].capability,
      capabilityProfile: capabilities,
      reasons: reasons.sort((a, b) => b.points - a.points || a.code.localeCompare(b.code)),
      limitations: [
        "Anchor ranking is metadata-derived and does not prove that records exist for the current source record.",
        "Names and descriptions are supporting signals; structural relationship evidence remains the primary basis.",
        "Bounded runtime probing is required before treating an anchor as the observed workflow for an investigation."
      ]
    });
  }

  return candidates
    .sort((a, b) => b.score - a.score || a.depthFromSource - b.depthFromSource || a.logicalName.localeCompare(b.logicalName))
    .slice(0, Math.max(1, Math.min(20, input.maxResults ?? 10)));
}
