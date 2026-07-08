import type {
  OperationalProfileBand,
  OperationalProfileDimension,
  OperationalProfileEvidenceItem,
  OperationalProfileInput,
  OperationalProfileFutureSurface,
  OperationalProfileModel,
  OperationalProfileNavigationAction
} from "./operationalProfileTypes.js";
import { buildOperationalProfileGuidance } from "./operationalProfileGuidanceBuilder.js";
import { buildDvqrScore } from "../../dvqrScore/dvqrScoreEngine.js";

interface BandThresholds {
  low: number;
  moderate: number;
  high: number;
  veryHigh?: number;
}

function normaliseCount(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(0, Math.floor(value));
}

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

function bandFromCount(value: number | undefined, thresholds: BandThresholds): OperationalProfileBand {
  if (typeof value !== "number" || value <= 0) {
    return "none";
  }
  if (typeof thresholds.veryHigh === "number" && value >= thresholds.veryHigh) {
    return "veryHigh";
  }
  if (value >= thresholds.high) {
    return "high";
  }
  if (value >= thresholds.moderate) {
    return "moderate";
  }
  if (value >= thresholds.low) {
    return "low";
  }
  return "none";
}

function intensityFromBand(band: OperationalProfileBand): number {
  switch (band) {
    case "veryHigh":
      return 95;
    case "high":
      return 75;
    case "moderate":
      return 52;
    case "low":
      return 28;
    case "partial":
      return 55;
    case "none":
      return 8;
  }
}

function bandLabel(band: OperationalProfileBand): string {
  switch (band) {
    case "veryHigh":
      return "Very high";
    case "high":
      return "High";
    case "moderate":
      return "Moderate";
    case "low":
      return "Low";
    case "partial":
      return "Partial";
    case "none":
      return "None observed";
  }
}

function createEvidence(item: OperationalProfileEvidenceItem | undefined): OperationalProfileEvidenceItem[] {
  return item ? [item] : [];
}

function createCountEvidence(args: {
  kind: OperationalProfileEvidenceItem["kind"];
  label: string;
  count: number | undefined;
  suffix: string;
  actionId?: string;
  detail?: string;
}): OperationalProfileEvidenceItem | undefined {
  if (typeof args.count !== "number") {
    return undefined;
  }

  return {
    kind: args.kind,
    label: args.label,
    value: `${formatCount(args.count)} ${args.suffix}`,
    detail: args.detail,
    actionId: args.actionId
  };
}

function evidenceStateLabel(evidence: readonly OperationalProfileEvidenceItem[], band: OperationalProfileBand): string {
  if (!evidence.length) {
    return "No evidence observed";
  }

  return bandLabel(band);
}

function managedStateLabel(input: OperationalProfileInput): string {
  if (input.isPartiallyManaged) {
    return "Partially managed";
  }
  if (input.isManaged) {
    return "Managed";
  }
  return "No evidence observed";
}

function auditStateLabel(input: OperationalProfileInput): string {
  if (input.auditingEnabled === true) {
    return "Auditing enabled";
  }
  if (input.auditingEnabled === false) {
    return "Auditing not enabled";
  }
  return "No evidence observed";
}

function createDimension(args: {
  id: string;
  label: string;
  band: OperationalProfileBand;
  valueLabel: string;
  explanation: string;
  whyItMatters: string;
  evidence: OperationalProfileEvidenceItem[];
  evidenceStateLabel?: string;
  stateKind?: "density" | "managed" | "context";
}): OperationalProfileDimension {
  return {
    ...args,
    evidenceStateLabel: args.evidenceStateLabel ?? evidenceStateLabel(args.evidence, args.band),
    intensityPercent: intensityFromBand(args.band)
  };
}

function highestComplexityBand(dimensions: OperationalProfileDimension[]): OperationalProfileBand {
  const densityDimensions = dimensions.filter((dimension) => dimension.stateKind !== "managed" && dimension.stateKind !== "context");
  const countByBand = densityDimensions.reduce(
    (accumulator, dimension) => {
      accumulator[dimension.band] += 1;
      return accumulator;
    },
    { none: 0, low: 0, moderate: 0, high: 0, veryHigh: 0, partial: 0 } satisfies Record<OperationalProfileBand, number>
  );

  const elevatedDimensionCount = countByBand.high + countByBand.veryHigh;
  const moderateOrHigherCount = countByBand.moderate + elevatedDimensionCount;

  if (
    countByBand.veryHigh >= 2
    || (countByBand.veryHigh >= 1 && countByBand.high >= 1)
    || (countByBand.veryHigh >= 1 && countByBand.moderate >= 1)
    || countByBand.high >= 2
    || (countByBand.high >= 1 && countByBand.moderate >= 2)
  ) {
    return "high";
  }

  if (countByBand.veryHigh === 1 || countByBand.high === 1 || moderateOrHigherCount >= 2) {
    return "moderate";
  }

  if (countByBand.moderate === 1 || countByBand.low > 0 || countByBand.partial > 0) {
    return "low";
  }

  return "none";
}


function bandAtLeast(band: OperationalProfileBand, minimum: OperationalProfileBand): boolean {
  const rank: Record<OperationalProfileBand, number> = {
    none: 0,
    low: 1,
    partial: 1,
    moderate: 2,
    high: 3,
    veryHigh: 4
  };
  return rank[band] >= rank[minimum];
}

function buildNavigationAction(args: OperationalProfileNavigationAction): OperationalProfileNavigationAction {
  return args;
}

function buildOperationalProfileNavigationActions(
  dimensions: readonly OperationalProfileDimension[]
): OperationalProfileNavigationAction[] {
  const actions: OperationalProfileNavigationAction[] = [];
  const byId = new Map(dimensions.map((dimension) => [dimension.id, dimension]));

  const automation = byId.get("automation");
  if (bandAtLeast(automation?.band ?? "none", "moderate")) {
    actions.push(buildNavigationAction({
      actionId: "viewPluginSteps",
      label: "View plugin registrations",
      description: "Inspect synchronous plugin touchpoints for this entity.",
      priority: bandAtLeast(automation?.band ?? "none", "high") ? "primary" : "secondary",
      evidenceDimensionIds: ["automation"]
    }));
  }

  const asyncLoad = byId.get("asyncLoad");
  if (bandAtLeast(asyncLoad?.band ?? "none", "low")) {
    actions.push(buildNavigationAction({
      actionId: "viewAsyncOperations",
      label: "Investigate async operations",
      description: "Open recent asyncoperation evidence scoped to this entity.",
      priority: bandAtLeast(asyncLoad?.band ?? "none", "moderate") ? "primary" : "secondary",
      evidenceDimensionIds: ["asyncLoad"]
    }));
  }

  const realTimeWorkflows = byId.get("realTimeWorkflows");
  const workflows = byId.get("workflows");
  if (bandAtLeast(realTimeWorkflows?.band ?? workflows?.band ?? "none", "low")) {
    actions.push(buildNavigationAction({
      actionId: "viewRealtimeWorkflows",
      label: "Inspect real-time workflows",
      description: "Review synchronous workflow participation for this entity.",
      priority: bandAtLeast(realTimeWorkflows?.band ?? "none", "moderate") ? "primary" : "secondary",
      evidenceDimensionIds: ["realTimeWorkflows"]
    }));
  }

  const businessRules = byId.get("businessRules");
  if (bandAtLeast(businessRules?.band ?? "none", "low")) {
    actions.push(buildNavigationAction({
      actionId: "viewBusinessRules",
      label: "View business rules",
      description: "Inspect form/table rule logic associated with this entity.",
      priority: "secondary",
      evidenceDimensionIds: ["businessRules"]
    }));
  }

  const relationships = byId.get("relationships");
  if (bandAtLeast(relationships?.band ?? "none", "moderate")) {
    actions.push(buildNavigationAction({
      actionId: "viewRelationships",
      label: "Review relationship footprint",
      description: "Use relationship evidence to decide traversal direction.",
      priority: bandAtLeast(relationships?.band ?? "none", "high") ? "primary" : "secondary",
      evidenceDimensionIds: ["relationships"]
    }));
  }

  return actions.slice(0, 5);
}

function buildOperationalProfileFutureSurfaces(): OperationalProfileFutureSurface[] {
  return [
    {
      id: "explainUnderstanding",
      label: "Explain Understanding",
      description: "Explain execution participation and investigation mechanics for OData and FetchXML queries while preserving technical evidence references.",
      availability: "available"
    },
    {
      id: "timelineInvestigation",
      label: "Timeline Understanding",
      description: "Reconstruct snapshot evolution and determine first-observed investigation windows across three or more same-environment snapshots.",
      availability: "available"
    },
    {
      id: "crossEnvironmentUnderstanding",
      label: "Cross Environment Understanding",
      description: "Compare environments and explain operational differences using evidence-backed understanding rather than raw diffs alone.",
      availability: "proRoadmap"
    },
    {
      id: "miniRcaExperimental",
      label: "Mini RCA (Experimental)",
      description: "Correlate available understanding into ranked operational explanations while preserving bounded, evidence-backed investigation.",
      availability: "proExperimental"
    },
    {
      id: "auditUnderstanding",
      label: "Audit Understanding",
      description: "Narrow first-observed windows with audit evidence where available. Audit enriches understanding but does not prove causality.",
      availability: "proRoadmap"
    }
  ];
}

function buildSummary(headlineBand: OperationalProfileBand): string {
  if (headlineBand === "high" || headlineBand === "veryHigh") {
    return "This entity shows high operational density based on the available evidence. Use it to choose where to investigate first, not as root-cause proof.";
  }

  if (headlineBand === "moderate") {
    return "This entity shows moderate operational density. Review the evidence before assuming execution complexity is caused by any single layer.";
  }

  if (headlineBand === "low") {
    return "This entity shows some operational participation. Use the evidence sections as investigation context rather than root-cause proof.";
  }

  return "No strong operational density signals were observed from the provided evidence.";
}

function buildScoreAwareSummary(displayScore: number): string {
  if (displayScore >= 86) {
    return "This entity shows very high operational density based on the available evidence. Use it to choose where to investigate first, not as root-cause proof.";
  }

  if (displayScore >= 61) {
    return "This entity shows high operational density based on the available evidence. Use it to choose where to investigate first, not as root-cause proof.";
  }

  if (displayScore >= 41) {
    return "This entity shows moderate operational density. Review the evidence before assuming execution complexity is caused by any single layer.";
  }

  if (displayScore >= 21) {
    return "This entity shows some operational participation. Use the evidence sections as investigation context rather than root-cause proof.";
  }

  return "No strong operational density signals were observed from the provided evidence.";
}

/**
 * Builds an entity-scoped Operational Profile model from already-bounded evidence.
 *
 * This engine intentionally produces explainable bands and evidence rows only. It must
 * not infer root cause, reconstruct timelines, perform hidden scans, or produce opaque
 * weighted scores.
 */
export function buildOperationalProfile(input: OperationalProfileInput): OperationalProfileModel {
  const entityLogicalName = input.entityLogicalName.trim();
  const entityDisplayName = input.entityDisplayName?.trim() || entityLogicalName;
  const syncPluginSteps = normaliseCount(input.synchronousPluginStepCount);
  const totalPluginSteps = normaliseCount(input.totalPluginStepCount);
  const relationships = normaliseCount(input.relationshipCount);
  const attributes = normaliseCount(input.attributeCount);
  const asyncTotal = normaliseCount(input.asyncOperationCount7d);
  const asyncDistinct = normaliseCount(input.distinctAsyncOperationCount7d);
  const flowReferences = normaliseCount(input.flowReferenceCount);
  const activeWorkflows = normaliseCount(input.activeWorkflowCount);
  const businessRules = normaliseCount(input.businessRuleCount);
  const realTimeWorkflows = normaliseCount(input.realTimeWorkflowCount);

  const pluginEvidence = createCountEvidence({
    kind: "pluginRegistration",
    label: "Plugin Registrations",
    count: syncPluginSteps,
    suffix: "synchronous steps",
    actionId: "viewPluginSteps"
  });
  const relationshipEvidence = createCountEvidence({
    kind: "relationship",
    label: "Relationships",
    count: relationships,
    suffix: relationships === 1 ? "relationship" : "relationships",
    actionId: "viewRelationships"
  });
  const attributeEvidence = createCountEvidence({
    kind: "attribute",
    label: "Columns",
    count: attributes,
    suffix: attributes === 1 ? "attribute" : "attributes",
    actionId: "viewColumns"
  });
  const asyncEvidence = typeof asyncTotal === "number" || typeof asyncDistinct === "number"
    ? {
        kind: "asyncOperation" as const,
        label: "Async Operations (7d)",
        value: `${typeof asyncTotal === "number" ? formatCount(asyncTotal) : "0"} total${typeof asyncDistinct === "number" ? ` / ${formatCount(asyncDistinct)} distinct` : ""}`,
        actionId: "viewAsyncOperations"
      }
    : undefined;
  const flowEvidence = createCountEvidence({
    kind: "flow",
    label: "Power Automate / Flow",
    count: flowReferences,
    suffix: flowReferences === 1 ? "flow references this entity" : "flows reference this entity",
    actionId: "viewFlows"
  });
  const workflowEvidence = createCountEvidence({
    kind: "workflow",
    label: "Workflows",
    count: activeWorkflows,
    suffix: activeWorkflows === 1 ? "active workflow" : "active workflows",
    actionId: "viewWorkflows"
  });
  const realTimeWorkflowEvidence = createCountEvidence({
    kind: "workflow",
    label: "Real-time Workflows",
    count: realTimeWorkflows,
    suffix: realTimeWorkflows === 1 ? "real-time workflow" : "real-time workflows",
    actionId: "viewRealtimeWorkflows",
    detail: "synchronous workflow participation"
  });
  const businessRuleEvidence = createCountEvidence({
    kind: "businessRule",
    label: "Business Rules",
    count: businessRules,
    suffix: businessRules === 1 ? "business rule" : "business rules",
    actionId: "viewBusinessRules"
  });
  const auditEvidence = typeof input.auditingEnabled === "boolean"
    ? {
        kind: "audit" as const,
        label: "Auditing",
        value: input.auditingEnabled ? "Enabled" : "Not enabled",
        detail: "entity audit setting"
      }
    : undefined;
  const managedEvidence = input.isManaged || input.isPartiallyManaged
    ? {
        kind: "managedState" as const,
        label: "Managed",
        value: input.isPartiallyManaged ? "Partially managed" : "Managed",
        detail: input.managedDetail
      }
    : undefined;

  const automationCountForBand = Math.max(syncPluginSteps ?? 0, totalPluginSteps ?? 0);
  const asyncCountForBand = Math.max(asyncTotal ?? 0, asyncDistinct ?? 0);

  const dimensions = [
    createDimension({
      id: "automation",
      label: "Automation (Plugin Steps)",
      band: bandFromCount(automationCountForBand, { low: 1, moderate: 11, high: 21, veryHigh: 41 }),
      valueLabel: typeof syncPluginSteps === "number" ? `${formatCount(syncPluginSteps)} synchronous plugin steps` : "No plugin step evidence provided",
      explanation: "Plugin registration density is operational participation evidence, not causality.",
      whyItMatters: "Synchronous plugin steps can add execution touchpoints and make write behaviour harder to reason about.",
      evidence: createEvidence(pluginEvidence)
    }),
    createDimension({
      id: "relationships",
      label: "Relationships",
      band: bandFromCount(relationships, { low: 1, moderate: 50, high: 71, veryHigh: 121 }),
      valueLabel: typeof relationships === "number" ? `${formatCount(relationships)} relationships` : "No relationship evidence provided",
      explanation: "Relationship fanout may increase the investigation surface area.",
      whyItMatters: "High relationship fanout can make traversal, expansion, and related-record investigation branch quickly.",
      evidence: createEvidence(relationshipEvidence)
    }),
    createDimension({
      id: "columns",
      label: "Columns",
      band: bandFromCount(attributes, { low: 1, moderate: 150, high: 300, veryHigh: 600 }),
      valueLabel: typeof attributes === "number" ? `${formatCount(attributes)} attributes` : "No attribute evidence provided",
      explanation: "Attribute volume can increase query and interpretation complexity.",
      whyItMatters: "Large column sets can make result inspection noisier and increase the need for focused $select usage.",
      evidence: createEvidence(attributeEvidence)
    }),
    createDimension({
      id: "asyncLoad",
      label: "Async Load",
      band: bandFromCount(asyncCountForBand, { low: 1, moderate: 250, high: 1000, veryHigh: 5000 }),
      valueLabel: typeof asyncTotal === "number" ? `${formatCount(asyncTotal)} async operations observed` : "No asyncoperation evidence provided",
      explanation: "Asyncoperation volume indicates background operational participation only.",
      whyItMatters: "High async activity can make delayed processing and repeated background execution worth checking.",
      evidence: createEvidence(asyncEvidence)
    }),
    createDimension({
      id: "businessRules",
      label: "Business Rules",
      band: bandFromCount(businessRules, { low: 1, moderate: 3, high: 8, veryHigh: 16 }),
      valueLabel: typeof businessRules === "number" ? `${formatCount(businessRules)} business rules` : "No business rule evidence provided",
      explanation: "Business Rules are surfaced as form/table logic participation, not as causality.",
      whyItMatters: "Business Rules can contribute validation and field-behaviour logic that is useful to inspect during entity investigation.",
      evidence: createEvidence(businessRuleEvidence)
    }),
    createDimension({
      id: "realTimeWorkflows",
      label: "Real-time Workflows",
      band: bandFromCount(realTimeWorkflows, { low: 1, moderate: 1, high: 5, veryHigh: 11 }),
      valueLabel: typeof realTimeWorkflows === "number" ? `${formatCount(realTimeWorkflows)} real-time workflows` : "No real-time workflow evidence provided",
      explanation: "Real-time workflows are synchronous workflow participation evidence, not proof of execution impact.",
      whyItMatters: "Synchronous workflow layers can add execution touchpoints during record operations and may be useful to review with plugin evidence.",
      evidence: createEvidence(realTimeWorkflowEvidence)
    }),
    createDimension({
      id: "auditing",
      label: "Auditing",
      band: input.auditingEnabled === true ? "low" : "none",
      valueLabel: typeof input.auditingEnabled === "boolean" ? (input.auditingEnabled ? "Auditing enabled" : "Auditing not enabled") : "No auditing evidence provided",
      explanation: "Auditing is surfaced as operational context and must not be treated as performance or quality judgement.",
      whyItMatters: "Audit-enabled entities can produce additional operational records that may help investigation when change history is relevant.",
      evidence: createEvidence(auditEvidence),
      evidenceStateLabel: auditStateLabel(input),
      stateKind: "context"
    }),
    createDimension({
      id: "managed",
      label: "Managed",
      band: input.isPartiallyManaged ? "partial" : input.isManaged ? "low" : "none",
      valueLabel: input.isPartiallyManaged ? `Partially managed${input.managedDetail ? ` (${input.managedDetail})` : ""}` : input.isManaged ? "Managed" : "No managed-state evidence provided",
      explanation: "Managed state is surfaced as operational context and must not be treated as a defect.",
      whyItMatters: "Managed components can affect what can be changed safely and may explain locked or layered customisation behaviour.",
      evidence: createEvidence(managedEvidence),
      evidenceStateLabel: managedStateLabel(input),
      stateKind: "managed"
    })
  ];

  const evidence = dimensions
    .flatMap((dimension) => dimension.evidence)
    .concat(createEvidence(flowEvidence), createEvidence(workflowEvidence));
  const headlineBand = highestComplexityBand(dimensions);
  const guidance = buildOperationalProfileGuidance(dimensions);
  const navigationActions = buildOperationalProfileNavigationActions(dimensions);
  const futureSurfaces = buildOperationalProfileFutureSurfaces();

  const profile: OperationalProfileModel = {
    kind: "entityOperationalProfile",
    entityLogicalName,
    entityDisplayName,
    headlineBand,
    headlineLabel: headlineBand === "none" ? "No strong profile signals" : `${bandLabel(headlineBand)} complexity`,
    summary: buildSummary(headlineBand),
    dimensions,
    evidence,
    guidance,
    navigationActions,
    futureSurfaces,
    operationalContext: input.operationalContext,
    investigationGuidance: guidance.map((item) => item.message),
    invariants: {
      entityScoped: true,
      explicitlyUserTriggered: true,
      advisoryOnly: true,
      evidenceBacked: true
    }
  };

  const dvqrScore = input.dvqrScore ?? buildDvqrScore(profile);

  return {
    ...profile,
    summary: buildScoreAwareSummary(dvqrScore.displayScore),
    dvqrScore
  };
}
