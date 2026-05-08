import type {
  OperationalProfileBand,
  OperationalProfileDimension,
  OperationalProfileEvidenceItem,
  OperationalProfileInput,
  OperationalProfileModel
} from "./operationalProfileTypes.js";

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

function createDimension(args: {
  id: string;
  label: string;
  band: OperationalProfileBand;
  valueLabel: string;
  explanation: string;
  whyItMatters: string;
  evidence: OperationalProfileEvidenceItem[];
  evidenceStateLabel?: string;
  stateKind?: "density" | "managed";
}): OperationalProfileDimension {
  return {
    ...args,
    evidenceStateLabel: args.evidenceStateLabel ?? evidenceStateLabel(args.evidence, args.band),
    intensityPercent: intensityFromBand(args.band)
  };
}

function highestComplexityBand(dimensions: OperationalProfileDimension[]): OperationalProfileBand {
  const densityDimensions = dimensions.filter((dimension) => dimension.stateKind !== "managed");
  const countByBand = densityDimensions.reduce(
    (accumulator, dimension) => {
      accumulator[dimension.band] += 1;
      return accumulator;
    },
    { none: 0, low: 0, moderate: 0, high: 0, veryHigh: 0, partial: 0 } satisfies Record<OperationalProfileBand, number>
  );

  if (countByBand.veryHigh > 0 || countByBand.high >= 2) {
    return "high";
  }

  if (countByBand.high === 1 || countByBand.moderate >= 2) {
    return "moderate";
  }

  if (countByBand.moderate === 1 || countByBand.low > 0 || countByBand.partial > 0) {
    return "low";
  }

  return "none";
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

function buildGuidance(dimensions: OperationalProfileDimension[]): string[] {
  const guidance: string[] = [];
  const hasHighAutomation = dimensions.some((dimension) => dimension.id === "automation" && (dimension.band === "high" || dimension.band === "veryHigh"));
  const hasHighAsync = dimensions.some((dimension) => dimension.id === "asyncLoad" && (dimension.band === "high" || dimension.band === "veryHigh"));
  const hasHighRelationships = dimensions.some((dimension) => dimension.id === "relationships" && (dimension.band === "high" || dimension.band === "veryHigh"));

  if (hasHighAutomation) {
    guidance.push("Review synchronous plugin registrations first when execution timing or write behaviour is under investigation.");
  }

  if (hasHighAsync) {
    guidance.push("Inspect asyncoperation evidence when repeated background execution or delayed processing is suspected.");
  }

  if (hasHighRelationships) {
    guidance.push("Use relationship evidence to narrow traversal scope before following related records.");
  }

  if (guidance.length === 0) {
    guidance.push("Use the evidence sections to decide whether deeper execution investigation is warranted.");
  }

  guidance.push("Treat this profile as advisory context, not root-cause certainty.");
  return guidance;
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
      band: bandFromCount(automationCountForBand, { low: 1, moderate: 4, high: 8, veryHigh: 15 }),
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

  const evidence = dimensions.flatMap((dimension) => dimension.evidence).concat(createEvidence(flowEvidence), createEvidence(workflowEvidence));
  const headlineBand = highestComplexityBand(dimensions);

  return {
    kind: "entityOperationalProfile",
    entityLogicalName,
    entityDisplayName,
    headlineBand,
    headlineLabel: headlineBand === "none" ? "No strong profile signals" : `${bandLabel(headlineBand)} complexity`,
    summary: buildSummary(headlineBand),
    dimensions,
    evidence,
    investigationGuidance: buildGuidance(dimensions),
    invariants: {
      entityScoped: true,
      explicitlyUserTriggered: true,
      advisoryOnly: true,
      evidenceBacked: true
    }
  };
}
