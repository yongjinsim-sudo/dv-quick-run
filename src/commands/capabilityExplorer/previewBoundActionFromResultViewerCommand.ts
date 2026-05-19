import * as vscode from "vscode";
import type { CommandContext } from "../context/commandContext.js";
import { CustomApiDiscoveryService } from "../../customApi/discovery/customApiDiscoveryService.js";
import { parseCustomApiAccessRestriction } from "../../customApi/discovery/customApiAccessRestriction.js";
import { setCustomApiDiscoveryAccessRestriction } from "../../customApi/discovery/customApiDiscoveryAccessState.js";
import type { CustomApiDefinition } from "../../customApi/models/customApiTypes.js";
import { applyCustomApiExecutionEligibility } from "../../customApi/odata/odataOperationEligibility.js";
import { loadODataOperationRegistry } from "../router/actions/shared/metadataAccess.js";
import { normalizeAiExecutionPolicy, type AiExecutionPolicyMode } from "../../customApi/execution/aiExecutionPolicy.js";
import { validateBoundActionTarget } from "../../customApi/execution/boundActionTargetValidation.js";
import {
  buildCustomApiActionExecutionPlan,
  canExecuteCustomApiEntityBoundAction
} from "../../customApi/execution/customApiFunctionExecution.js";
import {
  buildCustomApiExecutionPreview,
  buildCustomApiExecutionPreviewSurfaceSections
} from "../../customApi/execution/customApiExecutionPreviewBuilder.js";
import {
  promptForCustomApiActionPreviewParameters,
  shouldPromptForCustomApiActionPreviewParameters
} from "../../customApi/execution/customApiActionPreviewParameters.js";
import { buildCustomApiExecutionErrorSurfaceSections, buildCustomApiExecutionResultSurfaceSections } from "../../customApi/execution/customApiExecutionResultSurface.js";
import {
  buildCapabilityExecutionContextFromError,
  buildCapabilityExecutionContextFromPreview,
  buildCapabilityExecutionContextFromResult,
  buildCapabilityExecutionInvestigationPatch
} from "../../customApi/execution/customApiExecutionContext.js";
import { resolveCapabilityRunEnvironmentLock } from "../../customApi/execution/capabilityExecutionEnvironmentGuard.js";
import { investigationContextStore } from "../../investigation/context/investigationContextStore.js";
import { createPreviewAction, showPreviewSurface, updatePreviewSurface } from "../../services/previewSurfaceService.js";
import type { PreviewSurfaceRiskLevel, PreviewSurfaceSection } from "../../services/previewSurfaceTypes.js";
import { logDebug, logInfo, logWarn } from "../../utils/logger.js";

export interface ResultViewerBoundActionPreviewRequest {
  entityLogicalName: string;
  entitySetName?: string;
  rowId: string;
}

function getAiExecutionPolicy(): AiExecutionPolicyMode {
  return normalizeAiExecutionPolicy(vscode.workspace.getConfiguration("dvQuickRun").get("execution.aiPolicy"));
}

function isEntityBoundActionForEntity(definition: CustomApiDefinition, entityLogicalName: string): boolean {
  const boundEntity = String(definition.executionEligibility?.odataBoundEntityLogicalName
    ?? definition.boundEntityLogicalName
    ?? "").trim().toLowerCase();

  return definition.operationKind === "Action"
    && definition.bindingKind === "Bound"
    && (definition.boundTargetKind === "entity" || definition.executionEligibility?.odataBoundTargetKind === "entity")
    && boundEntity === entityLogicalName.trim().toLowerCase();
}

function getActionLabel(definition: CustomApiDefinition): string {
  return String(definition.displayName || definition.uniqueName).trim();
}

function getActionDescription(definition: CustomApiDefinition): string {
  const readiness = definition.actionReadiness ?? definition.executionCapability?.actionReadiness;
  const pieces = [
    readiness?.label ?? definition.executionCapability?.label,
    definition.executionCapability?.reason ?? readiness?.reason,
    definition.description
  ].filter((piece): piece is string => !!piece && piece.trim().length > 0);

  return pieces.join(" • ");
}

function arrangePreviewSectionsForExecution(
  sections: PreviewSurfaceSection[],
  prioritySections: PreviewSurfaceSection[]
): PreviewSurfaceSection[] {
  const primarySections = sections.filter((section) => !section.defaultCollapsed);
  const supportingSections = sections.filter((section) => section.defaultCollapsed);

  return [
    ...primarySections,
    ...prioritySections,
    ...supportingSections
  ];
}

function resolveCapabilityPreviewRiskLevel(activeEnvironment: ReturnType<CommandContext["envContext"]["getActiveEnvironment"]>): PreviewSurfaceRiskLevel {
  const colorHint = activeEnvironment?.statusBarColor ?? "white";
  return colorHint === "red" || colorHint === "amber" ? colorHint : "normal";
}

function captureCapabilityExecutionContext(args: {
  context: ReturnType<typeof buildCapabilityExecutionContextFromPreview>;
  environmentUrl?: string;
}): void {
  investigationContextStore.update(
    buildCapabilityExecutionInvestigationPatch(args.context, args.environmentUrl)
  );
}

async function confirmHighRiskActionExecution(definition: CustomApiDefinition, readinessOverride?: CustomApiDefinition["actionReadiness"]): Promise<boolean> {
  const readiness = readinessOverride ?? definition.actionReadiness ?? definition.executionCapability?.actionReadiness;
  if (!readiness?.requiresTypedConfirmation || !readiness.confirmationPhrase) {
    return true;
  }

  const response = await vscode.window.showInputBox({
    title: "DV Quick Run: Confirm high-risk Action",
    prompt: `Type ${readiness.confirmationPhrase} to execute ${definition.displayName || definition.uniqueName}.`,
    placeHolder: readiness.confirmationPhrase,
    ignoreFocusOut: true,
    validateInput: (input) => input.trim() === readiness.confirmationPhrase
      ? undefined
      : `Type ${readiness.confirmationPhrase} exactly to execute.`
  });

  return response?.trim() === readiness.confirmationPhrase;
}

function withPreviewExecutionState(definition: CustomApiDefinition, preview: ReturnType<typeof buildCustomApiExecutionPreview>): CustomApiDefinition {
  return {
    ...definition,
    actionReadiness: preview.actionReadiness ?? definition.actionReadiness,
    executionCapability: {
      ...preview.executionCapability,
      mode: preview.actionReadiness?.canExecute ? "executable" : preview.executionCapability.mode,
      state: preview.actionReadiness?.canExecute ? "executable" : preview.executionCapability.state,
      label: preview.actionReadiness?.canExecute ? preview.actionReadiness.label : preview.executionCapability.label,
      reason: preview.actionReadiness?.reason ?? preview.executionCapability.reason,
      canExecute: preview.actionReadiness?.canExecute === true,
      actionReadiness: preview.actionReadiness ?? preview.executionCapability.actionReadiness
    }
  };
}

async function executePreviewLoop(
  ctx: CommandContext,
  definition: CustomApiDefinition,
  boundTargetRowId: string,
  environmentUrl: string,
  environmentName: string
): Promise<void> {
  const activeEnvironment = ctx.envContext.getActiveEnvironment();
  let executionValues: Record<string, unknown> | undefined;

  while (true) {
    const executablePreviewModel = buildCustomApiExecutionPreview(definition, {
      environmentUrl,
      parameterValues: executionValues,
      boundTargetRowId
    });
    const currentValues = executionValues ?? {};
    const executionPlan = buildCustomApiActionExecutionPlan(definition, currentValues, environmentUrl || await ctx.getBaseUrl(), { boundTargetRowId });
    const hasEditedPayload = Object.keys(currentValues).length > 0;
    const initialLock = resolveCapabilityRunEnvironmentLock({
      capturedEnvironmentUrl: environmentUrl,
      capturedEnvironmentName: environmentName,
      activeEnvironmentUrl: activeEnvironment?.url,
      activeEnvironmentName: activeEnvironment?.name
    });
    const executableDefinition = withPreviewExecutionState(definition, executablePreviewModel);
    const runUnavailableReason = initialLock.reason
      || executablePreviewModel.actionReadiness?.reason
      || executablePreviewModel.executionCapability.reason
      || "This bound Action is not executable from the current preview context.";
    const runEnabled = !initialLock.isLocked
      && canExecuteCustomApiEntityBoundAction(definition, boundTargetRowId)
      && executablePreviewModel.actionReadiness?.canExecute === true
      && executablePreviewModel.unsupportedParameters.length === 0;

    const previewResult = await showPreviewSurface({
      kind: "customApi",
      title: "DV Quick Run – Result Viewer Bound Action Preview",
      source: "resultViewer",
      sourceAction: `Preview ${executablePreviewModel.apiUniqueName}`,
      environmentName: activeEnvironment?.name,
      riskLevel: resolveCapabilityPreviewRiskLevel(activeEnvironment),
      summary: "Preview this row-context bound Action request before execution. The Result Viewer only supplied target row context; execution still requires explicit confirmation.",
      sections: arrangePreviewSectionsForExecution(
        buildCustomApiExecutionPreviewSurfaceSections(executablePreviewModel),
        [
          {
            title: "Result Viewer target context",
            content: [
              `Source: Result Viewer row kebab`,
              `Target entity: ${definition.executionEligibility?.odataBoundEntityLogicalName ?? definition.boundEntityLogicalName ?? "Unknown"}`,
              `Target row id: ${boundTargetRowId}`,
              `Authority boundary: active environment must match the preview environment before execution.`
            ].join("\n"),
            language: "text"
          },
          {
            title: "Executable request",
            content: executionPlan.requestPreview,
            language: "http"
          },
          {
            title: "Execution confirmation shell",
            content: [
              `Execution status: ${runEnabled ? "Ready for explicit confirmation" : "Unavailable"}`,
              `Operation: ${definition.displayName || definition.uniqueName}`,
              `Environment: ${activeEnvironment?.name ?? environmentName ?? "Unknown"}`,
              `Route: ${executionPlan.path}`,
              `Payload source: ${hasEditedPayload ? "User-edited preview payload" : "Metadata-generated preview payload"}`,
              `Readiness: ${executablePreviewModel.actionReadiness?.label ?? definition.executionCapability?.label ?? "Ready to run"}`,
              initialLock.isLocked ? `Execution lock: ${initialLock.reason}` : "Execution lock: none"
            ].join("\n"),
            language: "text",
            defaultCollapsed: true
          }
        ]
      ),
      primaryAction: createPreviewAction({
        id: "runResultViewerBoundAction",
        label: runEnabled ? (executablePreviewModel.actionReadiness?.caution ? "Run Action with caution" : "Run Action") : "Run Action unavailable",
        kind: "apply",
        enabled: runEnabled,
        description: runEnabled
          ? "Run this bound Action after explicit confirmation."
          : runUnavailableReason
      }),
      secondaryActions: [
        ...(shouldPromptForCustomApiActionPreviewParameters(definition)
          ? [createPreviewAction({
            id: "editPreviewPayload",
            label: "Edit Payload",
            kind: "copy",
            description: "Edit the preview JSON request body before execution."
          })]
          : []),
        createPreviewAction({
          id: "copyPreviewRequest",
          label: "Copy Request",
          kind: "copy",
          description: "Copy the current executable request and JSON body."
        }),
        ...(shouldPromptForCustomApiActionPreviewParameters(definition)
          ? [createPreviewAction({
            id: "resetPreviewPayload",
            label: hasEditedPayload ? "Reset Payload" : "Reset Payload unavailable",
            kind: "copy",
            enabled: hasEditedPayload,
            description: hasEditedPayload
              ? "Restore the metadata-generated preview payload."
              : "Payload is already using the metadata-generated template."
          })]
          : []),
        createPreviewAction({ id: "cancel", label: "Close", kind: "cancel" })
      ]
    });

    captureCapabilityExecutionContext({
      context: buildCapabilityExecutionContextFromPreview({
        definition: executableDefinition,
        executionPlan,
        values: currentValues,
        environmentName: activeEnvironment?.name
      }),
      environmentUrl: activeEnvironment?.url
    });

    if (previewResult.actionId === "copyPreviewRequest") {
      await vscode.env.clipboard.writeText(executionPlan.requestPreview);
      void vscode.window.showInformationMessage("DV Quick Run: Executable request copied. No Dataverse operation was executed.");
      continue;
    }

    if (previewResult.actionId === "resetPreviewPayload") {
      executionValues = undefined;
      void vscode.window.showInformationMessage("DV Quick Run: Preview payload reset to the metadata-generated template.");
      continue;
    }

    if (previewResult.actionId === "editPreviewPayload") {
      const editedValues = await promptForCustomApiActionPreviewParameters(definition, executionValues, activeEnvironment?.name, ctx);
      if (editedValues === undefined) {
        void vscode.window.showInformationMessage("DV Quick Run: Preview payload edit cancelled. No Dataverse operation was executed.");
        continue;
      }
      executionValues = editedValues;
      continue;
    }

    if (previewResult.actionKind !== "apply") {
      void vscode.window.showInformationMessage("DV Quick Run: Result Viewer bound Action preview closed. No Dataverse operation was executed.");
      return;
    }

    if (!runEnabled) {
      void vscode.window.showWarningMessage(`DV Quick Run: Bound Action execution is unavailable. ${runUnavailableReason}`);
      continue;
    }

    if (!await confirmHighRiskActionExecution(executableDefinition, executablePreviewModel.actionReadiness)) {
      void vscode.window.showInformationMessage("DV Quick Run: Bound Action execution cancelled. No Dataverse operation was executed.");
      continue;
    }

    const postPreviewEnvironment = ctx.envContext.getActiveEnvironment();
    const postPreviewLock = resolveCapabilityRunEnvironmentLock({
      capturedEnvironmentUrl: environmentUrl,
      capturedEnvironmentName: environmentName,
      activeEnvironmentUrl: postPreviewEnvironment?.url,
      activeEnvironmentName: postPreviewEnvironment?.name
    });

    if (postPreviewLock.isLocked) {
      void vscode.window.showWarningMessage(`DV Quick Run: Bound Action execution blocked. ${postPreviewLock.reason}`);
      continue;
    }

    const token = await ctx.getToken(ctx.getScope());
    const client = ctx.getClient();
    logInfo(ctx.output, `[DV:${ctx.envContext.getEnvironmentName()}] Result Viewer bound Action POST ${definition.uniqueName}`);
    logDebug(ctx.output, `POST ${executionPlan.path}`);

    try {
      const response = await client.postWithMetadata(executionPlan.path, token, executionPlan.body ?? {});
      logInfo(ctx.output, `→ Result Viewer bound Action completed (${response.executionContext.statusCode ?? "unknown"}, ${response.executionContext.durationMs ?? 0}ms)`);
      captureCapabilityExecutionContext({
        context: buildCapabilityExecutionContextFromResult({
          definition: executableDefinition,
          executionPlan,
          values: currentValues,
          result: response,
          environmentName: activeEnvironment?.name
        }),
        environmentUrl: activeEnvironment?.url
      });
      updatePreviewSurface({
        kind: "customApi",
        title: "DV Quick Run – Result Viewer Bound Action Result",
        source: "resultViewer",
        sourceAction: `Result ${definition.displayName || definition.uniqueName}`,
        environmentName: activeEnvironment?.name,
        riskLevel: executablePreviewModel.actionReadiness?.caution || executableDefinition.actionReadiness?.caution || executableDefinition.executionCapability?.actionReadiness?.caution ? "amber" : "normal",
        summary: "Bound Action execution completed from Result Viewer context. Review the response payload, target row context, and captured execution metadata.",
        sections: buildCustomApiExecutionResultSurfaceSections({
          definition: executableDefinition,
          executionPlan,
          values: currentValues,
          result: response,
          environmentName: activeEnvironment?.name
        }),
        secondaryActions: [
          createPreviewAction({ id: "cancel", label: "Close", kind: "cancel" })
        ]
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logWarn(ctx.output, `→ Result Viewer bound Action failed: ${message}`);
      captureCapabilityExecutionContext({
        context: buildCapabilityExecutionContextFromError({
          definition: executableDefinition,
          executionPlan,
          values: currentValues,
          errorMessage: message,
          environmentName: activeEnvironment?.name
        }),
        environmentUrl: activeEnvironment?.url
      });
      updatePreviewSurface({
        kind: "customApi",
        title: "DV Quick Run – Result Viewer Bound Action Result",
        source: "resultViewer",
        sourceAction: `Failed ${definition.displayName || definition.uniqueName}`,
        environmentName: activeEnvironment?.name,
        riskLevel: "amber",
        summary: "Bound Action execution failed from Result Viewer context. Review the request, target row context, and returned Dataverse error payload.",
        sections: buildCustomApiExecutionErrorSurfaceSections({
          definition: executableDefinition,
          executionPlan,
          values: currentValues,
          errorMessage: message,
          environmentName: activeEnvironment?.name
        }),
        secondaryActions: [
          createPreviewAction({ id: "cancel", label: "Close", kind: "cancel" })
        ]
      });
      void vscode.window.showErrorMessage(`DV Quick Run: Bound Action failed. ${message}`);
    }
    return;
  }
}

export async function previewBoundActionFromResultViewer(
  ctx: CommandContext,
  request: ResultViewerBoundActionPreviewRequest
): Promise<void> {
  const rowId = request.rowId.trim();
  const entityLogicalName = request.entityLogicalName.trim();
  if (!rowId || !entityLogicalName) {
    void vscode.window.showWarningMessage("DV Quick Run: Result Viewer bound Actions require entity and row context.");
    return;
  }

  const activeEnvironment = ctx.envContext.getActiveEnvironment();
  const environmentUrl = activeEnvironment?.url ?? await ctx.getBaseUrl();
  const environmentName = activeEnvironment?.name ?? ctx.envContext.getEnvironmentName();
  const token = await ctx.getToken(ctx.getScope());
  const client = ctx.getClient();
  const discoveryService = new CustomApiDiscoveryService(ctx, client, token);
  let discoveredDefinitions: CustomApiDefinition[];
  try {
    discoveredDefinitions = await discoveryService.discoverCustomApis();
  } catch (error) {
    const restriction = parseCustomApiAccessRestriction(error);
    if (restriction) {
      setCustomApiDiscoveryAccessRestriction(environmentUrl, restriction);
      const missingPrivilege = restriction.missingPrivilege ? ` Missing privilege: ${restriction.missingPrivilege}.` : "";
      void vscode.window.showInformationMessage(`DV Quick Run: Bound Actions are unavailable because Custom API discovery is restricted for this environment or security context.${missingPrivilege}`);
      return;
    }

    throw error;
  }
  let definitions = discoveredDefinitions;

  try {
    const registry = await loadODataOperationRegistry(ctx, client, token, environmentUrl);
    definitions = applyCustomApiExecutionEligibility(discoveredDefinitions, registry, undefined, {
      aiPolicy: getAiExecutionPolicy()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logWarn(ctx.output, `DV Quick Run: OData operation metadata validation unavailable for Result Viewer bound Actions. ${message}`);
    definitions = applyCustomApiExecutionEligibility(
      discoveredDefinitions,
      undefined,
      "OData $metadata could not be loaded for this environment. Result Viewer bound Action preview remains unavailable until validation succeeds.",
      { aiPolicy: getAiExecutionPolicy() }
    );
  }

  const compatibleActions = definitions
    .filter((definition) => isEntityBoundActionForEntity(definition, entityLogicalName))
    .filter((definition) => validateBoundActionTarget({
      definition,
      rowId,
      capturedEnvironmentUrl: environmentUrl,
      activeEnvironmentUrl: activeEnvironment?.url
    }).valid)
    .filter((definition) => canExecuteCustomApiEntityBoundAction(definition, rowId))
    .sort((left, right) => getActionLabel(left).localeCompare(getActionLabel(right)));

  if (compatibleActions.length === 0) {
    void vscode.window.showInformationMessage(`DV Quick Run: No preview-ready entity-bound Actions found for ${entityLogicalName}. Unsupported/private/complex-parameter Actions remain inspectable in Capability Explorer.`);
    return;
  }

  const selected = await vscode.window.showQuickPick(
    compatibleActions.map((definition) => ({
      label: getActionLabel(definition),
      description: definition.uniqueName,
      detail: getActionDescription(definition),
      definition
    })),
    {
      title: `DV Quick Run: Preview bound Action for ${entityLogicalName}`,
      placeHolder: "Choose an eligible Action. Result Viewer will only prefill the target row; execution still requires preview and confirmation.",
      matchOnDescription: true,
      matchOnDetail: true
    }
  );

  if (!selected) {
    return;
  }

  await executePreviewLoop(ctx, selected.definition, rowId, environmentUrl, environmentName);
}
