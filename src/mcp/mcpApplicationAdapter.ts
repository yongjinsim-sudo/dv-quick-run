import {
  investigationReadinessSemanticOperations,
  type InvestigationReadinessRequestV1,
  type InvestigationReadinessResponseV1,
  type ReadonlyJsonObject
} from "../core/readiness/index.js";
import { InvestigationApplicationService, InvestigationEvidenceIntelligenceService, InvestigationEvidenceAcquisitionService, InvestigationEvidenceProviderRegistry, InvestigationStrategyReconciler, MetadataInvestigationEvidenceProvider, RelationshipContextInvestigationEvidenceProvider, RuntimeRelationshipInvestigationEvidenceProvider, BusinessPathRuntimeInvestigationEvidenceProvider, MechanismContextInvestigationEvidenceProvider, TimelineContextInvestigationEvidenceProvider, PluginExecutionUnderstandingInvestigationEvidenceProvider, WorkspaceInvestigationEvidenceRepository, WorkspaceInvestigationJournalRepository, WorkspaceInvestigationRepository, InvestigationMiniRcaService, WorkspaceInvestigationMiniRcaRepository, InvestigationIntentService, InvestigationFocusSuggestionService, InvestigationBootstrapService, type StartInvestigationInput, type Investigation } from "../pro/investigations/index.js";
import {
  DVQR_MCP_CONTRACT_VERSION,
  type DvqrMcpErrorV1,
  type DvqrMcpToolResultV1
} from "./mcpContracts.js";
import { DVQR_MCP_TOOL_NAMES, type DvqrMcpToolName } from "./mcpToolCatalogue.js";

export interface DvqrMcpReadinessOperations {
  assessInvestigationReadiness(request: InvestigationReadinessRequestV1): InvestigationReadinessResponseV1;
  retrieveInvestigationGaps(response: InvestigationReadinessResponseV1): unknown;
  retrieveContributorAvailability(response: InvestigationReadinessResponseV1): unknown;
  retrieveEvidenceRecommendations(response: InvestigationReadinessResponseV1): unknown;
}

function error(code: DvqrMcpErrorV1["code"], message: string, limitations: readonly string[] = []): DvqrMcpErrorV1 {
  return {
    contractVersion: DVQR_MCP_CONTRACT_VERSION,
    code,
    message,
    retryable: false,
    limitations: [...limitations]
  };
}

function isObject(value: unknown): value is ReadonlyJsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function managedVerificationState(investigation: Investigation): ReadonlyJsonObject {
  const acquiredProviders = investigation.evidenceRefs.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const value = item as { providerId?: unknown; status?: unknown };
    return value.status === "Acquired" && typeof value.providerId === "string" ? [value.providerId] : [];
  });
  const providerCounts = acquiredProviders.reduce<Record<string, number>>((acc, providerId) => { acc[providerId] = (acc[providerId] ?? 0) + 1; return acc; }, {});
  const readinessCurrent = Boolean(investigation.managedReadiness && !investigation.managedReadiness.isStale);
  const checkpointCurrent = Boolean(
    investigation.managedMiniRcaCheckpoint
    && investigation.managedReadiness
    && readinessCurrent
    && investigation.managedMiniRcaCheckpoint.evidenceSetFingerprint === investigation.managedReadiness.evidenceSetFingerprint
  );
  const completionHistory = investigation.managedCompletionHistory ?? [];
  const currentStrategyStepsSatisfied = Boolean(investigation.strategy?.steps?.length)
    && investigation.strategy!.steps.every((step) => step.status === "Completed" || step.status === "Skipped");

  // Pass 10.9.2.2 — deterministic completion is historical/monotonic.
  //
  // Optional evidence (for example Timeline) may legitimately reopen a synthesis-refresh
  // step so readiness / Mini RCA can be reconciled against the enlarged evidence set.
  // That makes the investigation not *currently* complete, but it must not erase the fact
  // that the required deterministic strategy already reached completion.
  const deterministicStrategyComplete = currentStrategyStepsSatisfied || completionHistory.length > 0;
  const investigationComplete = Boolean(currentStrategyStepsSatisfied && checkpointCurrent);
  const lastCompletion = completionHistory.length ? completionHistory[completionHistory.length - 1] : undefined;

  const consistencyViolations: string[] = [];
  if (investigationComplete && !checkpointCurrent) {
    consistencyViolations.push("CurrentCompletionRequiresCurrentCheckpoint");
  }
  if (investigationComplete && !currentStrategyStepsSatisfied) {
    consistencyViolations.push("CurrentCompletionRequiresSatisfiedCurrentStrategy");
  }
  if (investigationComplete && completionHistory.length === 0) {
    consistencyViolations.push("CurrentCompletionRequiresPersistedCompletionHistory");
  }
  if (checkpointCurrent && !readinessCurrent) {
    consistencyViolations.push("CurrentCheckpointRequiresCurrentReadiness");
  }
  if (!readinessCurrent && investigationComplete) {
    consistencyViolations.push("StaleReadinessCannotBeCurrentlyComplete");
  }
  if (completionHistory.length > 0 && !deterministicStrategyComplete) {
    consistencyViolations.push("HistoricalCompletionRequiresDeterministicCompletion");
  }
  if (lastCompletion && !investigation.miniRcaArtifactRefs.includes(lastCompletion.miniRcaArtifactId)) {
    consistencyViolations.push("LastCompletionCheckpointMustExistInMiniRcaHistory");
  }
  if (
    investigationComplete
    && lastCompletion
    && investigation.managedMiniRcaCheckpoint
    && lastCompletion.miniRcaArtifactId !== investigation.managedMiniRcaCheckpoint.artifactId
  ) {
    consistencyViolations.push("CurrentCompletionMustReferenceLatestCheckpoint");
  }
  if (
    investigationComplete
    && lastCompletion
    && investigation.managedReadiness
    && lastCompletion.evidenceSetFingerprint !== investigation.managedReadiness.evidenceSetFingerprint
  ) {
    consistencyViolations.push("CurrentCompletionFingerprintMustMatchReadiness");
  }

  return {
    contractVersion: "dvqr-managed-investigation-verification-v1",
    evidenceCount: investigation.evidenceRefs.length,
    acquiredProviderCounts: providerCounts,
    deterministicStrategyComplete,
    investigationComplete,
    currentlyComplete: investigationComplete,
    everReachedCompletion: completionHistory.length > 0,
    completionCount: completionHistory.length,
    lastCompletedAt: lastCompletion?.completedAt ?? null,
    lastCompletedCheckpointArtifactId: lastCompletion?.miniRcaArtifactId ?? null,
    lastCompletedEvidenceFingerprint: lastCompletion?.evidenceSetFingerprint ?? null,
    completionState: investigationComplete ? "InvestigationComplete" : "InProgress",
    finalCheckpointCurrent: checkpointCurrent,
    noRequiredActionRemaining: investigationComplete,
    firstMiniRcaGenerated: investigation.miniRcaArtifactRefs.length > 0,
    miniRcaArtifactCount: investigation.miniRcaArtifactRefs.length,
    historicalMiniRcaCheckpointsPreserved: investigation.miniRcaArtifactRefs.length > 1,
    readinessState: investigation.managedReadiness ? (readinessCurrent ? "Current" : "Stale") : "NotAssessed",
    miniRcaCheckpointState: investigation.managedMiniRcaCheckpoint ? (checkpointCurrent ? "Current" : "StaleAgainstEvidence") : "Missing",
    mechanismEvidencePersisted: (providerCounts["mechanism-context"] ?? 0) > 0,
    pluginExecutionEvidencePersisted: (providerCounts["plugin-execution-understanding"] ?? 0) > 0,
    timelineEvidencePersisted: (providerCounts["timeline-context"] ?? 0) > 0,
    currentReadinessFingerprint: investigation.managedReadiness?.evidenceSetFingerprint ?? null,
    currentCheckpointFingerprint: investigation.managedMiniRcaCheckpoint?.evidenceSetFingerprint ?? null,
    currentCheckpointArtifactId: investigation.managedMiniRcaCheckpoint?.artifactId ?? null,
    stateConsistency: {
      contractVersion: "dvqr-managed-investigation-state-consistency-v1",
      isConsistent: consistencyViolations.length === 0,
      violationCount: consistencyViolations.length,
      violations: consistencyViolations
    }
  };
}


function requestFromArguments(argumentsValue: ReadonlyJsonObject | undefined): InvestigationReadinessRequestV1 | DvqrMcpErrorV1 {
  if (!argumentsValue || !isObject(argumentsValue.request)) {
    return error(
      "InvalidArguments",
      "A canonical readiness request is required at arguments.request.",
      ["No investigation assessment was performed."]
    );
  }
  return argumentsValue.request as unknown as InvestigationReadinessRequestV1;
}

export class DvqrMcpApplicationAdapter {
  private readonly investigations: InvestigationApplicationService;
  private readonly evidenceIntelligence: InvestigationEvidenceIntelligenceService;
  private readonly evidenceAcquisition: InvestigationEvidenceAcquisitionService;
  private readonly miniRca: InvestigationMiniRcaService;
  private readonly intent: InvestigationIntentService;
  private readonly focusSuggestions: InvestigationFocusSuggestionService;
  private readonly bootstrap: InvestigationBootstrapService;
  public constructor(
    private readonly operations: DvqrMcpReadinessOperations = investigationReadinessSemanticOperations,
    investigations?: InvestigationApplicationService,
    evidenceRepository?: WorkspaceInvestigationRepository
  ) {
    const workspaceRoot = process.env.DVQR_MCP_WORKSPACE_ROOT?.trim() || process.cwd();
    const environmentUrl = process.env.DVQR_MCP_ENVIRONMENT_URL;
    const sharedInvestigationRepository = evidenceRepository ?? new WorkspaceInvestigationRepository(workspaceRoot, environmentUrl);
    const sharedReconciler = new InvestigationStrategyReconciler();
    this.investigations = investigations ?? new InvestigationApplicationService(sharedInvestigationRepository, environmentUrl, () => new Date(), sharedReconciler);
    this.evidenceIntelligence = new InvestigationEvidenceIntelligenceService(sharedInvestigationRepository, () => new Date(), sharedReconciler);
    const sharedEvidenceRepository = new WorkspaceInvestigationEvidenceRepository(workspaceRoot, environmentUrl);
    this.evidenceAcquisition = new InvestigationEvidenceAcquisitionService(
      sharedInvestigationRepository,
      sharedEvidenceRepository,
      new InvestigationEvidenceProviderRegistry([new MetadataInvestigationEvidenceProvider(), new RelationshipContextInvestigationEvidenceProvider(), new RuntimeRelationshipInvestigationEvidenceProvider(), new BusinessPathRuntimeInvestigationEvidenceProvider(), new MechanismContextInvestigationEvidenceProvider(), new TimelineContextInvestigationEvidenceProvider(), new PluginExecutionUnderstandingInvestigationEvidenceProvider()]),
      new WorkspaceInvestigationJournalRepository(workspaceRoot, environmentUrl),
      () => new Date(),
      sharedReconciler
    );
    this.intent = new InvestigationIntentService(sharedInvestigationRepository);
    this.focusSuggestions = new InvestigationFocusSuggestionService(sharedInvestigationRepository, sharedEvidenceRepository);
    this.bootstrap = new InvestigationBootstrapService(sharedInvestigationRepository, this.focusSuggestions);
    this.miniRca = new InvestigationMiniRcaService(
      sharedInvestigationRepository,
      sharedEvidenceRepository,
      new WorkspaceInvestigationMiniRcaRepository(workspaceRoot, environmentUrl),
      () => new Date(),
      sharedReconciler
    );
  }

  public call(toolName: DvqrMcpToolName, argumentsValue?: ReadonlyJsonObject): DvqrMcpToolResultV1 {
    if (toolName === DVQR_MCP_TOOL_NAMES.assessInvestigationReadiness && typeof argumentsValue?.investigationId === "string") {
      try {
        return { contractVersion: DVQR_MCP_CONTRACT_VERSION, ok: true, toolName, structuredContent: this.evidenceIntelligence.assessManaged(argumentsValue.investigationId) as never };
      } catch (cause) {
        return { contractVersion: DVQR_MCP_CONTRACT_VERSION, ok: false, toolName, error: error("InvalidArguments", cause instanceof Error ? cause.message : "Managed readiness assessment failed.", ["No evidence was acquired or executed."]) };
      }
    }
    if ([DVQR_MCP_TOOL_NAMES.recordInvestigationEvidence, DVQR_MCP_TOOL_NAMES.startInvestigation, DVQR_MCP_TOOL_NAMES.getInvestigation, DVQR_MCP_TOOL_NAMES.listInvestigations, DVQR_MCP_TOOL_NAMES.getInvestigationStrategy, DVQR_MCP_TOOL_NAMES.continueInvestigation, DVQR_MCP_TOOL_NAMES.pauseInvestigation, DVQR_MCP_TOOL_NAMES.resumeInvestigation, DVQR_MCP_TOOL_NAMES.summarizeInvestigation, DVQR_MCP_TOOL_NAMES.listInvestigationEvidence, DVQR_MCP_TOOL_NAMES.explainInvestigationEvidence, DVQR_MCP_TOOL_NAMES.getSupportingEvidence, DVQR_MCP_TOOL_NAMES.getContradictoryEvidence, DVQR_MCP_TOOL_NAMES.getMissingEvidence, DVQR_MCP_TOOL_NAMES.explainContributor, DVQR_MCP_TOOL_NAMES.getInvestigationReadiness, DVQR_MCP_TOOL_NAMES.explainInvestigationReadiness, DVQR_MCP_TOOL_NAMES.getInvestigationEvidenceGaps, DVQR_MCP_TOOL_NAMES.explainConfidence, DVQR_MCP_TOOL_NAMES.generateMiniRca, DVQR_MCP_TOOL_NAMES.getMiniRca, DVQR_MCP_TOOL_NAMES.updateInvestigationIntent, DVQR_MCP_TOOL_NAMES.getInvestigationFocusSuggestions, DVQR_MCP_TOOL_NAMES.bootstrapInvestigation].includes(toolName as never)) {
      return this.callInvestigationTool(toolName, argumentsValue);
    }
    const request = requestFromArguments(argumentsValue);
    if ("retryable" in request) {
      return {
        contractVersion: DVQR_MCP_CONTRACT_VERSION,
        ok: false,
        toolName,
        error: request
      };
    }

    try {
      const response = this.operations.assessInvestigationReadiness(request);
      const structuredContent = this.project(toolName, response);
      return {
        contractVersion: DVQR_MCP_CONTRACT_VERSION,
        ok: true,
        toolName,
        structuredContent: structuredContent as never
      };
    } catch {
      return {
        contractVersion: DVQR_MCP_CONTRACT_VERSION,
        ok: false,
        toolName,
        error: error(
          "InternalError",
          "DVQR could not complete the read-only semantic operation.",
          ["No evidence was acquired or modified."]
        )
      };
    }
  }

  private callInvestigationTool(toolName: DvqrMcpToolName, argumentsValue?: ReadonlyJsonObject): DvqrMcpToolResultV1 {
    try {
      let structuredContent: unknown;
      const investigationId = typeof argumentsValue?.investigationId === "string" ? argumentsValue.investigationId : "";
      const environmentUrl = typeof argumentsValue?.environmentUrl === "string" ? argumentsValue.environmentUrl : undefined;
      if (toolName === DVQR_MCP_TOOL_NAMES.recordInvestigationEvidence) {
        structuredContent = this.evidenceAcquisition.record({
          investigationId,
          providerId: typeof argumentsValue?.providerId === "string" ? argumentsValue.providerId : "",
          rawResult: argumentsValue?.rawResult
        });
      } else if (toolName === DVQR_MCP_TOOL_NAMES.startInvestigation) {
        structuredContent = this.investigations.start((argumentsValue ?? {}) as unknown as StartInvestigationInput);
      } else if (toolName === DVQR_MCP_TOOL_NAMES.getInvestigation) {
        if (!investigationId) throw new Error("investigationId is required.");
        const investigation = this.investigations.get(investigationId, environmentUrl);
        if (!investigation) throw new Error("Investigation was not found.");
        structuredContent = { ...investigation, managedVerification: managedVerificationState(investigation) };
      } else if (toolName === DVQR_MCP_TOOL_NAMES.listInvestigations) {
        structuredContent = this.investigations.list(
          typeof argumentsValue?.environmentId === "string" ? argumentsValue.environmentId : undefined,
          typeof argumentsValue?.status === "string" ? argumentsValue.status : undefined
        );
      } else if (toolName === DVQR_MCP_TOOL_NAMES.getInvestigationStrategy) {
        if (!investigationId) throw new Error("investigationId is required.");
        const investigation = this.investigations.get(investigationId, environmentUrl);
        if (!investigation) throw new Error("Investigation was not found.");
        structuredContent = {
          investigationId,
          status: investigation.status,
          staleState: investigation.staleState,
          strategy: investigation.strategy,
          currentIntent: investigation.currentIntent,
          managedReadiness: investigation.managedReadiness,
          managedMiniRcaCheckpoint: investigation.managedMiniRcaCheckpoint,
          managedCompletionHistory: investigation.managedCompletionHistory ?? [],
          miniRcaArtifactRefs: investigation.miniRcaArtifactRefs,
          managedVerification: managedVerificationState(investigation),
          truthSource: "PersistedInvestigationJournal",
          readOnly: true
        };
      } else if (toolName === DVQR_MCP_TOOL_NAMES.continueInvestigation) {
        const first = this.investigations.continue(investigationId, environmentUrl);
        const investigation = first.investigation;
        const action = first.recommendedAction;
        const hasPriorCompletion = Boolean(investigation.managedCompletionHistory?.length);
        const hasTimeline = investigation.evidenceRefs.some((item) => {
          if (typeof item !== "object" || item === null) return false;
          const value = item as { providerId?: unknown; status?: unknown };
          return value.providerId === "timeline-context" && value.status === "Acquired";
        });
        const exactReadinessRefresh = action?.kind === "ToolCall"
          && action.tool === "dvqr_assess_investigation_readiness"
          && action.arguments?.investigationId === investigationId;
        const staleCurrentSynthesis = Boolean(investigation.managedReadiness?.isStale);
        if (hasPriorCompletion && hasTimeline && staleCurrentSynthesis && exactReadinessRefresh) {
          this.evidenceIntelligence.assessManaged(investigationId);
          const afterReadiness = this.investigations.continue(investigationId, environmentUrl);
          structuredContent = {
            ...afterReadiness,
            reconvergence: {
              kind: "PostCompletionTimelineReadinessFallback",
              readinessReassessedInternally: true,
              dataverseEvidenceAcquired: false,
              preservedCompletionCount: investigation.managedCompletionHistory?.length ?? 0
            }
          };
        } else {
          structuredContent = first;
        }
      } else if (toolName === DVQR_MCP_TOOL_NAMES.pauseInvestigation) {
        structuredContent = this.investigations.pause(investigationId);
      } else if (toolName === DVQR_MCP_TOOL_NAMES.resumeInvestigation) {
        structuredContent = this.investigations.resume(investigationId, environmentUrl);
      } else if (toolName === DVQR_MCP_TOOL_NAMES.summarizeInvestigation) structuredContent = this.evidenceIntelligence.summarize(investigationId);
      else if (toolName === DVQR_MCP_TOOL_NAMES.listInvestigationEvidence) structuredContent = this.evidenceIntelligence.listEvidence(investigationId);
      else if (toolName === DVQR_MCP_TOOL_NAMES.explainInvestigationEvidence) structuredContent = this.evidenceIntelligence.explainEvidence(investigationId, String(argumentsValue?.evidenceId ?? ""));
      else if (toolName === DVQR_MCP_TOOL_NAMES.getSupportingEvidence) structuredContent = this.evidenceIntelligence.supportingEvidence(investigationId);
      else if (toolName === DVQR_MCP_TOOL_NAMES.getContradictoryEvidence) structuredContent = this.evidenceIntelligence.contradictoryEvidence(investigationId);
      else if (toolName === DVQR_MCP_TOOL_NAMES.getMissingEvidence) structuredContent = this.evidenceIntelligence.missingEvidence(investigationId);
      else if (toolName === DVQR_MCP_TOOL_NAMES.explainContributor) structuredContent = this.evidenceIntelligence.explainContributor(investigationId, String(argumentsValue?.contributorId ?? ""));
      else if (toolName === DVQR_MCP_TOOL_NAMES.getInvestigationReadiness) structuredContent = this.evidenceIntelligence.getReadiness(investigationId);
      else if (toolName === DVQR_MCP_TOOL_NAMES.explainInvestigationReadiness) structuredContent = this.evidenceIntelligence.explainReadiness(investigationId);
      else if (toolName === DVQR_MCP_TOOL_NAMES.getInvestigationEvidenceGaps) structuredContent = this.evidenceIntelligence.gaps(investigationId);
      else if (toolName === DVQR_MCP_TOOL_NAMES.bootstrapInvestigation) structuredContent = this.bootstrap.bootstrap(investigationId);
      else if (toolName === DVQR_MCP_TOOL_NAMES.getInvestigationFocusSuggestions) structuredContent = this.focusSuggestions.suggest(investigationId);
      else if (toolName === DVQR_MCP_TOOL_NAMES.updateInvestigationIntent) structuredContent = this.intent.update({ investigationId, leadingDirection: String(argumentsValue?.leadingDirection ?? ""), reportedProblem: String(argumentsValue?.reportedProblem ?? ""), ...(typeof argumentsValue?.directionLabel === "string" ? { directionLabel: argumentsValue.directionLabel } : {}), ...(typeof argumentsValue?.directionLogicalName === "string" ? { directionLogicalName: argumentsValue.directionLogicalName } : {}), ...(typeof argumentsValue?.directionSource === "string" ? { directionSource: argumentsValue.directionSource as never } : {}), ...(typeof argumentsValue?.reason === "string" ? { reason: argumentsValue.reason } : {}) });
      else if (toolName === DVQR_MCP_TOOL_NAMES.generateMiniRca) structuredContent = this.miniRca.generate(investigationId);
      else if (toolName === DVQR_MCP_TOOL_NAMES.getMiniRca) structuredContent = this.miniRca.get(investigationId, typeof argumentsValue?.artifactId === "string" ? argumentsValue.artifactId : undefined);
      else structuredContent = this.evidenceIntelligence.explainConfidence(investigationId);
      return { contractVersion: DVQR_MCP_CONTRACT_VERSION, ok: true, toolName, structuredContent: structuredContent as never };
    } catch (cause) {
      return { contractVersion: DVQR_MCP_CONTRACT_VERSION, ok: false, toolName, error: error(
        "InvalidArguments", cause instanceof Error ? cause.message : "Investigation operation failed.",
        ["No evidence was acquired or executed."]
      ) };
    }
  }

  private project(toolName: DvqrMcpToolName, response: InvestigationReadinessResponseV1): unknown {
    switch (toolName) {
      case DVQR_MCP_TOOL_NAMES.assessInvestigationReadiness:
        return response;
      case DVQR_MCP_TOOL_NAMES.retrieveInvestigationGaps:
        return this.operations.retrieveInvestigationGaps(response);
      case DVQR_MCP_TOOL_NAMES.retrieveContributorAvailability:
        return this.operations.retrieveContributorAvailability(response);
      case DVQR_MCP_TOOL_NAMES.retrieveEvidenceRecommendations:
        return this.operations.retrieveEvidenceRecommendations(response);
    }
  }
}
