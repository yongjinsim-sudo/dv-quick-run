import type {
  OperationalProfileBand,
  OperationalProfileDimension,
  OperationalProfileGuidanceCategory,
  OperationalProfileGuidanceItem,
  OperationalProfileGuidancePriority
} from "./operationalProfileTypes.js";

const ACTIVE_BANDS = new Set<OperationalProfileBand>(["moderate", "high", "veryHigh"]);
const HIGH_ATTENTION_BANDS = new Set<OperationalProfileBand>(["high", "veryHigh"]);

function findDimension(dimensions: readonly OperationalProfileDimension[], id: string): OperationalProfileDimension | undefined {
  return dimensions.find((dimension) => dimension.id === id);
}

function priorityFromBand(band: OperationalProfileBand): OperationalProfileGuidancePriority {
  if (HIGH_ATTENTION_BANDS.has(band)) {
    return "high";
  }
  if (band === "moderate" || band === "partial") {
    return "moderate";
  }
  return "informational";
}

function hasMeaningfulEvidence(dimension: OperationalProfileDimension | undefined): dimension is OperationalProfileDimension {
  return Boolean(dimension && dimension.evidence.length > 0 && dimension.band !== "none");
}

function createGuidance(args: {
  category: OperationalProfileGuidanceCategory;
  priority: OperationalProfileGuidancePriority;
  title: string;
  message: string;
  evidenceDimensionIds: string[];
}): OperationalProfileGuidanceItem {
  return {
    category: args.category,
    priority: args.priority,
    title: args.title,
    message: args.message,
    evidenceDimensionIds: args.evidenceDimensionIds
  };
}

/**
 * Converts already-bounded Operational Profile evidence into calm, evidence-backed
 * investigation guidance.
 *
 * This layer intentionally interprets evidence only as investigation context. It
 * must not create root-cause claims, hidden ranking, blame wording, or operational
 * certainty. Renderers should display these model-provided messages without
 * recomputing meaning.
 */
export function buildOperationalProfileGuidance(
  dimensions: readonly OperationalProfileDimension[]
): OperationalProfileGuidanceItem[] {
  const guidance: OperationalProfileGuidanceItem[] = [];
  const automation = findDimension(dimensions, "automation");
  const relationships = findDimension(dimensions, "relationships");
  const columns = findDimension(dimensions, "columns");
  const asyncLoad = findDimension(dimensions, "asyncLoad");
  const businessRules = findDimension(dimensions, "businessRules");
  const realTimeWorkflows = findDimension(dimensions, "realTimeWorkflows");
  const auditing = findDimension(dimensions, "auditing");
  const managed = findDimension(dimensions, "managed");

  if (hasMeaningfulEvidence(automation) && ACTIVE_BANDS.has(automation.band)) {
    guidance.push(createGuidance({
      category: "pluginRegistrationDensity",
      priority: priorityFromBand(automation.band),
      title: `${automation.evidenceStateLabel} plugin registration participation`,
      message: "Synchronous plugin registrations can add execution touchpoints. Investigation may be useful when timing, write behaviour, or repeated execution is being reviewed.",
      evidenceDimensionIds: [automation.id]
    }));
  }

  if (hasMeaningfulEvidence(asyncLoad) && ACTIVE_BANDS.has(asyncLoad.band)) {
    guidance.push(createGuidance({
      category: "asyncOperationActivity",
      priority: priorityFromBand(asyncLoad.band),
      title: `${asyncLoad.evidenceStateLabel} asyncoperation activity`,
      message: "Observed asyncoperation activity can increase background execution visibility. Investigation may help clarify delayed processing or repeated activity when that behaviour is unexpected.",
      evidenceDimensionIds: [asyncLoad.id]
    }));
  }

  if (hasMeaningfulEvidence(realTimeWorkflows)) {
    guidance.push(createGuidance({
      category: "realtimeWorkflowParticipation",
      priority: priorityFromBand(realTimeWorkflows.band),
      title: `${realTimeWorkflows.evidenceStateLabel} real-time workflow participation`,
      message: "Real-time workflow participation indicates synchronous workflow layers are present. Review this alongside plugin evidence when record-operation behaviour needs clarification.",
      evidenceDimensionIds: [realTimeWorkflows.id]
    }));
  }

  if (hasMeaningfulEvidence(businessRules)) {
    guidance.push(createGuidance({
      category: "businessRuleParticipation",
      priority: priorityFromBand(businessRules.band),
      title: `${businessRules.evidenceStateLabel} business rule participation`,
      message: "Business Rule participation can add form or table-level logic context. Investigation may be useful when field behaviour, validation, or user-facing rule logic is being reviewed.",
      evidenceDimensionIds: [businessRules.id]
    }));
  }

  if (hasMeaningfulEvidence(auditing)) {
    guidance.push(createGuidance({
      category: "auditParticipation",
      priority: "informational",
      title: "Auditing context observed",
      message: "Auditing is operational context for change history and traceability. Treat it as investigation context, not as performance or quality judgement.",
      evidenceDimensionIds: [auditing.id]
    }));
  }

  if (hasMeaningfulEvidence(relationships) && ACTIVE_BANDS.has(relationships.band)) {
    guidance.push(createGuidance({
      category: "relationshipDensity",
      priority: priorityFromBand(relationships.band),
      title: `${relationships.evidenceStateLabel} relationship footprint`,
      message: "Relationship fanout can widen the investigation surface. Use relationship evidence to focus traversal and related-record checks before following broad paths.",
      evidenceDimensionIds: [relationships.id]
    }));
  }

  if (hasMeaningfulEvidence(columns) && ACTIVE_BANDS.has(columns.band)) {
    guidance.push(createGuidance({
      category: "metadataFootprint",
      priority: priorityFromBand(columns.band),
      title: `${columns.evidenceStateLabel} metadata footprint`,
      message: "A wider column surface can make inspection noisier. Focused selects and evidence-led filtering may help keep investigation output readable.",
      evidenceDimensionIds: [columns.id]
    }));
  }

  if (hasMeaningfulEvidence(managed)) {
    guidance.push(createGuidance({
      category: "managedStateNuance",
      priority: "informational",
      title: `${managed.evidenceStateLabel} solution context`,
      message: "Managed-state evidence is governance and deployment context. Treat it as a change-safety signal, not as operational density or implementation quality judgement.",
      evidenceDimensionIds: [managed.id]
    }));
  }

  if (!guidance.length) {
    guidance.push(createGuidance({
      category: "generalInvestigation",
      priority: "informational",
      title: "No strong guidance signal observed",
      message: "Use the available evidence sections to decide whether deeper execution or metadata investigation is warranted.",
      evidenceDimensionIds: []
    }));
  }

  guidance.push(createGuidance({
    category: "generalInvestigation",
    priority: "informational",
    title: "Advisory context only",
    message: "Treat this profile as entity-scoped investigation context, not root-cause certainty or environment-wide assessment.",
    evidenceDimensionIds: []
  }));

  return guidance;
}
