import type { DvqrMcpToolDefinitionV1 } from "./mcpContracts.js";

export const DVQR_MCP_TOOL_NAMES = {
  assessInvestigationReadiness: "dvqr.assessInvestigationReadiness",
  retrieveInvestigationGaps: "dvqr.retrieveInvestigationGaps",
  retrieveContributorAvailability: "dvqr.retrieveContributorAvailability",
  retrieveEvidenceRecommendations: "dvqr.retrieveEvidenceRecommendations",
  startInvestigation: "dvqr.startInvestigation",
  getInvestigation: "dvqr.getInvestigation",
  listInvestigations: "dvqr.listInvestigations",
  getInvestigationStrategy: "dvqr.getInvestigationStrategy",
  continueInvestigation: "dvqr.continueInvestigation",
  pauseInvestigation: "dvqr.pauseInvestigation",
  resumeInvestigation: "dvqr.resumeInvestigation",
  summarizeInvestigation: "dvqr.summarizeInvestigation",
  listInvestigationEvidence: "dvqr.listInvestigationEvidence",
  explainInvestigationEvidence: "dvqr.explainInvestigationEvidence",
  getSupportingEvidence: "dvqr.getSupportingEvidence",
  getContradictoryEvidence: "dvqr.getContradictoryEvidence",
  getMissingEvidence: "dvqr.getMissingEvidence",
  explainContributor: "dvqr.explainContributor",
  getInvestigationReadiness: "dvqr.getInvestigationReadiness",
  explainInvestigationReadiness: "dvqr.explainInvestigationReadiness",
  getInvestigationEvidenceGaps: "dvqr.getInvestigationEvidenceGaps",
  explainConfidence: "dvqr.explainConfidence",
  recordInvestigationEvidence: "dvqr.recordInvestigationEvidence",
  generateMiniRca: "dvqr.generateMiniRca",
  getMiniRca: "dvqr.getMiniRca",
  updateInvestigationIntent: "dvqr.updateInvestigationIntent",
  getInvestigationFocusSuggestions: "dvqr.getInvestigationFocusSuggestions",
  bootstrapInvestigation: "dvqr.bootstrapInvestigation",
} as const;

export type DvqrMcpToolName = typeof DVQR_MCP_TOOL_NAMES[keyof typeof DVQR_MCP_TOOL_NAMES];

const readinessRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["request"],
  properties: {
    request: {
      type: "object",
      description: "Canonical investigation-readiness-request-v1 payload."
    }
  }
} as const;


const startInvestigationSchema = {
  type: "object", additionalProperties: false, required: ["question"],
  properties: {
    question: { type: "string" }, title: { type: "string" },
    type: { type: "string", enum: ["General","Record","Table","Relationship","Workflow","CustomApi","Timeline","Audit","CrossEnvironment"] },
    subject: { type: "object", additionalProperties: false, properties: { kind: { type: "string" }, logicalName: { type: "string" }, table: { type: "string" }, recordId: { type: "string" }, recordIdMasked: { type: "string" }, displayLabel: { type: "string" } } }, environmentUrl: { type: "string" }
  }
} as const;
const getInvestigationSchema = { type: "object", additionalProperties: false, required: ["investigationId"], properties: { investigationId: { type: "string" } } } as const;
const listInvestigationsSchema = { type: "object", additionalProperties: false, properties: { environmentId: { type: "string" }, status: { type: "string" } } } as const;
const investigationIdSchema = { type: "object", additionalProperties: false, required: ["investigationId"], properties: { investigationId: { type: "string" }, environmentUrl: { type: "string" } } } as const;

export const DVQR_MCP_TOOL_CATALOGUE: readonly DvqrMcpToolDefinitionV1[] = [
  { name: DVQR_MCP_TOOL_NAMES.bootstrapInvestigation, title: "Bootstrap Investigation", description: "Prerequisite: dvqr_start_investigation. Bootstrap a newly started investigation before any evidence acquisition. Returns subject-aware focus prompts, current provider-driven suggestions, a persisted investigation plan, and the exact requirement to persist focus and reported problem with dvqr_update_investigation_intent. Normally Start Investigation performs this automatically. This tool performs no Dataverse runtime execution.", readOnly: true, inputSchema: getInvestigationSchema, outputContract: "dvqr-investigation-bootstrap-v1" },
  { name: DVQR_MCP_TOOL_NAMES.getInvestigationFocusSuggestions, title: "Suggest Investigation Focus", description: "Return environment-specific investigation focus options derived from persisted relationship-context and runtime evidence. Runtime-observed surfaces rank above metadata-derived surfaces. Always includes a custom option. This tool does not change intent or evidence.", readOnly: true, inputSchema: getInvestigationSchema, outputContract: "InvestigationFocusSuggestionV1[]" },
  { name: DVQR_MCP_TOOL_NAMES.updateInvestigationIntent, title: "Update Investigation Intent", description: "Version and persist the investigator's selected investigation focus and reported problem. After interactive answers are collected, call this tool immediately; a conversational acknowledgement is not persistence. Stop if persistence fails. The focus is environment-derived or user-entered and intent never changes evidence.", readOnly: true, inputSchema: { type: "object", additionalProperties: false, required: ["investigationId","leadingDirection","reportedProblem"], properties: { investigationId: { type: "string" }, leadingDirection: { type: "string", description: "Selected focus ID or user-entered focus." }, directionLabel: { type: "string" }, directionLogicalName: { type: "string" }, directionSource: { type: "string", enum: ["RelationshipContext","RuntimeObserved","BusinessPathLibrary","UserCustom"] }, reportedProblem: { type: "string" }, reason: { type: "string" } } }, outputContract: "dvqr-investigation-v1" },
  { name: DVQR_MCP_TOOL_NAMES.generateMiniRca, title: "Generate Evidence-Backed Mini RCA", description: "Generate and persist one bounded evidence-backed hypothesis Mini RCA. Requires a current persisted readiness assessment. If readiness is missing or stale, call dvqr_assess_investigation_readiness with only investigationId before retrying. After mechanism-context changes the evidence set, explicit regeneration consumes the reassessed persisted evidence and creates a new frozen artifact without recollecting evidence. Never infer readiness or substitute contributor helpers. No evidence acquisition or Dataverse execution occurs.", readOnly: true, inputSchema: getInvestigationSchema, outputContract: "dvqr-managed-investigation-mini-rca-v1" },
  { name: DVQR_MCP_TOOL_NAMES.getMiniRca, title: "Get Investigation Mini RCA", description: "Return the latest or requested persisted managed Mini RCA artifact for one investigation.", readOnly: true, inputSchema: { type: "object", additionalProperties: false, required: ["investigationId"], properties: { investigationId: { type: "string" }, artifactId: { type: "string" } } }, outputContract: "dvqr-managed-investigation-mini-rca-v1" },
  { name: DVQR_MCP_TOOL_NAMES.recordInvestigationEvidence, title: "Record Investigation Evidence", description: "Internal bounded persistence operation used after exactly one registered provider completes. It does not contact Dataverse.", readOnly: true, inputSchema: { type: "object", additionalProperties: false, required: ["investigationId","providerId","rawResult"], properties: { investigationId: { type: "string" }, providerId: { type: "string" }, rawResult: { type: "object" } } }, outputContract: "dvqr-investigation-evidence-v1" },
  { name: DVQR_MCP_TOOL_NAMES.startInvestigation, title: "Start Investigation", description: "Create and persist exactly one bounded local DVQR investigation. The live MCP start route automatically performs metadata-only preparation and bootstrap, returns an Investigation Brief with explained focus suggestions, and requires persisted intent before investigation evidence acquisition.", readOnly: true, inputSchema: startInvestigationSchema, outputContract: "dvqr-investigation-v1" },
  { name: DVQR_MCP_TOOL_NAMES.getInvestigation, title: "Get Investigation", description: "Load one persisted local investigation by ID. A successful result is authoritative and must not be described as unavailable. The result includes managedVerification, a deterministic persisted-state fact set for QA/final YES-NO summaries; hosts must prefer those facts over conversational reconstruction.", readOnly: true, inputSchema: getInvestigationSchema, outputContract: "dvqr-investigation-v1" },
  { name: DVQR_MCP_TOOL_NAMES.listInvestigations, title: "List Investigations", description: "List the authoritative bounded local investigation index with optional environment and status filters. An empty array means no matching investigations.", readOnly: true, inputSchema: listInvestigationsSchema, outputContract: "InvestigationIndexEntry[]" },
  { name: DVQR_MCP_TOOL_NAMES.getInvestigationStrategy, title: "Get Investigation Strategy", description: "Return the deterministic persisted strategy and current step for one investigation. No evidence is acquired and no execution occurs.", readOnly: true, inputSchema: investigationIdSchema, outputContract: "dvqr-investigation-strategy-v1" },
  { name: DVQR_MCP_TOOL_NAMES.continueInvestigation, title: "Continue Investigation", description: "Return the next deterministic planned investigation action. Follow the returned recommended capability directly when the user asks to continue. Bootstrap and intent must precede evidence acquisition; Dataverse runtime execution still requires explicit user authority.", readOnly: true, inputSchema: investigationIdSchema, outputContract: "ContinueInvestigationResult" },
  { name: DVQR_MCP_TOOL_NAMES.pauseInvestigation, title: "Pause Investigation", description: "Persist the investigation as Paused without acquiring or changing evidence.", readOnly: true, inputSchema: getInvestigationSchema, outputContract: "dvqr-investigation-v1" },
  { name: DVQR_MCP_TOOL_NAMES.resumeInvestigation, title: "Resume Investigation", description: "Revalidate the environment binding and resume a paused investigation. Environment mismatch produces Limited stale state and no execution.", readOnly: true, inputSchema: investigationIdSchema, outputContract: "dvqr-investigation-v1" },
  { name: DVQR_MCP_TOOL_NAMES.summarizeInvestigation, title: "Summarize Investigation", description: "Summarize persisted evidence, readiness, gaps, confidence and limitations without acquiring evidence.", readOnly: true, inputSchema: getInvestigationSchema, outputContract: "InvestigationSummaryV1" },
  { name: DVQR_MCP_TOOL_NAMES.listInvestigationEvidence, title: "List Investigation Evidence", description: "List canonical evidence references already attached to an investigation.", readOnly: true, inputSchema: getInvestigationSchema, outputContract: "EvidenceReferenceV1[]" },
  { name: DVQR_MCP_TOOL_NAMES.explainInvestigationEvidence, title: "Explain Investigation Evidence", description: "Explain one canonical evidence reference and its bounded support and limitations.", readOnly: true, inputSchema: { type:"object",additionalProperties:false,required:["investigationId","evidenceId"],properties:{investigationId:{type:"string"},evidenceId:{type:"string"}} }, outputContract: "InvestigationEvidenceExplanationV1" },
  { name: DVQR_MCP_TOOL_NAMES.getSupportingEvidence, title: "Get Supporting Evidence", description: "Return evidence referenced by available or partial canonical contributors.", readOnly: true, inputSchema: getInvestigationSchema, outputContract: "EvidenceReferenceV1[]" },
  { name: DVQR_MCP_TOOL_NAMES.getContradictoryEvidence, title: "Get Contradictory Evidence", description: "Return canonical conflict gaps without inventing contradiction semantics.", readOnly: true, inputSchema: getInvestigationSchema, outputContract: "InvestigationGapV1[]" },
  { name: DVQR_MCP_TOOL_NAMES.getMissingEvidence, title: "Get Missing Evidence", description: "Return canonical non-conflict gaps and bounded evidence recommendations.", readOnly: true, inputSchema: getInvestigationSchema, outputContract: "MissingEvidenceV1" },
  { name: DVQR_MCP_TOOL_NAMES.explainContributor, title: "Explain Contributor", description: "Return one canonical contributor readiness state and explanation.", readOnly: true, inputSchema: { type:"object",additionalProperties:false,required:["investigationId","contributorId"],properties:{investigationId:{type:"string"},contributorId:{type:"string"}} }, outputContract: "ContributorReadinessV1" },
  { name: DVQR_MCP_TOOL_NAMES.getInvestigationReadiness, title: "Get Investigation Readiness", description: "Return the stored canonical readiness result for one persisted investigation. Accept only the investigationId argument. When none exists, return an authoritative NotAssessed empty state and recommend continuing the investigation. Internal readiness request contracts are not accepted by this retrieval tool.", readOnly: true, inputSchema: getInvestigationSchema, outputContract: "investigation-readiness-v1 | InvestigationReadinessEmptyStateV1" },
  { name: DVQR_MCP_TOOL_NAMES.explainInvestigationReadiness, title: "Explain Investigation Readiness", description: "Explain the stored canonical readiness posture, or return an authoritative NotAssessed explanation without asking for an internal request contract.", readOnly: true, inputSchema: getInvestigationSchema, outputContract: "InvestigationReadinessExplanationV1 | InvestigationReadinessEmptyStateV1" },
  { name: DVQR_MCP_TOOL_NAMES.getInvestigationEvidenceGaps, title: "Get Investigation Evidence Gaps", description: "Return stored canonical investigation gaps without duplicate MCP gap logic.", readOnly: true, inputSchema: getInvestigationSchema, outputContract: "InvestigationGapV1[]" },
  { name: DVQR_MCP_TOOL_NAMES.explainConfidence, title: "Explain Investigation Confidence", description: "Explain the canonical confidence effect and limitations without converting confidence into certainty.", readOnly: true, inputSchema: getInvestigationSchema, outputContract: "InvestigationConfidenceExplanationV1" },
  {
    name: DVQR_MCP_TOOL_NAMES.assessInvestigationReadiness,
    title: "Assess Investigation Readiness",
    description: "Assess and persist readiness for a persisted record or table investigation using only investigationId. Call directly after evidence acquisition and before dvqr_generate_mini_rca. Do not use contributor helpers, get-investigation, or guessed internal request envelopes as substitutes. Low-level canonical readiness requests remain supported for Timeline and Cross-Environment profiles.",
    readOnly: true,
    inputSchema: readinessRequestSchema,
    outputContract: "investigation-readiness-v1 | investigation-readiness-error-v1"
  },
  {
    name: DVQR_MCP_TOOL_NAMES.retrieveInvestigationGaps,
    title: "Retrieve Investigation Gaps",
    description: "Assess the supplied canonical investigation evidence and return the canonical evidence-gap collection without renaming, reranking, or reinterpretation.",
    readOnly: true,
    inputSchema: readinessRequestSchema,
    outputContract: "InvestigationGapV1[] | investigation-readiness-error-v1"
  },
  {
    name: DVQR_MCP_TOOL_NAMES.retrieveContributorAvailability,
    title: "Retrieve Contributor Availability",
    description: "Assess the supplied canonical investigation evidence and return canonical contributor readiness states without semantic transformation.",
    readOnly: true,
    inputSchema: readinessRequestSchema,
    outputContract: "ContributorReadinessV1[] | investigation-readiness-error-v1"
  },
  {
    name: DVQR_MCP_TOOL_NAMES.retrieveEvidenceRecommendations,
    title: "Retrieve Evidence Recommendations",
    description: "Assess the supplied canonical investigation evidence and return bounded evidence-acquisition recommendations. Recommendations remain advisory and human-authorised.",
    readOnly: true,
    inputSchema: readinessRequestSchema,
    outputContract: "EvidenceRecommendationV1[] | investigation-readiness-error-v1"
  }
];
