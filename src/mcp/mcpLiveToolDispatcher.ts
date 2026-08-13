import { DvqrMcpServerFoundation } from "./dvqrMcpServerFoundation.js";
import { DvqrMcpFreeApplicationAdapter } from "./mcpFreeApplicationAdapter.js";
import { createDvqrMcpCapabilityPayload } from "./mcpCapabilityPayload.js";
import { DvqrMcpLiveCapabilityPolicy } from "./mcpLiveCapabilityPolicy.js";
import {
  DVQR_LIVE_MCP_TOOL_BY_NAME,
  type DvqrLiveMcpFreeHandlerId
} from "./mcpLiveToolCatalogue.js";
import type { DvqrMcpPortableTextOptions } from "./mcpPortableText.js";
import type { DvqrMcpRuntimeConfiguration } from "./mcpRuntimeConfiguration.js";
import type { DvqrMcpFreeToolResult } from "./mcpToolResults.js";
import { formatDvqrMcpToolResponse, type DvqrMcpToolResponse } from "./mcpToolResponseFormatter.js";
import { WorkspaceInvestigationEvidenceRepository } from "../pro/investigations/index.js";
import { extractAssertedBusinessTraversal } from "../pro/investigations/investigationBusinessTraversal.js";
import { InvestigationIntentInferenceEngine, type InvestigationIntentInferenceCandidate } from "../pro/investigations/investigationIntentInference.js";
import {
  INVESTIGATION_INTENT_GUARDED_TOOLS,
  classifyInvestigationConfirmationText,
  isGenuineInvestigationIntentEdit,
  type PendingInvestigationIntent
} from "./mcpInvestigationLifecycle.js";

export interface DvqrMcpLiveToolCall {
  readonly name: string;
  readonly arguments?: Record<string, unknown>;
}

type FreeHandler = (args: Record<string, unknown>) => Promise<DvqrMcpToolResponse>;

export interface RuntimeRelationshipAcquisitionArguments {
  readonly investigationId: string;
  readonly providerId: "runtime-relationship";
  readonly sourceRecordId: string;
  readonly targetTable?: string;
  readonly environmentUrl?: string;
}

function isDataverseGuid(value: string): boolean {
  // Dataverse record identifiers are canonical 8-4-4-4-12 hexadecimal GUIDs.
  // Do not enforce RFC version/variant nibbles: real Dataverse IDs can contain any hex value there.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function maskRecordId(value: string): string {
  return value ? `***${value.slice(-8)}` : "not received";
}

type BoundaryResolutionSource = "UserAbsoluteBoundary" | "UserRelativeBoundary";
type BoundaryRequestClassification = BoundaryResolutionSource | "AgentBoundaryDelegation";

function classifyBoundaryRequestText(text: string, fromIso: string, toIso: string): BoundaryRequestClassification | undefined {
  const value = text.trim();
  if (!value) return undefined;

  // Exact user-supplied ISO values are authoritative even if surrounding wording delegates other choices.
  if (value.includes(fromIso) && value.includes(toIso)) return "UserAbsoluteBoundary";

  // A user may specify a relative temporal boundary ("last 30 days"), but may not delegate
  // selection of the boundary itself to the agent. These phrases express who should choose,
  // not what temporal boundary the user requested.
  const delegationPatterns = [
    /\b(?:use|pick|choose|select)\s+whatever\s+(?:time\s+)?(?:window|period|range|dates?)\b/i,
    /\bwhatever\s+(?:time\s+)?(?:window|period|range|dates?)\s+(?:you\s+)?(?:think|consider|deem|find)\b/i,
    /\b(?:pick|choose|select|use)\s+(?:a\s+)?(?:sensible|appropriate|reasonable|best|useful)\s+(?:time\s+)?(?:window|period|range)\b/i,
    /\b(?:you\s+decide|up\s+to\s+you)\b/i,
    /\b(?:choose|pick|select)\s+the\s+(?:time\s+)?(?:window|period|range)\s+(?:yourself|for\s+me)\b/i
  ];
  if (delegationPatterns.some((pattern) => pattern.test(value))) return "AgentBoundaryDelegation";

  const relativePatterns = [
    /\blast\s+\d+\s+(?:minute|minutes|hour|hours|day|days|week|weeks|month|months)\b/i,
    /\bpast\s+\d+\s+(?:minute|minutes|hour|hours|day|days|week|weeks|month|months)\b/i,
    /\b(?:today|yesterday|this week|last week|this month|last month)\b/i,
    /\bsince\s+\S+/i
  ];
  return relativePatterns.some((pattern) => pattern.test(value)) ? "UserRelativeBoundary" : undefined;
}

function extractExplicitLogicalTarget(question: string, subjectLogicalName?: string): string | undefined {
  const subject = (subjectLogicalName ?? "").trim().toLowerCase();
  const identifier = "([a-z][a-z0-9]*_[a-z0-9_]+)";
  const patterns = [
    new RegExp(`\\bdownstream\\s+${identifier}\\b`, "i"),
    new RegExp(`\\b(?:relates?|related|linked|connect(?:ed|s)?)\\s+to\\s+(?:downstream\\s+)?${identifier}\\b`, "i"),
    new RegExp(`\\btarget(?:ing|ed)?\\s+(?:table\\s+)?${identifier}\\b`, "i"),
    new RegExp(`\\binto\\s+${identifier}\\b`, "i"),
    new RegExp(`(?:->|→)\\s*${identifier}\\b`, "i")
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(question);
    const candidate = match?.[1]?.trim();
    if (candidate && candidate.toLowerCase() !== subject) return candidate;
  }
  return undefined;
}

export class DvqrMcpLiveToolDispatcher {
  private readonly portableTextOptions: DvqrMcpPortableTextOptions;
  private readonly freeHandlers: Readonly<Record<DvqrLiveMcpFreeHandlerId, FreeHandler>>;
  private readonly capabilityPolicy: DvqrMcpLiveCapabilityPolicy;
  private readonly intentInference = new InvestigationIntentInferenceEngine();
  private readonly pendingInferredIntents = new Map<string, PendingInvestigationIntent>();
  // Pass 10.9.5 — server-side host orchestration guard.
  // Raw record IDs are held only transiently in-memory for duplicate-start suppression.
  private readonly pendingRecordStartResponses = new Map<string, DvqrMcpToolResponse>();
  private readonly pendingRecordStartKeyByInvestigationId = new Map<string, string>();

  public constructor(
    private readonly config: DvqrMcpRuntimeConfiguration,
    private readonly freeAdapter = new DvqrMcpFreeApplicationAdapter(config),
    private readonly foundation = new DvqrMcpServerFoundation()
  ) {
    this.capabilityPolicy = new DvqrMcpLiveCapabilityPolicy(config.proEnabled);
    this.portableTextOptions = {
      enabled: config.emitTextMirror,
      maxCharacters: config.textMirrorMaxCharacters
    };
    this.freeHandlers = this.createFreeHandlers();
  }

  public async dispatch(call: DvqrMcpLiveToolCall): Promise<DvqrMcpToolResponse> {
    const tool = DVQR_LIVE_MCP_TOOL_BY_NAME.get(call.name);
    if (!tool) {
      return this.format(`Unknown DVQR MCP tool: ${call.name}`, {
        code: "ToolNotFound",
        toolName: call.name
      }, true);
    }

    const args = call.arguments ?? {};
    const decision = this.capabilityPolicy.decide(tool);
    if (!decision.allowed) {
      return this.format(
        "This investigation acceleration tool requires DVQR Pro. Free MCP can execute and explain supported queries; Pro derives readiness, gaps and evidence recommendations.",
        this.capabilityPolicy.capabilityRequiredPayload(tool),
        true
      );
    }
    if (tool.handler.kind === "pro") {
      const investigationId = typeof args.investigationId === "string" ? args.investigationId.trim() : "";
      if ((tool.name === "dvqr_continue_investigation" || tool.name === "dvqr_bootstrap_investigation")
        && investigationId
        && this.pendingInferredIntents.has(investigationId)
        && typeof args.confirmationText === "string"
        && args.confirmationText.trim()) {
        return this.dispatchConfirmInferredIntent({
          investigationId,
          confirmationText: args.confirmationText
        });
      }
      if (investigationId && this.pendingInferredIntents.has(investigationId) && INVESTIGATION_INTENT_GUARDED_TOOLS.has(tool.name)) {
        return this.format(
          "This investigation is waiting for explicit intent confirmation or a genuine user edit. No continuation, evidence, readiness, recommendation, or Mini RCA action was performed.",
          {
            code: "InvestigationPendingIntentConfirmation",
            investigationId,
            allowedActions: ["dvqr_confirm_investigation_intent", "dvqr_continue_investigation", "dvqr_bootstrap_investigation", "dvqr_update_investigation_intent"],
            confirmationTool: "dvqr_confirm_investigation_intent",
            confirmationArguments: { investigationId, confirmationText: "<exact subsequent user confirmation message>" },
            confirmationFallbackTool: "dvqr_continue_investigation",
            confirmationFallbackArguments: { investigationId, confirmationText: "<exact subsequent user confirmation message>" },
            guaranteedVisibleConfirmationFallbackTool: "dvqr_bootstrap_investigation",
            guaranteedVisibleConfirmationFallbackArguments: { investigationId, confirmationText: "<exact subsequent user confirmation message>" },
            confirmationTrustBoundary: "HostSuppliedUnauthenticated",
            evidenceBoundary: "No Dataverse request, evidence acquisition, readiness assessment, strategy continuation, or Mini RCA generation occurred."
          },
          true
        );
      }
      if (investigationId && INVESTIGATION_INTENT_GUARDED_TOOLS.has(tool.name) && this.persistedIntentGuard(investigationId)) {
        return this.format(
          "Persisted investigation state shows that intent has not yet been confirmed or genuinely edited. No continuation, evidence, readiness, recommendation, or Mini RCA action was performed.",
          {
            code: "InvestigationPersistedIntentRequired",
            investigationId,
            hostProtocolGuard: {
              contractVersion: "dvqr-investigation-host-protocol-guard-v1",
              source: "PersistedInvestigationJournal",
              blockedAction: tool.name,
              preIntentGuard: "PersistedStateEnforced",
              confirmationProvenance: "HostSuppliedUnauthenticated"
            },
            allowedActions: ["dvqr_confirm_investigation_intent", "dvqr_continue_investigation", "dvqr_bootstrap_investigation", "dvqr_update_investigation_intent"],
            evidenceBoundary: "No Dataverse request, evidence acquisition, readiness assessment, continuation, recommendation execution, or Mini RCA generation occurred."
          },
          true
        );
      }
      if (tool.name === "dvqr_start_investigation") return this.dispatchStartWithPreparation(tool.handler.internalName, args);
      if (tool.name === "dvqr_confirm_investigation_intent") return this.dispatchConfirmInferredIntent(args);
      if (tool.name === "dvqr_update_investigation_intent") return this.dispatchManualIntentUpdate(tool.handler.internalName, args);
      if (tool.name === "dvqr_acquire_investigation_evidence") {
        const blocked = this.validateRecommendedExecution(tool.name, args);
        if (blocked) return blocked;
        return this.dispatchEvidenceAcquisition(this.stripRecommendedActionToken(args));
      }
      if (tool.name === "dvqr_acquire_mechanism_context") return this.dispatchEvidenceAcquisition({ ...args, providerId: "mechanism-context" });
      if (tool.name === "dvqr_acquire_timeline_context") return this.dispatchEvidenceAcquisition({ ...args, providerId: "timeline-context" });
      if (tool.name === "dvqr_assess_investigation_readiness") {
        const blocked = this.validateRecommendedExecution(tool.name, args);
        if (blocked) return blocked;
        return this.dispatchManagedReadiness(tool.handler.internalName, this.stripRecommendedActionToken(args));
      }
      if (tool.name === "dvqr_generate_mini_rca_checkpoint") {
        const blocked = this.validateRecommendedExecution(tool.name, args);
        if (blocked) return blocked;
        return this.dispatchProTool(tool.name, tool.handler.internalName, this.stripRecommendedActionToken(args));
      }
      if (tool.name === "dvqr_continue_investigation" && args.executeRecommendedMiniRca === true) return this.dispatchRecommendedMiniRcaFallback(tool.handler.internalName, args);
      return this.dispatchProTool(tool.name, tool.handler.internalName, args);
    }
    return this.freeHandlers[tool.handler.id](args);
  }

  private createFreeHandlers(): Readonly<Record<DvqrLiveMcpFreeHandlerId, FreeHandler>> {
    return {
      listCapabilities: async () => this.format(
        "DVQR local MCP is active. Free execution and understanding tools are available; Pro tools provide investigation acceleration.",
        createDvqrMcpCapabilityPayload(this.config.proEnabled)
      ),
      explainOData: async (args) => this.formatFreeResult(this.freeAdapter.explainOData(args)),
      executeOData: async (args) => this.formatFreeResult(await this.freeAdapter.executeOData(args)),
      searchMetadata: async (args) => this.formatFreeResult(await this.freeAdapter.searchMetadata(args)),
      getEntityMetadata: async (args) => this.formatFreeResult(await this.freeAdapter.getEntityMetadata(args)),
      discoverCustomApis: async (args) => this.formatFreeResult(await this.freeAdapter.discoverCustomApis(args)),
      getCustomApiDefinition: async (args) => this.formatFreeResult(await this.freeAdapter.getCustomApiDefinition(args)),
      explainCustomApi: async (args) => this.formatFreeResult(await this.freeAdapter.explainCustomApi(args)),
      compareCustomApis: async (args) => this.formatFreeResult(await this.freeAdapter.compareCustomApis(args)),
      recommendCustomApis: async (args) => this.formatFreeResult(await this.freeAdapter.recommendCustomApis(args)),
      recommendSolutionArchitecture: async (args) => this.formatFreeResult(await this.freeAdapter.recommendSolutionArchitecture(args)),
      checkCustomApiExecution: async (args) => this.formatFreeResult(await this.freeAdapter.checkCustomApiExecution(args)),
      previewCustomApiExecution: async (args) => this.formatFreeResult(await this.freeAdapter.previewCustomApiExecution(args)),
      executeCustomApi: async (args) => this.formatFreeResult(await this.freeAdapter.executeCustomApi(args)),
      interpretCustomApiExecution: async (args) => this.formatFreeResult(this.freeAdapter.interpretCustomApiExecution(args)),
      discoverOperationalAnchors: async (args) => this.formatFreeResult(await this.freeAdapter.discoverOperationalAnchors(args)),
      resolveNavigationProperty: async (args) => this.formatFreeResult(await this.freeAdapter.resolveNavigationProperty(args)),
      findRelationshipPaths: async (args) => this.formatFreeResult(await this.freeAdapter.findRelationshipPaths(args)),
      discoverBusinessPaths: async (args) => this.formatFreeResult(await this.freeAdapter.discoverBusinessPaths(args)),
      validateBusinessPaths: async (args) => this.formatFreeResult(await this.freeAdapter.validateBusinessPaths(args)),
      generateRelationshipQuery: async (args) => this.dispatchRelationshipQuery(args),
      probeRelationshipPath: async (args) => this.formatFreeResult(await this.freeAdapter.probeRelationshipPath(args)),
      explainLookup: async (args) => this.formatFreeResult(await this.freeAdapter.explainLookup(args))
    };
  }


  private pendingRecordStartKey(args: Record<string, unknown>): string | undefined {
    const subject = args.subject && typeof args.subject === "object"
      ? args.subject as Record<string, unknown>
      : undefined;
    const suppliedRecordId = typeof subject?.recordId === "string" ? subject.recordId.trim().toLowerCase() : "";
    const question = typeof args.question === "string" ? args.question : "";
    const questionRecordId = question.match(/\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i)?.[1]?.toLowerCase() ?? "";
    const recordId = suppliedRecordId || questionRecordId;
    if (!recordId) return undefined;
    const environmentUrl = typeof args.environmentUrl === "string" ? args.environmentUrl.trim().toLowerCase() : "";
    return `${environmentUrl}|${recordId}`;
  }

  private persistedIntentGuard(investigationId: string): boolean {
    const loaded = this.foundation.callTool({ name: "dvqr.getInvestigation", arguments: { investigationId } as never });
    if (!loaded.ok || !loaded.structuredContent || typeof loaded.structuredContent !== "object") return false;
    const investigation = loaded.structuredContent as Record<string, unknown>;
    const bootstrapCompleted = typeof investigation.bootstrapCompletedAt === "string" && investigation.bootstrapCompletedAt.length > 0;
    return bootstrapCompleted && !investigation.currentIntent;
  }

  private async dispatchStartWithPreparation(internalName: string, args: Record<string, unknown>): Promise<DvqrMcpToolResponse> {
    const pendingStartKey = this.pendingRecordStartKey(args);
    if (pendingStartKey) {
      const existing = this.pendingRecordStartResponses.get(pendingStartKey);
      if (existing) return existing;
    }

    const started = this.foundation.callTool({ name: internalName, arguments: args as never });
    if (!started.ok) return this.format(started.error.message, started, true);

    const investigation = started.structuredContent as {
      investigationId?: unknown;
      title?: unknown;
      status?: unknown;
      environmentId?: unknown;
      subject?: { logicalName?: unknown; displayLabel?: unknown };
      subjectBinding?: { state?: unknown; suppliedLogicalName?: unknown; resolvedLogicalName?: unknown; reason?: unknown };
    };
    const investigationId = typeof investigation.investigationId === "string" ? investigation.investigationId : "";
    const logicalName = typeof investigation.subject?.logicalName === "string" ? investigation.subject.logicalName : "";
    const environmentArgs = typeof args.environmentUrl === "string" ? { environmentUrl: args.environmentUrl } : {};

    let preparation: Record<string, unknown> = {
      contractVersion: "dvqr-investigation-preparation-v1",
      status: "Limited",
      sourceTable: logicalName || undefined,
      suggestions: [],
      limitations: ["A subject logical name was not available, so environment-aware preparation could not run."]
    };

    if (logicalName) {
      const discovered = await this.freeAdapter.discoverOperationalAnchors({
        sourceTable: logicalName,
        maxDepth: 3,
        maxResults: 8,
        maxTablesInspected: 60,
        ...environmentArgs
      });
      if (discovered.ok && discovered.structuredContent && typeof discovered.structuredContent === "object") {
        const content = discovered.structuredContent as Record<string, unknown>;
        const rawAnchors = Array.isArray(content.operationalAnchors)
          ? content.operationalAnchors
          : Array.isArray(content.anchors)
            ? content.anchors
            : [];
        const suggestions = rawAnchors.slice(0, 8).map((raw) => {
          const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
          const logical = typeof item.logicalName === "string" ? item.logicalName : "";
          const display = typeof item.displayName === "string" ? item.displayName : logical;
          const reasons = Array.isArray(item.reasons)
            ? item.reasons.map((reason) => reason && typeof reason === "object" ? String((reason as Record<string, unknown>).message ?? "") : String(reason)).filter(Boolean)
            : [];
          return {
            focusId: logical,
            label: display,
            logicalName: logical,
            source: "PreparationMetadata",
            score: typeof item.score === "number" ? item.score : 0,
            reason: reasons[0] || "Bounded metadata preparation identified this as a relevant business surface.",
            expectedInformationGain: typeof item.score === "number" && item.score >= 80 ? "High" : "Medium"
          };
        }).filter((item) => item.logicalName);
        preparation = {
          contractVersion: "dvqr-investigation-preparation-v1",
          status: "Prepared",
          sourceTable: logicalName,
          evidenceBoundary: "Metadata-only preparation. No Dataverse record query, runtime probe, or investigation evidence acquisition was performed.",
          recommendationBasis: content.recommendationBasis ?? "StructuralMetadataFirstWithSupportingSemantics",
          suggestions: [...suggestions, {
            focusId: "custom",
            label: "Something else",
            source: "UserCustom",
            score: 0,
            reason: "Enter a custom business surface or investigation focus.",
            expectedInformationGain: "Medium"
          }],
          rawPreparation: content
        };
      } else {
        preparation = {
          contractVersion: "dvqr-investigation-preparation-v1",
          status: "Limited",
          sourceTable: logicalName,
          suggestions: [{ focusId: "custom", label: "Something else", source: "UserCustom", score: 0, reason: "Enter a custom business surface or investigation focus.", expectedInformationGain: "Medium" }],
          limitations: [discovered.ok ? "Preparation returned no structured metadata result." : discovered.message]
        };
      }
    }

    const bootstrapped = investigationId
      ? this.foundation.callTool({ name: "dvqr.bootstrapInvestigation", arguments: { investigationId } as never })
      : undefined;
    const bootstrap = bootstrapped?.ok ? bootstrapped.structuredContent : undefined;
    const suggestions = Array.isArray(preparation.suggestions) ? preparation.suggestions as Array<Record<string, unknown>> : [];
    const inferenceCandidates: InvestigationIntentInferenceCandidate[] = suggestions
      .filter((item) => String(item.focusId ?? "") !== "custom")
      .map((item) => ({
        focusId: String(item.focusId ?? item.logicalName ?? item.label ?? ""),
        label: String(item.label ?? item.logicalName ?? "Unknown focus"),
        ...(typeof item.logicalName === "string" && item.logicalName ? { logicalName: item.logicalName } : {})
      }))
      .filter((item) => item.focusId && item.label);
    const question = typeof args.question === "string" ? args.question : "";
    const explicitTargetLogicalName = extractExplicitLogicalTarget(question, logicalName || undefined);
    const intentInference = this.intentInference.infer({
      question,
      subjectLabel: typeof investigation.subject?.displayLabel === "string" ? investigation.subject.displayLabel : undefined,
      subjectLogicalName: logicalName || undefined,
      candidates: inferenceCandidates
    });
    const lines = suggestions.slice(0, 5).map((item, index) => {
      const label = String(item.label ?? item.logicalName ?? "Unknown focus");
      const reason = String(item.reason ?? "Metadata-derived business surface.");
      return `${index + 1}. ${label} — ${reason}`;
    });
    const hasProposal = Boolean(intentInference.focus.value && intentInference.problem.value);
    const proposalLines = hasProposal ? [
      "I believe you are investigating:",
      `Focus: ${intentInference.focus.value}`,
      ...(explicitTargetLogicalName ? [`Explicit downstream target: ${explicitTargetLogicalName}`] : []),
      `Problem: ${intentInference.problem.value}`,
      `Goal: ${intentInference.goal.value ?? "Clarify the evidence-backed investigation goal."}`,
      `Confidence: ${intentInference.overallConfidence}`,
      "Next: ask the user to continue with or edit this inferred intent. Do not ask them to re-enter information already inferred."
    ] : [
      "DVQR could not infer a sufficiently complete intent from the opening request.",
      "Ask the user to choose a suggested or custom focus and describe the observed problem."
    ];

    const text = [
      "DVQR created the investigation and completed metadata-only preparation.",
      `Investigation ID: ${investigationId || "unknown"}`,
      `Subject: ${String(investigation.subject?.displayLabel ?? (logicalName || "current subject"))}`,
      ...(investigation.subjectBinding ? [
        `Subject binding: ${String(investigation.subjectBinding.state ?? "Unknown")} (${String(investigation.subjectBinding.resolvedLogicalName ?? (logicalName || "unresolved"))}).`,
        `Binding reason: ${String(investigation.subjectBinding.reason ?? "No binding explanation was persisted.")}`
      ] : []),
      "Preparation boundary: no runtime query or investigation evidence acquisition was performed.",
      ...proposalLines,
      "Suggested alternatives:",
      ...(lines.length ? lines : ["1. Something else — Enter a custom investigation focus."]),
      hasProposal
        ? "After the user's subsequent confirmation, confirm THIS SAME investigation. Prefer dvqr_confirm_investigation_intent with the exact returned confirmationArguments. If that tool is not exposed by the host, call dvqr_continue_investigation with the exact returned confirmationFallbackArguments. NEVER call dvqr_start_investigation again to confirm or continue an existing investigation."
        : "After clarification, immediately persist the selected focus and problem with dvqr_update_investigation_intent.",
      "Do not acquire metadata, relationship-context, or runtime evidence until intent has been persisted."
    ].join("\n");

    if (hasProposal && investigationId) {
      this.pendingInferredIntents.set(investigationId, {
        leadingDirection: explicitTargetLogicalName ?? intentInference.focus.value!,
        directionLabel: explicitTargetLogicalName ?? intentInference.focus.value!,
        ...(explicitTargetLogicalName
          ? { directionLogicalName: explicitTargetLogicalName }
          : intentInference.focus.logicalName
            ? { directionLogicalName: intentInference.focus.logicalName }
            : {}),
        reportedProblem: intentInference.problem.value!,
        reason: explicitTargetLogicalName
          ? `Confirmed inferred intent while preserving the explicit downstream logical target ${explicitTargetLogicalName} from the opening user request.`
          : "Confirmed inferred intent from the opening investigation request."
      });
    } else if (investigationId) {
      this.pendingInferredIntents.delete(investigationId);
    }

    const preparedResponse = this.format(text, {
      contractVersion: "dvqr-investigation-prepared-start-v2",
      investigation: started.structuredContent,
      preparation,
      bootstrap,
      intentInference,
      hostProtocolGuard: {
        contractVersion: "dvqr-investigation-host-protocol-guard-v1",
        duplicateStartSuppression: "SessionScopedPendingRecord",
        preIntentGuard: "PersistedStateEnforced",
        confirmationProvenance: "HostSuppliedUnauthenticated",
        mustStopAfterPreparedStart: hasProposal
      },
      ...(explicitTargetLogicalName ? { explicitTarget: { logicalName: explicitTargetLogicalName, source: "ExplicitUserWording" } } : {}),
      nextRequiredAction: hasProposal ? {
        action: "ConfirmOrEditInferredIntent",
        confirmationRequired: true,
        mustStopAfterResponse: true,
        confirmationRequiredFromSubsequentUserMessage: true,
        confirmLabel: "Continue Investigation",
        editLabel: "Edit Investigation",
        confirmationTool: "dvqr_confirm_investigation_intent",
        confirmationArguments: { investigationId, confirmationText: "<exact subsequent user confirmation message>" },
        confirmationFallbackTool: "dvqr_continue_investigation",
        confirmationFallbackArguments: { investigationId, confirmationText: "<exact subsequent user confirmation message>" },
        guaranteedVisibleConfirmationFallbackTool: "dvqr_bootstrap_investigation",
        guaranteedVisibleConfirmationFallbackArguments: { investigationId, confirmationText: "<exact subsequent user confirmation message>" },
        neverRestartForConfirmation: true,
        confirmationTrustBoundary: "HostSuppliedUnauthenticated",
        editTool: "dvqr_update_investigation_intent"
      } : {
        action: "CaptureAndPersistIntent",
        tool: "dvqr_update_investigation_intent",
        focusQuestion: "Which suggested or custom business surface should this investigation focus on?",
        problemQuestion: "What problem or unexpected behaviour are you seeing?"
      }
    });

    if (hasProposal && investigationId && pendingStartKey) {
      this.pendingRecordStartResponses.set(pendingStartKey, preparedResponse);
      this.pendingRecordStartKeyByInvestigationId.set(investigationId, pendingStartKey);
    }
    return preparedResponse;
  }

  private dispatchConfirmInferredIntent(args: Record<string, unknown>): DvqrMcpToolResponse {
    const investigationId = typeof args.investigationId === "string" ? args.investigationId.trim() : "";
    const confirmationText = typeof args.confirmationText === "string" ? args.confirmationText.trim() : "";
    if (!investigationId || !confirmationText) {
      return this.format(
        "investigationId and the host-supplied confirmation text are required to confirm inferred intent. The MCP host must only call this tool after an explicit user confirmation and must not synthesize or substitute an accepted confirmation phrase on the user's behalf.",
        {
          code: "InvalidArguments",
          required: ["investigationId", "confirmationText"],
          confirmationTrustBoundary: "HostSuppliedUnauthenticated",
          confirmationTextRequirement: "Copy the immediately preceding explicit user confirmation message. DVQR cannot independently authenticate this text against the host transcript."
        },
        true
      );
    }
    const confirmationDisposition = classifyInvestigationConfirmationText(confirmationText);
    if (confirmationDisposition !== "Confirm") {
      return this.format(
        confirmationDisposition === "Edit"
          ? "The latest user message requests an edit, not confirmation. Keep the inferred proposal pending and use dvqr_update_investigation_intent with the user's genuine changes."
          : "The latest user message is not an explicit confirmation of the inferred proposal. The investigation remains pending and no evidence action is permitted.",
        {
          code: "ExplicitIntentConfirmationRequired",
          investigationId,
          confirmationDisposition,
          allowedExamples: ["Continue Investigation", "Confirmed, continue the investigation.", "Yes, continue", "Please continue", "Looks good, proceed", "Confirm", "Proceed"],
          editTool: "dvqr_update_investigation_intent"
        },
        true
      );
    }

    const loaded = this.foundation.callTool({ name: "dvqr.getInvestigation", arguments: { investigationId } as never });
    if (!loaded.ok) return this.format(loaded.error.message, loaded, true);
    const existing = loaded.structuredContent as { currentIntent?: { leadingDirection?: unknown; directionLabel?: unknown; directionLogicalName?: unknown; reportedProblem?: unknown } };
    const current = existing.currentIntent;
    const pending = this.pendingInferredIntents.get(investigationId);

    if (!pending) {
      if (current) {
        return this.format(
          "The investigation intent is already persisted. No duplicate intent version was created. Continue with the current investigation plan.",
          {
            contractVersion: "dvqr-investigation-intent-confirmation-v1",
            investigation: loaded.structuredContent,
            confirmation: { status: "AlreadyConfirmed", idempotent: true },
            nextRequiredAction: { action: "ContinueInvestigation", tool: "dvqr_continue_investigation", arguments: { investigationId } },
            evidenceBoundary: "Confirmation persisted no new intent and acquired no evidence."
          }
        );
      }
      return this.format(
        "No pending inferred intent exists for this investigation. Use dvqr_update_investigation_intent only after the user supplies or edits the focus and problem.",
        { code: "NoPendingInferredIntent", investigationId, nextAction: "dvqr_update_investigation_intent" },
        true
      );
    }

    const alreadyConfirmed = Boolean(current
      && current.leadingDirection === pending.leadingDirection
      && current.directionLabel === pending.directionLabel
      && current.reportedProblem === pending.reportedProblem
      && (current.directionLogicalName ?? undefined) === pending.directionLogicalName);

    let investigation: unknown = loaded.structuredContent;
    if (!alreadyConfirmed) {
      const updated = this.foundation.callTool({
        name: "dvqr.updateInvestigationIntent",
        arguments: {
          investigationId,
          leadingDirection: pending.leadingDirection,
          directionLabel: pending.directionLabel,
          ...(pending.directionLogicalName ? { directionLogicalName: pending.directionLogicalName } : {}),
          directionSource: "UserCustom",
          reportedProblem: pending.reportedProblem,
          reason: pending.reason
        } as never
      });
      if (!updated.ok) return this.format(updated.error.message, updated, true);
      investigation = updated.structuredContent;
    }
    this.pendingInferredIntents.delete(investigationId);
    const pendingStartKey = this.pendingRecordStartKeyByInvestigationId.get(investigationId);
    if (pendingStartKey) this.pendingRecordStartResponses.delete(pendingStartKey);
    this.pendingRecordStartKeyByInvestigationId.delete(investigationId);

    return this.format(
      alreadyConfirmed
        ? "The inferred investigation intent was already confirmed. No duplicate intent version was created. Continue with metadata evidence acquisition."
        : "The inferred investigation intent was confirmed and persisted. Continue directly with metadata evidence acquisition; do not ask for focus or problem again.",
      {
        contractVersion: "dvqr-investigation-intent-confirmation-v1",
        investigation,
        confirmation: { status: alreadyConfirmed ? "AlreadyConfirmed" : "Persisted", idempotent: alreadyConfirmed },
        nextRequiredAction: {
          action: "AcquireMetadataEvidence",
          tool: "dvqr_acquire_investigation_evidence",
          arguments: { investigationId, providerId: "metadata" }
        },
        evidenceBoundary: "Confirmation persists intent only. No Dataverse query or investigation evidence acquisition occurred in this tool call."
      }
    );
  }

  private dispatchManualIntentUpdate(internalName: string, args: Record<string, unknown>): DvqrMcpToolResponse {
    const investigationId = typeof args.investigationId === "string" ? args.investigationId.trim() : "";
    const pending = investigationId ? this.pendingInferredIntents.get(investigationId) : undefined;
    if (pending) {
      // Pass 10.4: a rejected confirmation must not be repurposed as a manual edit.
      // While a server-held inferred proposal is pending, the update path requires
      // the exact subsequent user text that genuinely edits the proposal. This
      // mirrors the provenance rule already used by the canonical confirmation path.
      const editText = typeof args.editText === "string" ? args.editText.trim() : "";
      const editDisposition = classifyInvestigationConfirmationText(editText);
      if (editDisposition !== "Edit") {
        return this.format(
          "This investigation still has a pending inferred intent. dvqr_update_investigation_intent may only be used when the latest user message genuinely edits the focus, problem, or goal. Pass that exact latest user message in editText. Rejected confirmation, bypass, or automatic-continuation wording cannot be converted into an intent edit.",
          {
            code: "IntentConfirmationRequired",
            investigationId,
            confirmationTool: "dvqr_confirm_investigation_intent",
            editTool: "dvqr_update_investigation_intent",
            editTextRequired: true,
            editTextDisposition: editDisposition
          },
          true
        );
      }
      const leadingDirection = typeof args.leadingDirection === "string" ? args.leadingDirection.trim() : "";
      const reportedProblem = typeof args.reportedProblem === "string" ? args.reportedProblem.trim() : "";
      const directionLogicalName = typeof args.directionLogicalName === "string" && args.directionLogicalName.trim()
        ? args.directionLogicalName.trim()
        : undefined;
      const semanticEdit = isGenuineInvestigationIntentEdit({
        ...args,
        leadingDirection,
        reportedProblem,
        ...(directionLogicalName ? { directionLogicalName } : {})
      }, pending);
      if (!semanticEdit) {
        return this.format(
          "This investigation has a pending inferred intent. Do not persist an unchanged or cosmetically renamed proposal with dvqr_update_investigation_intent. Ask the user to explicitly confirm, then call dvqr_confirm_investigation_intent with investigationId and confirmationText copied verbatim from that subsequent user message.",
          {
            code: "IntentConfirmationRequired",
            investigationId,
            confirmationTool: "dvqr_confirm_investigation_intent",
            confirmationArguments: { investigationId, confirmationText: "<exact subsequent user confirmation message>" },
            confirmationTrustBoundary: "HostSuppliedUnauthenticated",
            editTool: "dvqr_update_investigation_intent"
          },
          true
        );
      }
      this.pendingInferredIntents.delete(investigationId);
    }
    // editText is live-orchestration provenance only; never persist it as investigation intent.
    const { editText: _editText, ...persistenceArgs } = args;
    return this.dispatchProTool("dvqr_update_investigation_intent", internalName, persistenceArgs);
  }

  private validateRecommendedExecution(
    publicName: string,
    args: Record<string, unknown>
  ): DvqrMcpToolResponse | undefined {
    const investigationId = typeof args.investigationId === "string" ? args.investigationId.trim() : "";
    const suppliedActionId = typeof args.actionId === "string" ? args.actionId.trim() : "";
    if (!investigationId) return undefined;

    const continuation = this.foundation.callTool({
      name: "dvqr.continueInvestigation",
      arguments: { investigationId } as never
    });
    if (!continuation.ok) return this.format(continuation.error.message, continuation, true);

    const value = continuation.structuredContent as {
      recommendedAction?: {
        kind?: unknown;
        tool?: unknown;
        arguments?: Record<string, unknown>;
        requiredHostArguments?: Record<string, unknown>;
        integrity?: { actionId?: unknown; evidenceSetFingerprint?: unknown; strategyStepOrder?: unknown };
      };
    };
    const current = value?.recommendedAction;

    // Enforcement is scoped to an actual deterministic recommendation boundary.
    // Generic managed surfaces remain usable for their established validation and explicitly
    // optional/user-directed paths when there is no current deterministic ToolCall to protect.
    if (current?.kind !== "ToolCall" || typeof current.tool !== "string" || !current.tool) return undefined;

    const currentTool = current.tool;
    const currentActionId = typeof current?.integrity?.actionId === "string" ? current.integrity.actionId : "";
    const expectedArguments = current?.arguments && typeof current.arguments === "object" ? current.arguments : {};
    const transientKeys = current?.requiredHostArguments && typeof current.requiredHostArguments === "object"
      ? new Set(Object.keys(current.requiredHostArguments))
      : new Set<string>();

    if (!currentActionId) {
      return this.format(
        "The current deterministic recommendation does not expose a valid integrity actionId, so DVQR refused to execute it rather than bypass the action boundary.",
        {
          code: "RecommendedActionIntegrityUnavailable",
          investigationId,
          attemptedTool: publicName,
          currentRecommendedAction: current,
          noExecutionPerformed: true,
          evidenceAcquired: false
        },
        true
      );
    }

    if (!suppliedActionId) {
      return this.format(
        "This deterministic managed execution requires the current DVQR recommendedAction.integrity.actionId. Return through dvqr_continue_investigation and execute only that exact recommendation.",
        {
          code: "RecommendedActionAuthorizationRequired",
          investigationId,
          attemptedTool: publicName,
          currentTool,
          nextRequiredAction: "dvqr_continue_investigation",
          required: ["actionId"],
          noExecutionPerformed: true,
          evidenceAcquired: false
        },
        true
      );
    }

    const mismatches: string[] = [];
    if (publicName !== currentTool) mismatches.push(`tool:${publicName}!=${currentTool}`);
    if (suppliedActionId !== currentActionId) mismatches.push("actionId:stale-or-mismatched");

    for (const [key, expected] of Object.entries(expectedArguments)) {
      if (args[key] !== expected) mismatches.push(`argument:${key}`);
    }
    const permittedKeys = new Set([...Object.keys(expectedArguments), ...transientKeys, "actionId"]);
    for (const key of Object.keys(args)) {
      if (!permittedKeys.has(key)) mismatches.push(`unexpectedArgument:${key}`);
    }

    if (mismatches.length) {
      return this.format(
        "The requested managed execution does not match DVQR's exact current recommended action. The action may be stale, substituted, or have altered persisted arguments. Nothing was executed.",
        {
          code: "RecommendedActionIntegrityViolation",
          investigationId,
          attemptedTool: publicName,
          suppliedActionId,
          currentTool,
          mismatches,
          strategyStepOrder: current.integrity?.strategyStepOrder ?? null,
          evidenceSetFingerprint: current.integrity?.evidenceSetFingerprint ?? null,
          noExecutionPerformed: true,
          evidenceAcquired: false
        },
        true
      );
    }
    return undefined;
  }

  private stripRecommendedActionToken(args: Record<string, unknown>): Record<string, unknown> {
    const { actionId: _actionId, ...rest } = args;
    return rest;
  }

  private async dispatchEvidenceAcquisition(args: Record<string, unknown>): Promise<DvqrMcpToolResponse> {
    const investigationId = typeof args.investigationId === "string" ? args.investigationId.trim() : "";
    const providerId = typeof args.providerId === "string" ? args.providerId.trim() : "";
    const supportedProviders = ["metadata", "relationship-context", "runtime-relationship", "business-path-runtime", "mechanism-context", "timeline-context", "plugin-execution-understanding"];
    if (!investigationId || !supportedProviders.includes(providerId)) {
      return this.format("investigationId and a supported providerId are required.", { code: "InvalidArguments", supportedProviders }, true);
    }

    // Pass 10.3.2: validate the managed investigation subject before provider-specific
    // runtime arguments. A General/Table subject cannot become valid runtime evidence
    // merely by supplying a GUID, so surface the recoverable managed-workflow problem first.
    const loaded = this.foundation.callTool({ name: "dvqr.getInvestigation", arguments: { investigationId } as never });
    if (!loaded.ok) return this.format(loaded.error.message, loaded, true);
    const investigation = loaded.structuredContent as { question?: unknown; subject?: { logicalName?: unknown; kind?: unknown; recordIdMasked?: unknown }; status?: unknown; staleState?: { isStale?: unknown }; miniRcaArtifactRefs?: unknown; currentIntent?: { directionLogicalName?: unknown; reportedProblem?: unknown }; assertedBusinessTraversal?: { tables?: unknown }; managedReadiness?: { isStale?: unknown; evidenceSetFingerprint?: unknown; assessmentUtc?: unknown }; managedMiniRcaCheckpoint?: { artifactId?: unknown; evidenceSetFingerprint?: unknown; readinessAssessmentUtc?: unknown } };
    const logicalName = typeof investigation?.subject?.logicalName === "string" ? investigation.subject.logicalName : "";
    const subjectKind = typeof investigation?.subject?.kind === "string" ? investigation.subject.kind : "Unknown";
    if ((providerId === "runtime-relationship" || providerId === "business-path-runtime" || providerId === "mechanism-context" || providerId === "timeline-context" || providerId === "plugin-execution-understanding") && subjectKind.toLowerCase() !== "record") {
      return this.format(
        "Managed runtime evidence requires a Record-scoped investigation subject. Do not continue with standalone runtime validation because that evidence would not be journalled into this investigation.",
        { code: "UnsupportedSubject", investigationId, providerId, expectedSubjectKind: "Record", actualSubjectKind: subjectKind, ...(logicalName ? { subjectLogicalName: logicalName } : {}), managedWorkflowAction: "RepairOrRestartAsRecord", standaloneFallbackAllowed: false },
        true
      );
    }
    if (!logicalName) return this.format(
      "Managed investigation evidence cannot continue because the persisted investigation subject has no logical table binding. Do not substitute standalone metadata, relationship, or runtime tools; restart or repair the managed investigation with a Record or Table subject so evidence can remain journalled.",
      { code: "UnsupportedSubject", investigationId, providerId, expectedSubjectKinds: ["Record", "Table"], actualSubjectKind: subjectKind, managedWorkflowAction: "RepairOrRestartManagedSubject", standaloneFallbackAllowed: false },
      true
    );
    const mechanismFollowOnAllowed = (providerId === "mechanism-context" || providerId === "timeline-context" || providerId === "plugin-execution-understanding") && investigation.status === "ReadyForMiniRca" && Array.isArray(investigation.miniRcaArtifactRefs) && investigation.miniRcaArtifactRefs.length > 0;
    if ((investigation.status !== "Active" && !mechanismFollowOnAllowed) || investigation.staleState?.isStale === true) {
      return this.format("Only an active, non-stale investigation can acquire evidence, except bounded post-checkpoint mechanism/plugin-execution follow-on evidence after a persisted Mini RCA checkpoint.", { code: "InvestigationNotActive", investigationId, status: investigation.status }, true);
    }

    const sourceRecordId = typeof args.sourceRecordId === "string" ? args.sourceRecordId.trim() : "";
    if ((providerId === "runtime-relationship" || providerId === "business-path-runtime") && !sourceRecordId) {
      return this.format(`${providerId} requires sourceRecordId. The field was not received, so no runtime probe was executed.`, {
        code: "InvalidArguments", providerId, received: { investigationId: Boolean(investigationId), providerId: true, sourceRecordId: false, targetTable: typeof args.targetTable === "string" }, required: ["sourceRecordId"]
      }, true);
    }
    if ((providerId === "runtime-relationship" || providerId === "business-path-runtime") && !isDataverseGuid(sourceRecordId)) {
      return this.format(`${providerId} received sourceRecordId, but it is not a canonical Dataverse GUID (8-4-4-4-12 hexadecimal form). No runtime probe was executed.`, {
        code: "InvalidArguments", providerId, received: { investigationId: Boolean(investigationId), providerId: true, sourceRecordId: maskRecordId(sourceRecordId), targetTable: typeof args.targetTable === "string" }, invalid: ["sourceRecordId"]
      }, true);
    }
    if (providerId === "business-path-runtime" && (typeof args.targetTable !== "string" || !args.targetTable.trim())) {
      return this.format("business-path-runtime requires targetTable so the validator can test a bounded source-to-target business traversal.", {
        code: "InvalidArguments", providerId, required: ["sourceRecordId", "targetTable"]
      }, true);
    }
    if (providerId === "mechanism-context") {
      const targetTable = typeof args.targetTable === "string" ? args.targetTable.trim() : "";
      const fromIso = typeof args.fromIso === "string" ? args.fromIso.trim() : "";
      const toIso = typeof args.toIso === "string" ? args.toIso.trim() : "";
      const boundaryRequestText = typeof args.boundaryRequestText === "string" ? args.boundaryRequestText.trim() : "";
      const validIso = (value: string): boolean => Boolean(value && !Number.isNaN(Date.parse(value)));
      const checkpointAvailable = Array.isArray(investigation.miniRcaArtifactRefs) && investigation.miniRcaArtifactRefs.length > 0;
      if (!checkpointAvailable) {
        return this.format("mechanism-context is a follow-on provider after the first managed Mini RCA checkpoint. Generate the bounded checkpoint first so the mechanism question is anchored to persisted evidence.", {
          code: "PrerequisiteNotMet", providerId, required: ["persistedMiniRcaCheckpoint"]
        }, true);
      }
      const persistedTarget = typeof investigation.currentIntent?.directionLogicalName === "string" ? investigation.currentIntent.directionLogicalName.trim() : "";
      if (persistedTarget && targetTable && persistedTarget.toLowerCase() !== targetTable.toLowerCase()) {
        return this.format("mechanism-context targetTable must match the persisted investigation target. Edit investigation intent first if the mechanism focus has changed.", {
          code: "InvalidArguments", providerId, persistedTarget, requestedTarget: targetTable
        }, true);
      }
      const boundaryResolutionSource = classifyBoundaryRequestText(boundaryRequestText, fromIso, toIso);
      if (boundaryResolutionSource === "AgentBoundaryDelegation") {
        return this.format("mechanism-context cannot execute when the user delegated selection of the time boundary to the agent. Ask the user for a concrete relative or absolute temporal boundary such as 'last 30 days', 'since Monday', or explicit ISO dates. Do not manufacture boundaryRequestText from a window chosen by the agent.", {
          code: "AgentBoundaryDelegationNotAllowed", providerId, trustBoundary: "CurrentUserTemporalInstruction", boundaryRequestText, executedBoundary: { fromIso, toIso }, noExecutionPerformed: true
        }, true);
      }
      if (!boundaryResolutionSource) {
        return this.format("mechanism-context requires boundaryRequestText copied from the user's current temporal instruction. It may contain the exact ISO boundary or an explicit relative request such as 'last 30 days'. If the user supplied no temporal instruction or delegated the choice of window to the agent, do not invent one.", {
          code: "BoundaryRequestRequired", providerId, required: ["boundaryRequestText"], trustBoundary: "CurrentUserTemporalInstruction", executedBoundary: { fromIso, toIso }, noExecutionPerformed: true
        }, true);
      }
      if (!targetTable || !validIso(fromIso) || !validIso(toIso) || Date.parse(fromIso) > Date.parse(toIso)) {
        return this.format("mechanism-context requires a concrete targetTable and a valid bounded fromIso/toIso interval. No audit or execution-history query was executed.", {
          code: "InvalidArguments", providerId, required: ["targetTable", "fromIso", "toIso"], received: { targetTable: Boolean(targetTable), fromIso: Boolean(fromIso), toIso: Boolean(toIso) }
        }, true);
      }
    }
    if (providerId === "timeline-context") {
      const checkpointAvailable = Array.isArray(investigation.miniRcaArtifactRefs) && investigation.miniRcaArtifactRefs.length > 0;
      if (!checkpointAvailable) {
        return this.format("timeline-context is an optional post-checkpoint discriminator for managed Record investigations. Generate the first managed Mini RCA checkpoint before acquiring chronology so Timeline cannot leapfrog the evidence/readiness checkpoint sequence.", {
          code: "PrerequisiteNotMet",
          providerId,
          required: ["persistedMiniRcaCheckpoint"],
          recommendedAction: {
            kind: "ToolCall",
            tool: "dvqr_generate_mini_rca_checkpoint",
            arguments: { investigationId }
          }
        }, true);
      }
      const targetTable = typeof args.targetTable === "string" ? args.targetTable.trim() : "";
      const fromIso = typeof args.fromIso === "string" ? args.fromIso.trim() : "";
      const toIso = typeof args.toIso === "string" ? args.toIso.trim() : "";
      const boundaryRequestText = typeof args.boundaryRequestText === "string" ? args.boundaryRequestText.trim() : "";
      const validIso = (value: string): boolean => Boolean(value && !Number.isNaN(Date.parse(value)));
      const persistedTarget = typeof investigation.currentIntent?.directionLogicalName === "string" ? investigation.currentIntent.directionLogicalName.trim() : "";
      if (persistedTarget && targetTable && persistedTarget.toLowerCase() !== targetTable.toLowerCase()) {
        return this.format("timeline-context targetTable must match the persisted investigation target. Edit investigation intent first if the timeline focus has changed.", {
          code: "InvalidArguments", providerId, persistedTarget, requestedTarget: targetTable
        }, true);
      }
      const boundaryResolutionSource = classifyBoundaryRequestText(boundaryRequestText, fromIso, toIso);
      if (boundaryResolutionSource === "AgentBoundaryDelegation") {
        return this.format("timeline-context cannot execute when the user delegated selection of the chronology boundary to the agent. Ask the user for a concrete relative or absolute temporal boundary such as 'last 14 days', 'since Monday', or explicit ISO dates. Do not manufacture boundaryRequestText from a window chosen by the agent.", {
          code: "AgentBoundaryDelegationNotAllowed", providerId, trustBoundary: "CurrentUserTemporalInstruction", boundaryRequestText, executedBoundary: { fromIso, toIso }, noExecutionPerformed: true
        }, true);
      }
      if (!boundaryResolutionSource) {
        return this.format("timeline-context requires boundaryRequestText copied from the user's current temporal instruction. It may contain the exact ISO boundary or an explicit relative request such as 'last 30 days'. If the user supplied no temporal instruction or delegated the choice of window to the agent, do not invent one.", {
          code: "BoundaryRequestRequired", providerId, required: ["boundaryRequestText"], trustBoundary: "CurrentUserTemporalInstruction", executedBoundary: { fromIso, toIso }, noExecutionPerformed: true
        }, true);
      }
      if (!targetTable || !validIso(fromIso) || !validIso(toIso) || Date.parse(fromIso) > Date.parse(toIso)) {
        return this.format("timeline-context requires a concrete targetTable and a valid bounded fromIso/toIso interval. No timeline source was queried.", {
          code: "InvalidArguments", providerId, required: ["targetTable", "fromIso", "toIso"], received: { targetTable: Boolean(targetTable), fromIso: Boolean(fromIso), toIso: Boolean(toIso) }
        }, true);
      }
    }
    if (providerId === "plugin-execution-understanding") {
      const workspaceRoot = process.env.DVQR_MCP_WORKSPACE_ROOT?.trim() || process.cwd();
      const environmentUrl = typeof args.environmentUrl === "string" ? args.environmentUrl : process.env.DVQR_MCP_ENVIRONMENT_URL;
      const repository = new WorkspaceInvestigationEvidenceRepository(workspaceRoot, environmentUrl);
      const mechanism = [...repository.list(investigationId)].reverse().find((item) => item.providerId === "mechanism-context" && item.status === "Acquired");
      const payload = mechanism?.payload as Record<string, unknown> | undefined;
      const sources = Array.isArray(payload?.sources) ? payload.sources as Array<Record<string, unknown>> : [];
      const plugin = sources.find((item) => item.kind === "PluginTrace");
      const readiness = investigation.managedReadiness;
      const checkpoint = investigation.managedMiniRcaCheckpoint;
      const refs = Array.isArray(investigation.miniRcaArtifactRefs) ? investigation.miniRcaArtifactRefs : [];
      const handoffCurrent = Boolean(readiness && checkpoint && readiness.isStale !== true
        && checkpoint.artifactId === refs.at(-1)
        && checkpoint.evidenceSetFingerprint === readiness.evidenceSetFingerprint
        && checkpoint.readinessAssessmentUtc === readiness.assessmentUtc);
      if (!mechanism || !payload || plugin?.state !== "Observed" || !handoffCurrent) {
        const persistedPluginTraceState = typeof plugin?.state === "string" ? plugin.state : "NotAcquired";
        const exhaustedPluginPrerequisite = persistedPluginTraceState === "Empty" || persistedPluginTraceState === "Unavailable";
        const summary = exhaustedPluginPrerequisite
          ? `plugin-execution-understanding is not eligible because persisted mechanism-context has PluginTrace=${persistedPluginTraceState}. Do not reacquire the same mechanism evidence merely to satisfy this request; choose an independent discriminator or materially change the evidence boundary for a separate reason. No Dataverse query was executed.`
          : "plugin-execution-understanding requires the current refreshed Mini RCA handoff backed by persisted mechanism-context with PluginTrace=Observed. No Dataverse query was executed.";
        return this.format(summary, {
          code: "PrerequisiteNotMet",
          providerId,
          required: ["currentMechanismAwareMiniRca", "mechanism-context:PluginTrace=Observed"],
          persistedPluginTraceState,
          exhaustedPrerequisite: exhaustedPluginPrerequisite,
          shouldReacquireMechanismContext: false,
          recommendedStrategy: exhaustedPluginPrerequisite ? "IndependentDiscriminator" : "CompleteCurrentMechanismAwareCheckpoint"
        }, true);
      }
    }
    const environmentArgs = typeof args.environmentUrl === "string" ? { environmentUrl: args.environmentUrl } : {};
    let rawResult: DvqrMcpFreeToolResult;
    if (providerId === "metadata") {
      rawResult = await this.freeAdapter.getEntityMetadata({ logicalName, ...environmentArgs });
    } else if (providerId === "relationship-context") {
      rawResult = await this.freeAdapter.discoverOperationalAnchors({ sourceTable: logicalName, maxDepth: 3, maxResults: 8, maxTablesInspected: 60, ...environmentArgs });
    } else if (providerId === "mechanism-context") {
      const targetTable = String(args.targetTable).trim();
      const fromIso = String(args.fromIso).trim();
      const toIso = String(args.toIso).trim();
      const esc = (value: string): string => value.replace(/'/g, "''");
      const auditFilter = `createdon ge ${fromIso} and createdon le ${toIso} and operation ne 4`;
      const executionFilter = `primaryentitytype eq '${esc(targetTable)}' and createdon ge ${fromIso} and createdon le ${toIso}`;
      const pluginFilter = `primaryentity eq '${esc(targetTable)}' and createdon ge ${fromIso} and createdon le ${toIso}`;
      const [audit, asyncOperations, pluginTrace] = await Promise.all([
        this.freeAdapter.executeOData({ query: `/audits?$select=auditid,createdon,operation,action,_userid_value,_objectid_value,objecttypecode&$filter=${encodeURIComponent(auditFilter)}&$orderby=createdon asc&$top=25`, maxRecords: 25, ...environmentArgs }),
        this.freeAdapter.executeOData({ query: `/asyncoperations?$select=asyncoperationid,name,operationtype,statuscode,statecode,primaryentitytype,createdon,modifiedon,correlationid&$filter=${encodeURIComponent(executionFilter)}&$orderby=createdon desc&$top=12`, maxRecords: 12, ...environmentArgs }),
        this.freeAdapter.executeOData({ query: `/plugintracelogs?$select=plugintracelogid,createdon,typename,messagename,primaryentity,operationtype,mode,depth,performanceexecutionduration,correlationid,requestid&$filter=${encodeURIComponent(pluginFilter)}&$orderby=createdon desc&$top=12`, maxRecords: 12, ...environmentArgs })
      ]);
      rawResult = {
        ok: true,
        summary: `Bounded mechanism-context acquisition completed for ${targetTable}.`,
        structuredContent: { contractVersion: "dvqr-managed-mechanism-context-acquisition-v1", targetTable, interval: { fromIso, toIso }, boundaryProvenance: { source: classifyBoundaryRequestText(String(args.boundaryRequestText ?? ""), fromIso, toIso) as BoundaryResolutionSource, requestText: String(args.boundaryRequestText ?? "").trim(), resolvedFromIso: fromIso, resolvedToIso: toIso }, audit, asyncOperations, pluginTrace }
      };
    } else if (providerId === "timeline-context") {
      const targetTable = String(args.targetTable).trim();
      const fromIso = String(args.fromIso).trim();
      const toIso = String(args.toIso).trim();
      const esc = (value: string): string => value.replace(/'/g, "''");
      const auditFilter = `objecttypecode eq '${esc(targetTable)}' and createdon ge ${fromIso} and createdon le ${toIso} and operation ne 4`;
      const executionFilter = `primaryentitytype eq '${esc(targetTable)}' and createdon ge ${fromIso} and createdon le ${toIso}`;
      const pluginFilter = `primaryentity eq '${esc(targetTable)}' and createdon ge ${fromIso} and createdon le ${toIso}`;
      const [audit, asyncOperations, pluginTrace] = await Promise.all([
        this.freeAdapter.executeOData({ query: `/audits?$select=auditid,createdon,operation,action,_userid_value,_objectid_value,objecttypecode&$filter=${encodeURIComponent(auditFilter)}&$orderby=createdon asc&$top=25`, maxRecords: 25, ...environmentArgs }),
        this.freeAdapter.executeOData({ query: `/asyncoperations?$select=asyncoperationid,name,operationtype,statuscode,statecode,primaryentitytype,createdon,modifiedon,correlationid&$filter=${encodeURIComponent(executionFilter)}&$orderby=createdon asc&$top=20`, maxRecords: 20, ...environmentArgs }),
        this.freeAdapter.executeOData({ query: `/plugintracelogs?$select=plugintracelogid,createdon,typename,messagename,primaryentity,operationtype,mode,depth,performanceexecutionduration,correlationid,requestid&$filter=${encodeURIComponent(pluginFilter)}&$orderby=createdon asc&$top=20`, maxRecords: 20, ...environmentArgs })
      ]);
      rawResult = {
        ok: true,
        summary: `Bounded executable timeline acquisition completed for ${targetTable}.`,
        structuredContent: { contractVersion: "dvqr-managed-timeline-context-acquisition-v1", targetTable, interval: { fromIso, toIso }, boundaryProvenance: { source: classifyBoundaryRequestText(String(args.boundaryRequestText ?? ""), fromIso, toIso) as BoundaryResolutionSource, requestText: String(args.boundaryRequestText ?? "").trim(), resolvedFromIso: fromIso, resolvedToIso: toIso }, audit, asyncOperations, pluginTrace }
      };
    } else if (providerId === "plugin-execution-understanding") {
      const workspaceRoot = process.env.DVQR_MCP_WORKSPACE_ROOT?.trim() || process.cwd();
      const environmentUrl = typeof args.environmentUrl === "string" ? args.environmentUrl : process.env.DVQR_MCP_ENVIRONMENT_URL;
      const repository = new WorkspaceInvestigationEvidenceRepository(workspaceRoot, environmentUrl);
      const mechanism = [...repository.list(investigationId)].reverse().find((item) => item.providerId === "mechanism-context" && item.status === "Acquired");
      const payload = mechanism?.payload as Record<string, unknown>;
      const interval = payload.interval && typeof payload.interval === "object" ? payload.interval as Record<string, unknown> : {};
      const targetTable = String(payload.targetTable ?? investigation.currentIntent?.directionLogicalName ?? "").trim();
      const fromIso = String(interval.fromIso ?? "").trim();
      const toIso = String(interval.toIso ?? "").trim();
      const esc = (value: string): string => value.replace(/'/g, "''");
      const pluginFilter = `primaryentity eq '${esc(targetTable)}' and createdon ge ${fromIso} and createdon le ${toIso}`;
      const traceResult = await this.freeAdapter.executeOData({ query: `/plugintracelogs?$select=plugintracelogid,createdon,typename,messagename,primaryentity,operationtype,mode,depth,performanceexecutionduration,pluginstepid,correlationid,requestid&$filter=${encodeURIComponent(pluginFilter)}&$orderby=createdon desc&$top=12`, maxRecords: 12, ...environmentArgs });
      const traceContent = traceResult.ok && traceResult.structuredContent && typeof traceResult.structuredContent === "object" ? traceResult.structuredContent as Record<string, unknown> : {};
      const traceData = traceContent.data && typeof traceContent.data === "object" ? traceContent.data as Record<string, unknown> : {};
      const traces = Array.isArray(traceData.value) ? traceData.value as Array<Record<string, unknown>> : [];
      const stepIds = traces.map((row) => typeof row.pluginstepid === "string" ? row.pluginstepid.trim() : "").filter((value, index, values) => Boolean(value) && values.indexOf(value) === index).slice(0, 8);
      const registrations: Array<Record<string, unknown>> = [];
      for (const pluginStepId of stepIds) {
        const registration = await this.freeAdapter.executeOData({ query: `/sdkmessageprocessingsteps(${pluginStepId})?$select=sdkmessageprocessingstepid,name,description,filteringattributes,mode,stage,rank,statecode,statuscode&$expand=plugintypeid($select=friendlyname,typename),sdkmessagefilterid($select=primaryobjecttypecode),sdkmessageid($select=name)`, maxRecords: 1, ...environmentArgs });
        const registrationContent = registration.ok && registration.structuredContent && typeof registration.structuredContent === "object" ? registration.structuredContent as Record<string, unknown> : undefined;
        const row = registrationContent?.data && typeof registrationContent.data === "object" ? registrationContent.data as Record<string, unknown> : registrationContent;
        registrations.push({ pluginStepId, ok: registration.ok, row, summary: registration.ok ? "Registration resolved." : registration.message });
      }
      rawResult = {
        ok: traceResult.ok,
        summary: traceResult.ok ? `Bounded plug-in execution understanding completed for ${targetTable}.` : "Plug-in trace execution understanding could not read the bounded trace surface.",
        structuredContent: { contractVersion: "dvqr-managed-plugin-execution-understanding-acquisition-v1", prerequisiteEvidenceId: mechanism?.evidenceId, targetTable, interval: { fromIso, toIso }, traces, registrations }
      } as DvqrMcpFreeToolResult;
    } else if (providerId === "business-path-runtime") {
      if (String(investigation.subject?.kind ?? "").toLowerCase() === "record") {
        const metadata = await this.freeAdapter.getEntityMetadata({ logicalName, ...environmentArgs });
        const entity = metadata.ok && metadata.structuredContent && typeof metadata.structuredContent === "object"
          ? (metadata.structuredContent as Record<string, unknown>).entity as Record<string, unknown> | undefined
          : undefined;
        const entitySetName = typeof entity?.EntitySetName === "string" ? entity.EntitySetName : "";
        const primaryId = typeof entity?.PrimaryIdAttribute === "string" ? entity.PrimaryIdAttribute : "";
        if (!entitySetName || !primaryId) return this.format("DVQR could not validate the source record against the investigation subject table, so no business-path runtime evidence was persisted.", { code: "SourceRecordValidationFailed", investigationId, sourceTable: logicalName }, true);
        const validation = await this.freeAdapter.executeOData({ query: `/${entitySetName}(${sourceRecordId})?$select=${primaryId}`, ...environmentArgs });
        if (!validation.ok) return this.format("The supplied sourceRecordId does not resolve as a record in the investigation subject table. No business-path runtime evidence was persisted.", { code: "SourceRecordSubjectMismatch", investigationId, sourceTable: logicalName, sourceRecordId: maskRecordId(sourceRecordId) }, true);
      }
      const persistedAssertedTables = Array.isArray(investigation.assertedBusinessTraversal?.tables)
        ? investigation.assertedBusinessTraversal.tables.filter((value): value is string => typeof value === "string" && Boolean(value.trim())).map((value) => value.trim())
        : [];
      const legacyParsed = extractAssertedBusinessTraversal(`${investigation.question ?? ""} ${investigation.currentIntent?.reportedProblem ?? ""}`, logicalName)?.tables ?? [];
      const assertedBusinessPathTables = persistedAssertedTables.length >= 2 ? persistedAssertedTables : [...legacyParsed];
      const assertedMatchesTarget = assertedBusinessPathTables.length >= 2
        && assertedBusinessPathTables[0].toLowerCase() === logicalName.toLowerCase()
        && assertedBusinessPathTables[assertedBusinessPathTables.length - 1].toLowerCase() === String(args.targetTable).trim().toLowerCase();
      rawResult = await this.freeAdapter.validateBusinessPaths({
        sourceTable: logicalName,
        targetTable: String(args.targetTable).trim(),
        sourceRecordId,
        ...(assertedMatchesTarget ? { assertedBusinessPathTables } : {}),
        maxDepth: Number(args.maxDepth ?? 5),
        maxCandidates: Number(args.maxCandidates ?? 8),
        maxRecordsPerStep: Number(args.maxRecordsPerStep ?? 3),
        maxProbeRequests: Number(args.maxProbeRequests ?? 30),
        ...environmentArgs
      });
    } else {
      if (String(investigation.subject?.kind ?? "").toLowerCase() === "record") {
        const metadata = await this.freeAdapter.getEntityMetadata({ logicalName, ...environmentArgs });
        const entity = metadata.ok && metadata.structuredContent && typeof metadata.structuredContent === "object"
          ? (metadata.structuredContent as Record<string, unknown>).entity as Record<string, unknown> | undefined
          : undefined;
        const entitySetName = typeof entity?.EntitySetName === "string" ? entity.EntitySetName : "";
        const primaryId = typeof entity?.PrimaryIdAttribute === "string" ? entity.PrimaryIdAttribute : "";
        if (!entitySetName || !primaryId) return this.format("DVQR could not validate the source record against the investigation subject table, so no runtime probe was executed.", { code: "SourceRecordValidationFailed", investigationId, sourceTable: logicalName }, true);
        const validation = await this.freeAdapter.executeOData({ query: `/${entitySetName}(${sourceRecordId})?$select=${primaryId}`, ...environmentArgs });
        if (!validation.ok) {
          return this.format("The supplied sourceRecordId does not resolve as a record in the investigation subject table. No runtime evidence was persisted.", { code: "SourceRecordSubjectMismatch", investigationId, sourceTable: logicalName, sourceRecordId: maskRecordId(sourceRecordId) }, true);
        }
      }
      const workspaceRoot = process.env.DVQR_MCP_WORKSPACE_ROOT?.trim() || process.cwd();
      const environmentUrl = typeof args.environmentUrl === "string" ? args.environmentUrl : process.env.DVQR_MCP_ENVIRONMENT_URL;
      const repository = new WorkspaceInvestigationEvidenceRepository(workspaceRoot, environmentUrl);
      const relationshipEvidence = repository.list(investigationId).find((item) => item.providerId === "relationship-context" && item.status === "Acquired");
      const payload = relationshipEvidence?.payload as Record<string, unknown> | undefined;
      const recommended = payload?.recommendedAnchor as Record<string, unknown> | undefined;
      const explicitTarget = typeof args.targetTable === "string" ? args.targetTable.trim() : "";
      const firstAnchor = Array.isArray(payload?.operationalAnchors) && payload.operationalAnchors.length
        ? payload.operationalAnchors[0] as Record<string, unknown>
        : undefined;
      const recommendedTarget = (typeof recommended?.logicalName === "string" ? recommended.logicalName : "")
        || (typeof recommended?.table === "string" ? recommended.table : "")
        || (typeof recommended?.entityLogicalName === "string" ? recommended.entityLogicalName : "")
        || (typeof firstAnchor?.logicalName === "string" ? firstAnchor.logicalName : "")
        || (typeof firstAnchor?.table === "string" ? firstAnchor.table : "");
      const rankedTargets = [
        recommendedTarget,
        ...(Array.isArray(payload?.operationalAnchors) ? payload.operationalAnchors : [])
          .map((item) => item && typeof item === "object" ? item as Record<string, unknown> : undefined)
          .map((item) => typeof item?.logicalName === "string" ? item.logicalName : typeof item?.table === "string" ? item.table : "")
      ].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);
      const targets = explicitTarget ? [explicitTarget] : rankedTargets.slice(0, 3);
      if (targets.length === 0) {
        return this.format("Runtime relationship evidence requires persisted relationship-context evidence with ranked anchors, or an explicit targetTable. No runtime probe was executed.", { code: "MissingRelationshipContext", investigationId }, true);
      }
      const probeArgs = (targetTable: string) => ({
        sourceTable: logicalName,
        targetTable,
        sourceRecordId,
        maxDepth: 4,
        maxRecordsPerStep: 3,
        maxProbeRequests: 8,
        maxFamilies: 3,
        maxCandidatePaths: 4,
        expandTargetConcept: false,
        ...environmentArgs
      });
      if (explicitTarget) {
        rawResult = await this.freeAdapter.probeRelationshipPath(probeArgs(explicitTarget));
      } else {
        const multiAnchorProbes: Array<{ targetTable: string; result: DvqrMcpFreeToolResult }> = [];
        for (const targetTable of targets) {
          const result = await this.freeAdapter.probeRelationshipPath(probeArgs(targetTable));
          multiAnchorProbes.push({ targetTable, result });
          const content = result.ok && result.structuredContent && typeof result.structuredContent === "object"
            ? result.structuredContent as Record<string, unknown>
            : {};
          const recommendation = content.runtimeRecommendation;
          const runtime = content.runtimeEvidence && typeof content.runtimeEvidence === "object" ? content.runtimeEvidence as Record<string, unknown> : {};
          const observations = Array.isArray(runtime.observations) ? runtime.observations as Array<Record<string, unknown>> : [];
          const observed = Boolean(recommendation) || observations.some((item) => item.reachedTarget === true || Number(item.finalTargetRecordCount ?? 0) > 0);
          if (observed) break;
        }
        rawResult = {
          ok: true,
          summary: multiAnchorProbes.some((entry) => entry.result.ok)
            ? `Completed ${multiAnchorProbes.length} bounded ranked-anchor runtime probe(s).`
            : "Ranked-anchor runtime probes did not complete successfully.",
          structuredContent: {
            contractVersion: "dvqr-runtime-ranked-anchor-probe-v1",
            sourceTable: logicalName,
            sourceRecordId,
            multiAnchorProbes,
            bounds: { maxAnchors: 3, stopOnObserved: true, maxProbeRequestsPerAnchor: 8 }
          }
        } as DvqrMcpFreeToolResult;
      }
    }
    const recorded = this.foundation.callTool({
      name: "dvqr.recordInvestigationEvidence",
      arguments: { investigationId, providerId, rawResult } as never
    });
    if (!recorded.ok) return this.format(recorded.error.message, recorded, true);
    const completion = providerId === "metadata"
      ? [
          "DVQR acquired and persisted exactly one metadata evidence item. No other provider was called.",
          "Next recommended provider: relationship-context.",
          "Relationship Context is metadata-derived and will not claim runtime participation or traversal viability."
        ]
      : providerId === "relationship-context"
        ? [
            "DVQR acquired and persisted exactly one relationship-context evidence item. No other provider was called.",
            "The evidence identifies bounded metadata-derived business surfaces and operational anchors.",
            "It does not prove runtime participation, existing related rows, traversal viability, causality or root cause.",
            "Next recommendation: when the investigation has a concrete target table, acquire business-path-runtime evidence; otherwise use the legacy ranked-anchor runtime-relationship provider."
          ]
        : providerId === "mechanism-context"
          ? [
              "DVQR persisted one bounded mechanism-context evidence item over the explicit target and time window.",
              "Audit, async-operation and plug-in-trace sources were isolated so an unavailable source remains indeterminate rather than being flattened into an empty result.",
              "Timeline reconstruction was not synthesized because Timeline remains snapshot-backed evidence.",
              "Next recommendation: reassess investigation readiness before regenerating Mini RCA because the persisted evidence set has changed."
            ]
        : providerId === "timeline-context"
          ? [
              "DVQR persisted one bounded executable timeline-context evidence item over the explicit target and time window.",
              "Audit, async-operation and plug-in-trace observations were normalized into one chronological ledger while preserving per-source Empty/Unavailable/Observed semantics.",
              "Observed order, before/after relationships and temporal proximity are evidence of sequence only; they do not prove triggering, causality or root cause.",
              "This live investigation ledger complements rather than replaces DVQR's snapshot-backed Operational Timeline.",
              "Next recommendation: reassess investigation readiness before regenerating Mini RCA because the persisted evidence set has changed."
            ]
        : providerId === "plugin-execution-understanding"
          ? [
              "DVQR persisted one bounded plug-in execution understanding evidence item using the existing mechanism-context target/time window.",
              "Observed traces were classified by message, mode, depth and plug-in step; registered steps were resolved independently where accessible.",
              "Registration access failures remain indeterminate and do not erase observed trace participation.",
              "Message/stage/mode/registration evidence discriminates execution surface but does not prove causality or root cause.",
              "Next recommendation: reassess investigation readiness because the persisted evidence set has changed."
            ]
        : providerId === "business-path-runtime"
          ? [
              "DVQR executed one bounded business-path runtime validation and persisted the normalized path-aware result as one investigation evidence item.",
              "The evidence preserves the runtime-preferred route, alternate candidate outcomes, exact breakpoints, AccessLimited/NotTested distinctions and bounded-count semantics without persisting raw source identifiers or transport details.",
              "RuntimePreferred is scoped to this source record and tested bounds; it does not become organisation-wide business truth or prove causality.",
              "Next recommendation: assess investigation readiness through the persisted-investigation assessment path."
            ]
          : [
              "DVQR executed one bounded runtime-relationship acquisition. Without an explicit target, it probed ranked business surfaces in order and stopped when rows were observed or the three-anchor budget was exhausted.",
              "Source and target identifiers are masked or omitted from persisted evidence; full datasets and transport details are not stored.",
              "Observed results are source-record-specific and do not prove causality, root cause, complete traversal viability or persistent organisational truth.",
              "Next recommendation: assess investigation readiness through the persisted-investigation assessment path."
            ];
    return this.format(completion.join("\n"), recorded.structuredContent);
  }

  private async dispatchRelationshipQuery(args: Record<string, unknown>): Promise<DvqrMcpToolResponse> {
    try {
      const result = await this.freeAdapter.generateRelationshipQuery(args);
      if (result.ok) {
        return this.format(result.summary, result.structuredContent);
      }
      if (result.code === "UnknownNavigationProperty" || result.code === "InvalidArguments") {
        return this.format(result.message, result.structuredContent ?? {
          ok: false,
          code: result.code,
          queryGenerated: false,
          message: result.message
        });
      }
      return this.format(result.message, result.structuredError ?? result, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return this.format(
        `DVQR could not generate a relationship query safely: ${message}. No query was generated.`,
        {
          ok: false,
          code: "ExecutionFailed",
          queryGenerated: false,
          message,
          evidenceBoundary: "DVQR did not emit a query because the metadata-verified generation path failed."
        },
        true
      );
    }
  }

  private dispatchManagedReadiness(
    internalName: string,
    args: Record<string, unknown>
  ): DvqrMcpToolResponse {
    const investigationId = typeof args.investigationId === "string" ? args.investigationId.trim() : "";
    if (!investigationId) {
      return this.format(
        "investigationId is required for managed readiness assessment. Do not construct or pass a low-level readiness request envelope.",
        { code: "InvalidArguments", required: ["investigationId"], evidenceBoundary: "No readiness assessment or evidence acquisition occurred." },
        true
      );
    }
    const result = this.foundation.callTool({ name: internalName, arguments: { investigationId } as never });
    if (!result.ok) return this.format(result.error.message, result, true);
    return this.format(this.buildProCompletionText("dvqr_assess_investigation_readiness", result.structuredContent), result.structuredContent);
  }


  private dispatchRecommendedMiniRcaFallback(
    continuationInternalName: string,
    args: Record<string, unknown>
  ): DvqrMcpToolResponse {
    const investigationId = typeof args.investigationId === "string" ? args.investigationId.trim() : "";
    if (!investigationId) {
      return this.format("investigationId is required for the restricted Mini RCA continuation fallback.", {
        code: "InvalidArguments", required: ["investigationId"], noExecutionPerformed: true
      }, true);
    }
    const continuation = this.foundation.callTool({
      name: continuationInternalName,
      arguments: { investigationId } as never
    });
    if (!continuation.ok) return this.format(continuation.error.message, continuation, true);
    const value = continuation.structuredContent as {
      recommendedAction?: { kind?: unknown; tool?: unknown; arguments?: Record<string, unknown> };
    };
    const action = value?.recommendedAction;
    const actionTool = typeof action?.tool === "string" ? action.tool : "";
    const allowed = action?.kind === "ToolCall"
      && (actionTool === "dvqr_generate_mini_rca_checkpoint" || actionTool === "dvqr_generate_mini_rca");
    if (!allowed) {
      return this.format(
        "The restricted continuation fallback can execute only the currently recommended Mini RCA generation action. The canonical continuation recommendation is not Mini RCA generation, so nothing was executed.",
        {
          code: "MiniRcaFallbackNotApplicable",
          investigationId,
          currentRecommendedAction: action ?? null,
          allowedTools: ["dvqr_generate_mini_rca_checkpoint", "dvqr_generate_mini_rca"],
          noExecutionPerformed: true,
          evidenceAcquired: false
        },
        true
      );
    }
    const actionInvestigationId = typeof action?.arguments?.investigationId === "string"
      ? action.arguments.investigationId.trim()
      : investigationId;
    if (actionInvestigationId !== investigationId) {
      return this.format("Mini RCA fallback rejected because the canonical recommendation targeted a different investigationId.", {
        code: "MiniRcaFallbackInvestigationMismatch", investigationId, recommendedInvestigationId: actionInvestigationId, noExecutionPerformed: true
      }, true);
    }
    const generated = this.foundation.callTool({
      name: "dvqr.generateMiniRca",
      arguments: { investigationId } as never
    });
    if (!generated.ok) return this.format(generated.error.message, generated, true);
    return this.format(
      [
        "DVQR executed the exact currently recommended Mini RCA generation action through the restricted continuation fallback because the dedicated generator was unavailable on the host surface.",
        `Investigation ID: ${investigationId}`,
        `Canonical recommended tool: ${actionTool}`,
        "Dataverse evidence acquired: no.",
        "No evidence, readiness, Timeline, mechanism, Plugin Execution, or other recommendation was executed by this fallback.",
        "The generated artifact is the same canonical managed Mini RCA produced by dvqr_generate_mini_rca_checkpoint/dvqr_generate_mini_rca."
      ].join("\n"),
      {
        fallback: { kind: "HostSurfaceMiniRcaGeneration", canonicalRecommendedTool: actionTool, dataverseEvidenceAcquired: false },
        generated: generated.structuredContent
      }
    );
  }
  private dispatchProTool(
    publicName: string,
    internalName: string,
    args: Record<string, unknown>
  ): DvqrMcpToolResponse {
    const result = this.foundation.callTool({ name: internalName, arguments: args as never });
    if (!result.ok) {
      return this.format(result.error.message, result, true);
    }
    return this.format(this.buildProCompletionText(publicName, result.structuredContent), result.structuredContent);
  }

  private buildProCompletionText(publicName: string, structuredContent: unknown): string {
    if (publicName === "dvqr_start_investigation") {
      const value = structuredContent as { investigationId?: unknown; title?: unknown; status?: unknown; environmentId?: unknown; strategy?: { templateId?: unknown; currentStepIndex?: unknown; steps?: Array<{ order?: unknown; title?: unknown }> } };
      const id = typeof value?.investigationId === "string" ? value.investigationId : "unknown";
      const title = typeof value?.title === "string" ? value.title : "Untitled investigation";
      const status = typeof value?.status === "string" ? value.status : "Active";
      const environment = typeof value?.environmentId === "string" ? value.environmentId : "current environment";
      const strategyIndex = typeof value?.strategy?.currentStepIndex === "number" ? value.strategy.currentStepIndex : 0;
      const currentStep = Array.isArray(value?.strategy?.steps) ? value.strategy.steps[strategyIndex] : undefined;
      return [
        "DVQR created and persisted the investigation successfully.",
        `Investigation ID: ${id}`,
        `Title: ${title}`,
        `Status: ${status}`,
        `Environment: ${environment}`,
        `Workspace record: .dvforgelab/dvqr/investigations/active/${id}.json`,
        `Strategy: ${String(value?.strategy?.templateId ?? "deterministic investigation strategy")}`,
        currentStep ? `Current step ${String(currentStep.order ?? 1)}: ${String(currentStep.title ?? "Review investigation scope")}` : "Current step: strategy unavailable",
        "Evidence collected: none.",
        "This operation is complete. Do not call metadata, relationship, query or execution tools unless the user separately asks to continue the investigation."
      ].join("\n");
    }
    if (publicName === "dvqr_get_investigation") {
      const value = structuredContent as { investigationId?: unknown; title?: unknown; status?: unknown; evidenceRefs?: unknown[]; strategy?: { currentStepIndex?: unknown; steps?: Array<{ order?: unknown; title?: unknown }> } };
      const count = Array.isArray(value?.evidenceRefs) ? value.evidenceRefs.length : 0;
      const strategyIndex = typeof value?.strategy?.currentStepIndex === "number" ? value.strategy.currentStepIndex : 0;
      const currentStep = Array.isArray(value?.strategy?.steps) ? value.strategy.steps[strategyIndex] : undefined;
      return [
        "DVQR loaded the persisted investigation successfully.",
        `Investigation ID: ${String(value?.investigationId ?? "unknown")}`,
        `Title: ${String(value?.title ?? "Untitled investigation")}`,
        `Status: ${String(value?.status ?? "unknown")}`,
        `Evidence references: ${count}`,
        currentStep ? `Current strategy step ${String(currentStep.order ?? strategyIndex + 1)}: ${String(currentStep.title ?? "Untitled step")}` : "Current strategy step: complete or unavailable",
        "This result is authoritative. No Dataverse request or evidence acquisition was performed."
      ].join("\n");
    }
    if (publicName === "dvqr_list_investigations") {
      const entries = Array.isArray(structuredContent) ? structuredContent as Array<{ investigationId?: unknown; title?: unknown; status?: unknown }> : [];
      if (entries.length === 0) {
        return "DVQR successfully queried the persisted investigation index. No matching investigations were found. This empty result is authoritative; the capability is available.";
      }
      const lines = entries.slice(0, 20).map((entry) => `- ${String(entry.investigationId ?? "unknown")} | ${String(entry.status ?? "unknown")} | ${String(entry.title ?? "Untitled investigation")}`);
      return [
        `DVQR successfully listed ${entries.length} persisted investigation${entries.length === 1 ? "" : "s"}.`,
        ...lines,
        "Use dvqr_get_investigation with an exact investigation ID to load one. This result is authoritative."
      ].join("\n");
    }
    if (publicName === "dvqr_get_investigation_strategy") {
      const value = structuredContent as {
        investigationId?: unknown;
        truthSource?: unknown;
        readOnly?: unknown;
        strategy?: { templateId?: unknown; currentStepIndex?: unknown; steps?: Array<{ order?: unknown; title?: unknown; capability?: unknown; status?: unknown; requiresExplicitUserAction?: unknown }> };
        managedVerification?: {
          currentlyComplete?: unknown;
          deterministicStrategyComplete?: unknown;
          everReachedCompletion?: unknown;
          completionCount?: unknown;
          readinessState?: unknown;
          miniRcaCheckpointState?: unknown;
          stateConsistency?: { isConsistent?: unknown; violationCount?: unknown; violations?: unknown[] };
        };
      };
      const strategy = value?.strategy;
      const verification = value?.managedVerification;
      const consistency = verification?.stateConsistency;
      const index = typeof strategy?.currentStepIndex === "number" ? strategy.currentStepIndex : 0;
      const steps = Array.isArray(strategy?.steps) ? strategy.steps : [];
      const step = steps[index];
      const stepLines = steps.map((item, itemIndex) => {
        const marker = itemIndex < index ? "Presented" : itemIndex === index ? "Current" : "Pending";
        return `- Step ${String(item.order ?? itemIndex + 1)} [${String(item.status ?? marker)}]: ${String(item.title ?? "Untitled step")} | capability: ${String(item.capability ?? "none")}`;
      });
      return [
        "DVQR loaded the persisted investigation strategy and authoritative verification state.",
        `Investigation ID: ${String(value?.investigationId ?? "unknown")}`,
        `Truth source: ${String(value?.truthSource ?? "PersistedInvestigationJournal")}`,
        `Template: ${String(strategy?.templateId ?? "unknown")}`,
        step ? `Current step ${String(step.order ?? index + 1)}: ${String(step.title ?? "Untitled step")}` : "Current step: strategy complete",
        ...stepLines,
        verification ? `Managed verification: currentlyComplete=${String(verification.currentlyComplete)}, deterministicStrategyComplete=${String(verification.deterministicStrategyComplete)}, everReachedCompletion=${String(verification.everReachedCompletion)}, completionCount=${String(verification.completionCount)}, readinessState=${String(verification.readinessState)}, miniRcaCheckpointState=${String(verification.miniRcaCheckpointState)}` : "Managed verification: unavailable",
        consistency ? `State consistency: isConsistent=${String(consistency.isConsistent)}, violationCount=${String(consistency.violationCount)}, violations=${JSON.stringify(consistency.violations ?? [])}` : "State consistency: unavailable",
        step?.requiresExplicitUserAction ? "Explicit user action required for the current step: yes" : "Explicit user action required for the current step: no",
        "This result is authoritative persisted state. No evidence was acquired and no recommended capability was called."
      ].join("\n");
    }
    if (publicName === "dvqr_continue_investigation") {
      const value = structuredContent as {
        investigation?: { investigationId?: unknown };
        presentedStep?: { order?: unknown; title?: unknown; capability?: unknown; requiresExplicitUserAction?: unknown };
        nextStep?: { order?: unknown; title?: unknown };
        recommendedAction?: {
          kind?: unknown;
          tool?: unknown;
          arguments?: Record<string, unknown>;
          requiredHostArguments?: Record<string, unknown>;
          reason?: unknown;
          integrity?: {
            contractVersion?: unknown;
            actionId?: unknown;
            strategyStepOrder?: unknown;
            evidenceSetFingerprint?: unknown;
            executionBoundary?: unknown;
            exactToolAndPersistedArgumentsRequired?: unknown;
            transientHostArgumentsMayBeAddedOnlyAsSpecified?: unknown;
            mustStopAfterExecution?: unknown;
          };
        };
        completion?: { state?: unknown; evidenceSetFingerprint?: unknown; miniRcaArtifactId?: unknown; stopReason?: unknown };
        optionalActions?: Array<{ kind?: unknown; tool?: unknown; arguments?: Record<string, unknown>; requiredHostArguments?: Record<string, unknown>; reason?: unknown }>;
        statusCard?: { readiness?: unknown; readinessState?: unknown; miniRcaCheckpointState?: unknown; miniRcaCheckpointArtifactId?: unknown; evidenceCount?: unknown };
        reconvergence?: { kind?: unknown; readinessReassessedInternally?: unknown; dataverseEvidenceAcquired?: unknown; preservedCompletionCount?: unknown };
      };
      const step = value?.presentedStep;
      const action = value?.recommendedAction;
      const completion = value?.completion;
      const optionalActions = Array.isArray(value?.optionalActions) ? value.optionalActions : [];
      return [
        "DVQR advanced exactly one bounded investigation strategy step.",
        `Investigation ID: ${String(value?.investigation?.investigationId ?? "unknown")}`,
        step ? `Presented step ${String(step.order ?? "")}: ${String(step.title ?? "Untitled step")}` : "Presented step: none; strategy is complete.",
        step ? `Recommended capability: ${String(step.capability ?? "none")}` : "Recommended capability: none",
        step?.requiresExplicitUserAction ? "Explicit user action required before any execution: yes" : "Explicit user action required before any execution: no",
        value?.nextStep ? `Next step ${String(value.nextStep.order ?? "")}: ${String(value.nextStep.title ?? "Untitled step")}` : "Next step: none",
        ...(value?.statusCard ? [
          `Managed readiness state: ${String(value.statusCard.readinessState ?? "unknown")} (${String(value.statusCard.readiness ?? "NotAssessed")})`,
          `Mini RCA checkpoint state: ${String(value.statusCard.miniRcaCheckpointState ?? "unknown")}${value.statusCard.miniRcaCheckpointArtifactId ? ` (${String(value.statusCard.miniRcaCheckpointArtifactId)})` : ""}`,
          `Persisted evidence count: ${String(value.statusCard.evidenceCount ?? 0)}`
        ] : []),
        ...(value?.reconvergence?.kind === "PostCompletionTimelineReadinessFallback" ? [
          "Post-completion Timeline reconvergence: readiness was reassessed internally from persisted evidence only.",
          "Dataverse evidence acquired by fallback: no.",
          `Historical completion milestones preserved: ${String(value.reconvergence.preservedCompletionCount ?? 0)}`
        ] : []),
        ...(action?.kind === "ToolCall" && typeof action.tool === "string" ? [
          `Exact executable action: ${action.tool}`,
          `Exact action arguments: ${JSON.stringify(action.arguments ?? {})}`,
          ...(action.requiredHostArguments && Object.keys(action.requiredHostArguments).length ? [`Required transient host arguments: ${JSON.stringify(action.requiredHostArguments)}`] : []),
          `Action reason: ${String(action.reason ?? "Persisted strategy selected this action.")}`,
          ...(action.integrity ? [
            `Recommended-action contract: ${String(action.integrity.contractVersion ?? "unknown")}`,
            `Recommended-action ID: ${String(action.integrity.actionId ?? "unknown")}`,
            `Recommended-action evidence fingerprint: ${String(action.integrity.evidenceSetFingerprint ?? "unknown")}`,
            `Execution boundary: ${String(action.integrity.executionBoundary ?? "OneExplicitToolCall")}; stop after executing this one exact action and return to persisted DVQR state before any further managed action.`
          ] : []),
          "When the user has authorized this step, invoke that exact tool with those exact persisted arguments, add integrity.actionId as the actionId execution token, and add only the transient host arguments DVQR explicitly specifies. The dispatcher rejects deterministic execution without the current actionId. Do not search for a similarly named tool, substitute a retrieval-only tool, change providerId/targetTable, replay a stale actionId, or chain a second managed action in the same execution boundary."
        ] : []),
        ...(!action && completion?.state === "InvestigationComplete" ? [
          "Managed investigation completion: InvestigationComplete",
          `Stop reason: ${String(completion.stopReason ?? "All deterministic required work is complete.")}`,
          `Final checkpoint: ${String(completion.miniRcaArtifactId ?? "unknown")}`,
          `Evidence fingerprint: ${String(completion.evidenceSetFingerprint ?? "unknown")}`,
          "No required managed action remains. Do not reacquire evidence or regenerate Mini RCA merely because the user says Continue Investigation again."
        ] : []),
        ...(!action && optionalActions.length ? [
          `Optional managed branches: ${optionalActions.map((item) => String(item.tool ?? "unknown")).join(", ")}`,
          ...optionalActions.flatMap((item) => [
            `Optional action: ${String(item.tool ?? "unknown")}`,
            `Optional action arguments: ${JSON.stringify(item.arguments ?? {})}`,
            ...(item.requiredHostArguments && Object.keys(item.requiredHostArguments).length ? [`Optional transient host arguments: ${JSON.stringify(item.requiredHostArguments)}`] : []),
            `Optional action reason: ${String(item.reason ?? "User-directed optional investigation branch.")}`
          ]),
          "Optional actions are not deterministic pending steps. Execute one only after an explicit user branch choice; do not auto-run Timeline merely because chronology might be useful."
        ] : []),
        "No evidence was acquired. No metadata, query, probe, preview or execution tool was called."
      ].join("\n");
    }
    if (publicName === "dvqr_assess_investigation_readiness") {
      const value = structuredContent as { contractVersion?: unknown; investigationId?: unknown; posture?: unknown; summary?: unknown; evidenceCount?: unknown; gaps?: unknown[]; confidenceEffect?: unknown; effectiveSynthesizedConfidence?: unknown };
      return [
        "DVQR assessed and persisted investigation readiness without requiring an internal request envelope.",
        `Investigation ID: ${String(value?.investigationId ?? "unknown")}`,
        `Readiness contract: ${String(value?.contractVersion ?? "unknown")}`,
        `Posture: ${String(value?.posture ?? "NotAssessable")}`,
        `Evidence references considered: ${String(value?.evidenceCount ?? 0)}`,
        `Gaps: ${Array.isArray(value?.gaps) ? value.gaps.length : 0}`,
        `Effective confidence: ${String(value?.effectiveSynthesizedConfidence ?? "Unknown")} (${String(value?.confidenceEffect ?? "Withhold")})`,
        `Summary: ${String(value?.summary ?? "No readiness summary was returned.")}`,
        "No Dataverse execution or new evidence acquisition was performed."
      ].join("\n");
    }
    if (publicName === "dvqr_get_investigation_readiness" || publicName === "dvqr_explain_investigation_readiness") {
      const value = structuredContent as { assessed?: unknown; posture?: unknown; summary?: unknown; evidenceRefs?: unknown[]; evidenceCount?: unknown; currentEvidenceCount?: unknown; gaps?: unknown[]; contributorStates?: unknown[]; providerContributions?: unknown[]; nextStep?: unknown; isStale?: unknown; staleReason?: unknown };
      const notAssessed = value?.assessed === false || value?.posture === "NotAssessed";
      return [
        value?.isStale === true ? "DVQR returned a stored readiness result that is stale because the investigation evidence set has changed." : notAssessed ? "DVQR confirmed that investigation readiness has not been assessed." : "DVQR returned the canonical stored investigation-readiness result.",
        `Posture: ${String(value?.posture ?? "NotAssessed")}`,
        `Summary: ${String(value?.summary ?? "No canonical readiness state is stored.")}`,
        `Evidence references at assessment: ${String(value?.evidenceCount ?? (Array.isArray(value?.evidenceRefs) ? value.evidenceRefs.length : 0))}`,
        ...(value?.isStale === true ? [`Current evidence references: ${String(value?.currentEvidenceCount ?? "unknown")}`, `Stale reason: ${String(value?.staleReason ?? "Evidence changed after assessment.")}`] : []),
        `Contributors: ${Array.isArray(value?.contributorStates) ? value.contributorStates.length : Array.isArray(value?.providerContributions) ? value.providerContributions.length : 0}`,
        `Evidence gaps: ${Array.isArray(value?.gaps) ? value.gaps.length : 0}`,
        value?.isStale === true ? "Next step: reassess investigation readiness against the current evidence set." : notAssessed ? `Next step: ${String(value?.nextStep ?? "Continue investigation")}` : "Next step: review the stored gaps and recommendations.",
        "This result is authoritative. Do not search the workspace, guess an internal request contract, or call assessment tools automatically.",
        "No evidence was acquired and no Dataverse request was made."
      ].join("\n");
    }
    if (publicName === "dvqr_get_missing_evidence") {
      const value = structuredContent as { assessed?: unknown; posture?: unknown; gaps?: unknown[]; recommendations?: unknown[]; reason?: unknown; nextStep?: unknown };
      return [
        value?.assessed === false ? "DVQR confirmed that missing evidence cannot yet be enumerated because readiness is NotAssessed." : "DVQR returned the canonical missing-evidence projection.",
        `Posture: ${String(value?.posture ?? "NotAssessed")}`,
        `Missing-evidence gaps: ${Array.isArray(value?.gaps) ? value.gaps.length : 0}`,
        `Recommendations: ${Array.isArray(value?.recommendations) ? value.recommendations.length : 0}`,
        ...(value?.reason ? [`Reason: ${String(value.reason)}`] : []),
        `Next step: ${String(value?.nextStep ?? "Review stored recommendations")}`,
        "This result is authoritative. No readiness request contract is required for this retrieval call."
      ].join("\n");
    }
    if (publicName === "dvqr_explain_confidence") {
      const value = structuredContent as { assessed?: unknown; baseSynthesizedConfidence?: unknown; effectiveSynthesizedConfidence?: unknown; confidenceEffect?: unknown; confidenceLimitations?: unknown[]; nextStep?: unknown };
      return [
        value?.assessed === false ? "DVQR confirmed that confidence is Unknown because readiness is NotAssessed." : "DVQR explained the canonical stored investigation confidence.",
        `Base confidence: ${String(value?.baseSynthesizedConfidence ?? "Unknown")}`,
        `Effective confidence: ${String(value?.effectiveSynthesizedConfidence ?? "Unknown")}`,
        `Confidence effect: ${String(value?.confidenceEffect ?? "Withhold")}`,
        ...(Array.isArray(value?.confidenceLimitations) ? value.confidenceLimitations.map((item) => `Limitation: ${String(item)}`) : []),
        `Next step: ${String(value?.nextStep ?? "Review stored readiness")}`,
        "No confidence was invented and no evidence was acquired."
      ].join("\n");
    }
    if (["dvqr_list_investigation_evidence","dvqr_get_supporting_evidence","dvqr_get_contradictory_evidence","dvqr_get_investigation_evidence_gaps"].includes(publicName)) {
      const count = Array.isArray(structuredContent) ? structuredContent.length : 0;
      return `DVQR returned ${count} canonical item${count === 1 ? "" : "s"} from the persisted investigation. No evidence was acquired or reinterpreted.`;
    }
    if (publicName === "dvqr_summarize_investigation") {
      const value = structuredContent as { investigationId?: unknown; readinessPosture?: unknown; evidenceCount?: unknown; gapCount?: unknown };
      return [`DVQR summarized the persisted investigation.`,`Investigation ID: ${String(value?.investigationId ?? "unknown")}`,`Readiness: ${String(value?.readinessPosture ?? "NotAssessed")}`,`Evidence references: ${String(value?.evidenceCount ?? 0)}`,`Gaps: ${String(value?.gapCount ?? 0)}`,"No evidence was acquired or executed."].join("\n");
    }
    if (publicName === "dvqr_pause_investigation" || publicName === "dvqr_resume_investigation") {
      const value = structuredContent as { investigationId?: unknown; status?: unknown; staleState?: { isStale?: unknown; reasons?: unknown[] } };
      const stale = value?.staleState?.isStale === true;
      return [
        `DVQR ${publicName === "dvqr_pause_investigation" ? "paused" : "processed resume for"} the persisted investigation.`,
        `Investigation ID: ${String(value?.investigationId ?? "unknown")}`,
        `Status: ${String(value?.status ?? "unknown")}`,
        `Stale: ${stale ? "yes" : "no"}`,
        ...(stale && Array.isArray(value?.staleState?.reasons) ? value.staleState.reasons.map((reason) => `Stale reason: ${String(reason)}`) : []),
        "No evidence was acquired or executed."
      ].join("\n");
    }
    return `DVQR completed ${publicName}.`;
  }

  private formatFreeResult(result: DvqrMcpFreeToolResult): DvqrMcpToolResponse {
    return result.ok
      ? this.format(result.displayText ?? result.summary, result.structuredContent)
      : this.format(result.message, result.structuredError ?? result, true);
  }

  private format(text: string, structuredContent: unknown, isError = false): DvqrMcpToolResponse {
    return formatDvqrMcpToolResponse(text, structuredContent, this.portableTextOptions, isError);
  }
}
