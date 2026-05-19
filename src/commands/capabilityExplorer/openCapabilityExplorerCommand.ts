import * as vscode from "vscode";
import type { CommandContext } from "../context/commandContext.js";
import { CustomApiDiscoveryService } from "../../customApi/discovery/customApiDiscoveryService.js";
import { formatCustomApiAccessRestrictionSummary, parseCustomApiAccessRestriction, type CustomApiAccessRestrictionDetails } from "../../customApi/discovery/customApiAccessRestriction.js";
import { clearCustomApiDiscoveryAccessRestriction, setCustomApiDiscoveryAccessRestriction } from "../../customApi/discovery/customApiDiscoveryAccessState.js";
import { buildCapabilityExplorerViewModel } from "../../capabilityExplorer/capabilityExplorerViewModelBuilder.js";
import { renderCapabilityExplorerHtml } from "../../webview/capabilityExplorer/renderCapabilityExplorerHtml.js";
import {
  buildCustomApiExecutionPreview,
  buildCustomApiExecutionPreviewSurfaceSections,
  renderCustomApiExecutionRequestText
} from "../../customApi/execution/customApiExecutionPreviewBuilder.js";
import { buildCustomApiActionExecutionPlan, buildCustomApiFunctionExecutionPlan, canExecuteCustomApiAction, canExecuteCustomApiCollectionBoundAction, canExecuteCustomApiEntityBoundAction, canExecuteCustomApiFunction, promptForCustomApiFunctionParameters } from "../../customApi/execution/customApiFunctionExecution.js";
import { promptForCustomApiActionPreviewParameters, shouldPromptForCustomApiActionPreviewParameters } from "../../customApi/execution/customApiActionPreviewParameters.js";
import { buildCustomApiExecutionErrorSurfaceSections, buildCustomApiExecutionResultSurfaceSections } from "../../customApi/execution/customApiExecutionResultSurface.js";
import {
  buildCapabilityExecutionContextFromError,
  buildCapabilityExecutionContextFromPreview,
  buildCapabilityExecutionContextFromResult,
  buildCapabilityExecutionInvestigationPatch
} from "../../customApi/execution/customApiExecutionContext.js";
import { applyCustomApiExecutionEligibility } from "../../customApi/odata/odataOperationEligibility.js";
import type { CustomApiDefinition } from "../../customApi/models/customApiTypes.js";
import { runAction } from "../router/actions/shared/actionRunner.js";
import { closePreviewSurface, createPreviewAction, showPreviewSurface, updatePreviewSurface } from "../../services/previewSurfaceService.js";
import type { PreviewSurfaceRiskLevel, PreviewSurfaceSection } from "../../services/previewSurfaceTypes.js";
import { logDebug, logInfo, logWarn } from "../../utils/logger.js";
import { loadODataOperationRegistry } from "../router/actions/shared/metadataAccess.js";
import { investigationContextStore } from "../../investigation/context/investigationContextStore.js";
import { resolveCapabilityExecutionSafetyLock, resolveCapabilityRunEnvironmentLock } from "../../customApi/execution/capabilityExecutionEnvironmentGuard.js";
import { normalizeAiExecutionPolicy, type AiExecutionPolicyMode } from "../../customApi/execution/aiExecutionPolicy.js";
import { validateBoundActionTarget } from "../../customApi/execution/boundActionTargetValidation.js";


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

let capabilityExplorerPanel: vscode.WebviewPanel | undefined;
let latestDefinitions: CustomApiDefinition[] = [];
let latestEnvironmentUrl = "";
let latestEnvironmentName = "";
let capabilityExplorerPanelIsAccessRestricted = false;


function ensureCapabilityExplorerPanel(ctx: CommandContext): vscode.WebviewPanel {
  if (!capabilityExplorerPanel) {
    capabilityExplorerPanel = vscode.window.createWebviewPanel(
      "dvQuickRunCapabilityExplorer",
      "Capability Explorer",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    capabilityExplorerPanel.onDidDispose(() => {
      capabilityExplorerPanel = undefined;
      capabilityExplorerPanelIsAccessRestricted = false;
    }, null, ctx.ext.subscriptions);

    capabilityExplorerPanel.webview.onDidReceiveMessage(async (message) => {
      if (message?.type === "refresh") {
        await openCapabilityExplorer(ctx);
        return;
      }

      if (message?.type === "copyText" && typeof message.text === "string") {
        await vscode.env.clipboard.writeText(message.text);
        void vscode.window.showInformationMessage("Capability Explorer summary copied.");
        return;
      }

      if (message?.type === "openHub") {
        await vscode.commands.executeCommand("dvQuickRun.openHub");
      }
    }, null, ctx.ext.subscriptions);
  }

  return capabilityExplorerPanel;
}

function renderCapabilityExplorerAccessRestriction(ctx: CommandContext, restriction: CustomApiAccessRestrictionDetails): void {
  const activeEnvironment = ctx.envContext.getActiveEnvironment();
  latestEnvironmentUrl = activeEnvironment?.url ?? "";
  latestEnvironmentName = activeEnvironment?.name ?? "";
  latestDefinitions = [];
  setCustomApiDiscoveryAccessRestriction(latestEnvironmentUrl, restriction);
  capabilityExplorerPanelIsAccessRestricted = true;

  const model = buildCapabilityExplorerViewModel([], {
    name: activeEnvironment?.name,
    url: activeEnvironment?.url
  }, { accessRestriction: restriction });

  const panel = ensureCapabilityExplorerPanel(ctx);
  panel.title = "Capability Explorer (Access restricted)";
  panel.webview.html = renderCapabilityExplorerHtml(panel.webview, model);
  panel.reveal(vscode.ViewColumn.One);
}

function getAiExecutionPolicy(): AiExecutionPolicyMode {
  return normalizeAiExecutionPolicy(vscode.workspace.getConfiguration("dvQuickRun").get("execution.aiPolicy"));
}



function isEntityBoundAction(definition: CustomApiDefinition): boolean {
  return definition.operationKind === "Action"
    && definition.bindingKind === "Bound"
    && (definition.boundTargetKind === "entity" || definition.executionEligibility?.odataBoundTargetKind === "entity");
}

function isCollectionBoundAction(definition: CustomApiDefinition): boolean {
  return definition.operationKind === "Action"
    && definition.bindingKind === "Bound"
    && (definition.boundTargetKind === "collection" || definition.executionEligibility?.odataBoundTargetKind === "collection");
}


function canRunCurrentActionPreview(args: {
  definition: CustomApiDefinition;
  preview: ReturnType<typeof buildCustomApiExecutionPreview>;
  boundTargetRowId?: string;
}): boolean {
  if (args.preview.method !== "POST") {
    return false;
  }

  if (args.definition.bindingKind === "Unbound") {
    return canExecuteCustomApiAction(args.definition)
      && args.preview.executionCapability.canExecute === true
      && args.preview.actionReadiness?.canExecute === true;
  }

  if (isEntityBoundAction(args.definition)) {
    return canExecuteCustomApiEntityBoundAction(args.definition, args.boundTargetRowId)
      && args.preview.boundTargetContext !== undefined
      && args.preview.actionReadiness?.canExecute === true
      && args.preview.unsupportedParameters.length === 0;
  }

  if (isCollectionBoundAction(args.definition)) {
    return canExecuteCustomApiCollectionBoundAction(args.definition)
      && args.preview.boundTargetContext === undefined
      && args.preview.actionReadiness?.canExecute === true
      && args.preview.unsupportedParameters.length === 0;
  }

  return false;
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

function notifyCapabilityExecutionAvailable(apiUniqueName: string, status: "completed" | "failed"): void {
  if (!capabilityExplorerPanel) {
    return;
  }

  void capabilityExplorerPanel.webview.postMessage({
    type: "capabilityExecutionAvailable",
    apiUniqueName,
    status
  });
}

async function buildAndRenderCapabilityExplorer(ctx: CommandContext): Promise<void> {
  const scope = ctx.getScope();
  const token = await ctx.getToken(scope);
  const client = ctx.getClient();
  const discoveryService = new CustomApiDiscoveryService(ctx, client, token);
  let discoveredDefinitions: CustomApiDefinition[];
  try {
    discoveredDefinitions = await discoveryService.discoverCustomApis();
    clearCustomApiDiscoveryAccessRestriction(ctx.envContext.getActiveEnvironment()?.url);
  } catch (error) {
    const restriction = parseCustomApiAccessRestriction(error);
    if (restriction) {
      renderCapabilityExplorerAccessRestriction(ctx, restriction);
      void vscode.window.showInformationMessage("DV Quick Run: Capability Explorer is unavailable because Custom API discovery is restricted for this environment or security context.");
      return;
    }

    throw error;
  }
  const activeEnvironment = ctx.envContext.getActiveEnvironment();
  latestEnvironmentUrl = activeEnvironment?.url ?? "";
  latestEnvironmentName = activeEnvironment?.name ?? "";
  let definitions = discoveredDefinitions;

  if (capabilityExplorerPanelIsAccessRestricted) {
    const panel = capabilityExplorerPanel;
    capabilityExplorerPanel = undefined;
    capabilityExplorerPanelIsAccessRestricted = false;
    panel?.dispose();
  }

  try {
    const registry = await loadODataOperationRegistry(ctx, client, token, latestEnvironmentUrl || await ctx.getBaseUrl());
    definitions = applyCustomApiExecutionEligibility(discoveredDefinitions, registry, undefined, {
      aiPolicy: getAiExecutionPolicy()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logWarn(ctx.output, `DV Quick Run: OData operation metadata validation unavailable. ${message}`);
    definitions = applyCustomApiExecutionEligibility(
      discoveredDefinitions,
      undefined,
      "OData $metadata could not be loaded for this environment. Discovery and preview remain available, but execution is disabled until validation succeeds.",
      { aiPolicy: getAiExecutionPolicy() }
    );
  }

  latestDefinitions = definitions;
  const model = buildCapabilityExplorerViewModel(definitions, {
    name: activeEnvironment?.name,
    url: activeEnvironment?.url
  });

  if (!capabilityExplorerPanel) {
    capabilityExplorerPanel = vscode.window.createWebviewPanel(
      "dvQuickRunCapabilityExplorer",
      "Capability Explorer",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    capabilityExplorerPanel.onDidDispose(() => {
      capabilityExplorerPanel = undefined;
      capabilityExplorerPanelIsAccessRestricted = false;
    }, null, ctx.ext.subscriptions);

    capabilityExplorerPanel.webview.onDidReceiveMessage(async (message) => {
      if (message?.type === "refresh") {
        await openCapabilityExplorer(ctx);
        return;
      }

      if (message?.type === "copyText" && typeof message.text === "string") {
        await vscode.env.clipboard.writeText(message.text);
        void vscode.window.showInformationMessage("Capability Explorer summary copied.");
        return;
      }

      if (message?.type === "capabilitySelectionChanged") {
        closePreviewSurface();
        return;
      }

      if (message?.type === "boundTargetInvalid") {
        void vscode.window.showWarningMessage("DV Quick Run: Enter a valid target row GUID before generating a bound Action preview.");
        return;
      }

      if (message?.type === "boundRouteUnavailable") {
        void vscode.window.showWarningMessage("DV Quick Run: The bound entity set could not be resolved from metadata, so DV Quick Run cannot create an executable bound route.");
        return;
      }

      if (message?.type === "previewCustomApi" && typeof message.apiUniqueName === "string") {
        const definition = latestDefinitions.find((item) => item.uniqueName === message.apiUniqueName);
        if (!definition) {
          void vscode.window.showWarningMessage("Custom API definition is no longer available. Refresh Capability Explorer and try again.");
          return;
        }

        const activeEnvironment = ctx.envContext.getActiveEnvironment();
        let boundTargetRowId: string | undefined;
        if (isEntityBoundAction(definition)) {
          const targetValidation = validateBoundActionTarget({
            definition,
            rowId: message.boundTargetRowId,
            capturedEnvironmentUrl: latestEnvironmentUrl,
            activeEnvironmentUrl: activeEnvironment?.url
          });
          if (!targetValidation.valid) {
            void vscode.window.showWarningMessage(`DV Quick Run: ${targetValidation.reason}`);
            return;
          }
          boundTargetRowId = targetValidation.normalizedRowId;
        }

        const canRunFunction = canExecuteCustomApiFunction(definition);
        const canRunAction = canExecuteCustomApiAction(definition)
          || canExecuteCustomApiEntityBoundAction(definition, boundTargetRowId)
          || canExecuteCustomApiCollectionBoundAction(definition);
        let actionPreviewValues: Record<string, unknown> | undefined;

        const preview = buildCustomApiExecutionPreview(definition, {
          environmentUrl: latestEnvironmentUrl,
          parameterValues: actionPreviewValues,
          boundTargetRowId
        });

        if (canRunAction) {
          let executionValues = actionPreviewValues;

          while (true) {
            const executablePreviewModel = buildCustomApiExecutionPreview(definition, {
              environmentUrl: latestEnvironmentUrl,
              parameterValues: executionValues,
              boundTargetRowId
            });
            const currentValues = executionValues ?? {};
            const executionPlan = buildCustomApiActionExecutionPlan(definition, currentValues, latestEnvironmentUrl || await ctx.getBaseUrl(), { boundTargetRowId });
            const hasEditedPayload = Object.keys(currentValues).length > 0;
            const initialLock = resolveCapabilityRunEnvironmentLock({
              capturedEnvironmentUrl: latestEnvironmentUrl,
              capturedEnvironmentName: latestEnvironmentName,
              activeEnvironmentUrl: activeEnvironment?.url,
              activeEnvironmentName: activeEnvironment?.name
            });
            const previewAllowsExecution = canRunCurrentActionPreview({
              definition,
              preview: executablePreviewModel,
              boundTargetRowId
            });
            const executableDefinition = withPreviewExecutionState(definition, executablePreviewModel);
            const runUnavailableReason = initialLock.reason
              || executablePreviewModel.actionReadiness?.reason
              || executablePreviewModel.executionCapability.reason
              || "This Custom API Action is not executable from the current preview context.";
            const runEnabled = !initialLock.isLocked && previewAllowsExecution;

            const previewResult = await showPreviewSurface({
              kind: "customApi",
              title: "DV Quick Run – Custom API Action Preview",
              source: "capabilityExplorer",
              sourceAction: `Run ${executablePreviewModel.apiUniqueName}`,
              environmentName: activeEnvironment?.name,
              riskLevel: resolveCapabilityPreviewRiskLevel(activeEnvironment),
              summary: "Preview this POST Custom API Action request before execution. Execution only runs after explicit confirmation.",
              sections: arrangePreviewSectionsForExecution(
                buildCustomApiExecutionPreviewSurfaceSections(executablePreviewModel),
                [
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
                    `Environment: ${activeEnvironment?.name ?? latestEnvironmentName ?? "Unknown"}`,
                    `Route: ${executionPlan.path}`,
                    `Payload source: ${hasEditedPayload ? "User-edited preview payload" : "Metadata-generated preview payload"}`,
                    `Readiness: ${definition.executionCapability?.label ?? definition.actionReadiness?.state ?? "Ready to run"}`,
                    `Authority boundary: active environment must match the preview environment before execution.`,
                    initialLock.isLocked ? `Execution lock: ${initialLock.reason}` : "Execution lock: none"
                  ].join("\n"),
                    language: "text",
                    defaultCollapsed: true
                  }
                ]
              ),
              primaryAction: createPreviewAction({
                id: "runCustomApiAction",
                label: runEnabled ? (executablePreviewModel.actionReadiness?.caution ? "Run Action with caution" : "Run Action") : "Run Action unavailable",
                kind: "apply",
                enabled: runEnabled,
                description: runEnabled
                  ? "Run this Custom API Action after explicit confirmation."
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
              void vscode.window.showInformationMessage("DV Quick Run: Custom API Action preview closed. No Dataverse operation was executed.");
              return;
            }

            if (!runEnabled) {
              void vscode.window.showWarningMessage(`DV Quick Run: Custom API Action execution is unavailable. ${runUnavailableReason}`);
              continue;
            }

            if (!await confirmHighRiskActionExecution(executableDefinition, executablePreviewModel.actionReadiness)) {
              void vscode.window.showInformationMessage("DV Quick Run: Custom API Action execution cancelled. No Dataverse operation was executed.");
              continue;
            }

            const postPreviewEnvironment = ctx.envContext.getActiveEnvironment();
            const postPreviewLock = resolveCapabilityRunEnvironmentLock({
              capturedEnvironmentUrl: latestEnvironmentUrl,
              capturedEnvironmentName: latestEnvironmentName,
              activeEnvironmentUrl: postPreviewEnvironment?.url,
              activeEnvironmentName: postPreviewEnvironment?.name
            });

            if (postPreviewLock.isLocked) {
              showCapabilityRunEnvironmentLock({
                activeEnvironment: postPreviewEnvironment,
                operationKind: "Action",
                reason: postPreviewLock.reason,
                state: postPreviewLock.state,
                recovery: postPreviewLock.recovery
              });
              continue;
            }

            const token = await ctx.getToken(ctx.getScope());
            const client = ctx.getClient();
            logInfo(ctx.output, `[DV:${ctx.envContext.getEnvironmentName()}] Custom API Action POST ${definition.uniqueName}`);
            logDebug(ctx.output, `POST ${executionPlan.path}`);

            try {
              const response = await client.postWithMetadata(executionPlan.path, token, executionPlan.body ?? {});
              logInfo(ctx.output, `→ Custom API Action completed (${response.executionContext.statusCode ?? "unknown"}, ${response.executionContext.durationMs ?? 0}ms)`);
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
              notifyCapabilityExecutionAvailable(definition.uniqueName, "completed");
              updatePreviewSurface({
                kind: "customApi",
                title: "DV Quick Run – Custom API Action Result",
                source: "capabilityExplorer",
                sourceAction: `Result ${definition.displayName || definition.uniqueName}`,
                environmentName: activeEnvironment?.name,
                riskLevel: executablePreviewModel.actionReadiness?.caution || executableDefinition.actionReadiness?.caution || executableDefinition.executionCapability?.actionReadiness?.caution ? "amber" : "normal",
                summary: "Custom API Action execution completed. Review the response payload, request context, captured execution metadata, and Action readiness context.",
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
              logWarn(ctx.output, `→ Custom API Action failed: ${message}`);
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
              notifyCapabilityExecutionAvailable(definition.uniqueName, "failed");
              updatePreviewSurface({
                kind: "customApi",
                title: "DV Quick Run – Custom API Action Result",
                source: "capabilityExplorer",
                sourceAction: `Failed ${definition.displayName || definition.uniqueName}`,
                environmentName: activeEnvironment?.name,
                riskLevel: "amber",
                summary: "Custom API Action execution failed. Review the request, execution values, and returned Dataverse error payload.",
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
              void vscode.window.showErrorMessage(`DV Quick Run: Custom API Action failed. ${message}`);
            }
            return;
          }
        }

        if (!canRunFunction) {
          let previewValues = actionPreviewValues;
          while (true) {
            const previewOnlyModel = buildCustomApiExecutionPreview(definition, {
              environmentUrl: latestEnvironmentUrl,
              parameterValues: previewValues,
              boundTargetRowId
            });

            const previewOnlyResult = await showPreviewSurface({
              kind: "customApi",
              title: "DV Quick Run – Custom API Preview",
              source: "capabilityExplorer",
              sourceAction: `Preview ${previewOnlyModel.apiUniqueName}`,
              environmentName: activeEnvironment?.name,
              riskLevel: resolveCapabilityPreviewRiskLevel(activeEnvironment),
              summary: "Preview the Custom API request shape. No Dataverse operation is executed from this preview.",
              sections: buildCustomApiExecutionPreviewSurfaceSections(previewOnlyModel),
              primaryAction: createPreviewAction({
                id: "runActionUnavailable",
                label: "Run Action unavailable",
                kind: "apply",
                enabled: false,
                description: "Execution confirmation shell only. No Dataverse operation is executed in this workstream."
              }),
              secondaryActions: [
                ...(shouldPromptForCustomApiActionPreviewParameters(definition)
                  ? [createPreviewAction({
                    id: "editPreviewPayload",
                    label: "Edit Payload",
                    kind: "copy",
                    description: "Edit the preview JSON request body. No Dataverse operation is executed."
                  })]
                  : []),
                createPreviewAction({
                  id: "copyPreviewRequest",
                  label: "Copy Request",
                  kind: "copy",
                  description: "Copy the current preview request and JSON body."
                }),
                ...(shouldPromptForCustomApiActionPreviewParameters(definition)
                  ? [createPreviewAction({
                    id: "resetPreviewPayload",
                    label: previewValues && Object.keys(previewValues).length > 0 ? "Reset Payload" : "Reset Payload unavailable",
                    kind: "copy",
                    enabled: !!(previewValues && Object.keys(previewValues).length > 0),
                    description: previewValues && Object.keys(previewValues).length > 0
                      ? "Restore the metadata-generated preview payload."
                      : "Payload is already using the metadata-generated template."
                  })]
                  : []),
                createPreviewAction({ id: "cancel", label: "Close", kind: "cancel" })
              ]
            });

            captureCapabilityExecutionContext({
              context: buildCapabilityExecutionContextFromPreview({
                definition,
                environmentName: activeEnvironment?.name
              }),
              environmentUrl: activeEnvironment?.url
            });

            if (previewOnlyResult.actionId === "copyPreviewRequest") {
              await vscode.env.clipboard.writeText(renderCustomApiExecutionRequestText(previewOnlyModel));
              void vscode.window.showInformationMessage("DV Quick Run: Preview request copied. No Dataverse operation was executed.");
              continue;
            }

            if (previewOnlyResult.actionId === "resetPreviewPayload") {
              previewValues = undefined;
              void vscode.window.showInformationMessage("DV Quick Run: Preview payload reset to the metadata-generated template.");
              continue;
            }

            if (previewOnlyResult.actionId !== "editPreviewPayload") {
              return;
            }

            const editedValues = await promptForCustomApiActionPreviewParameters(definition, previewValues, activeEnvironment?.name, ctx);
            if (editedValues === undefined) {
              void vscode.window.showInformationMessage("DV Quick Run: Preview payload edit cancelled. No Dataverse operation was executed.");
              continue;
            }
            previewValues = editedValues;
          }
        }

        const initialLock = resolveCapabilityExecutionSafetyLock({
          definition,
          expectedMethod: "GET",
          capturedEnvironmentUrl: latestEnvironmentUrl,
          capturedEnvironmentName: latestEnvironmentName,
          activeEnvironmentUrl: activeEnvironment?.url,
          activeEnvironmentName: activeEnvironment?.name
        });

        if (initialLock.isLocked) {
          showCapabilityRunEnvironmentLock({
            activeEnvironment,
            operationKind: "Function",
            reason: initialLock.reason,
            state: initialLock.state,
            recovery: initialLock.recovery
          });
          return;
        }

        const values = await promptForCustomApiFunctionParameters(definition, undefined, activeEnvironment?.name);
        if (!values) {
          void vscode.window.showInformationMessage("DV Quick Run: Custom API Function execution cancelled. No Dataverse operation was executed.");
          return;
        }

        const executionPlan = buildCustomApiFunctionExecutionPlan(definition, values, latestEnvironmentUrl || await ctx.getBaseUrl());
        const previewResult = await showPreviewSurface({
          kind: "customApi",
          title: "DV Quick Run – Custom API Function Preview",
          source: "capabilityExplorer",
          sourceAction: `Run ${preview.apiUniqueName}`,
          environmentName: activeEnvironment?.name,
          riskLevel: resolveCapabilityPreviewRiskLevel(activeEnvironment),
          summary: "Review the generated Function request before execution. Execution only occurs after explicit confirmation.",
          sections: arrangePreviewSectionsForExecution(
            buildCustomApiExecutionPreviewSurfaceSections(preview),
            [
              {
                title: "Execution values",
                content: JSON.stringify(values, null, 2),
                language: "json"
              },
              {
                title: "Executable request",
                content: executionPlan.requestPreview,
                language: "http"
              }
            ]
          ),
          primaryAction: createPreviewAction({ id: "runCustomApiFunction", label: "Run Function", kind: "apply" }),
          secondaryActions: [
            createPreviewAction({ id: "cancel", label: "Cancel", kind: "cancel" })
          ]
        });

        captureCapabilityExecutionContext({
          context: buildCapabilityExecutionContextFromPreview({
            definition,
            executionPlan,
            values,
            environmentName: activeEnvironment?.name
          }),
          environmentUrl: activeEnvironment?.url
        });

        if (previewResult.actionKind !== "apply") {
          void vscode.window.showInformationMessage("DV Quick Run: Custom API Function preview cancelled. No Dataverse operation was executed.");
          return;
        }

        const postPreviewEnvironment = ctx.envContext.getActiveEnvironment();
        const postPreviewLock = resolveCapabilityExecutionSafetyLock({
          definition,
          expectedMethod: "GET",
          capturedEnvironmentUrl: latestEnvironmentUrl,
          capturedEnvironmentName: latestEnvironmentName,
          activeEnvironmentUrl: postPreviewEnvironment?.url,
          activeEnvironmentName: postPreviewEnvironment?.name
        });

        if (postPreviewLock.isLocked) {
          showCapabilityRunEnvironmentLock({
            activeEnvironment: postPreviewEnvironment,
            operationKind: "Function",
            reason: postPreviewLock.reason,
            state: postPreviewLock.state,
            recovery: postPreviewLock.recovery
          });
          return;
        }

        const token = await ctx.getToken(ctx.getScope());
        const client = ctx.getClient();
        logInfo(ctx.output, `[DV:${ctx.envContext.getEnvironmentName()}] Custom API Function GET ${definition.uniqueName}`);
        logDebug(ctx.output, `GET ${executionPlan.path}`);

        try {
          const response = await client.getWithMetadata(executionPlan.path, token);
          logInfo(ctx.output, `→ Custom API Function completed (${response.executionContext.statusCode ?? "unknown"}, ${response.executionContext.durationMs ?? 0}ms)`);
          captureCapabilityExecutionContext({
            context: buildCapabilityExecutionContextFromResult({
              definition,
              executionPlan,
              values,
              result: response,
              environmentName: activeEnvironment?.name
            }),
            environmentUrl: activeEnvironment?.url
          });
          notifyCapabilityExecutionAvailable(definition.uniqueName, "completed");
          updatePreviewSurface({
            kind: "customApi",
            title: "DV Quick Run – Custom API Result",
            source: "capabilityExplorer",
            sourceAction: `Result ${definition.displayName || definition.uniqueName}`,
            environmentName: activeEnvironment?.name,
            riskLevel: "normal",
            summary: "Custom API Function execution completed. Review the response payload, request context, and captured execution metadata.",
            sections: buildCustomApiExecutionResultSurfaceSections({
              definition,
              executionPlan,
              values,
              result: response,
              environmentName: activeEnvironment?.name
            }),
            secondaryActions: [
              createPreviewAction({ id: "cancel", label: "Close", kind: "cancel" })
            ]
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logWarn(ctx.output, `→ Custom API Function failed: ${message}`);
          captureCapabilityExecutionContext({
            context: buildCapabilityExecutionContextFromError({
              definition,
              executionPlan,
              values,
              errorMessage: message,
              environmentName: activeEnvironment?.name
            }),
            environmentUrl: activeEnvironment?.url
          });
          notifyCapabilityExecutionAvailable(definition.uniqueName, "failed");
          updatePreviewSurface({
            kind: "customApi",
            title: "DV Quick Run – Custom API Result",
            source: "capabilityExplorer",
            sourceAction: `Failed ${definition.displayName || definition.uniqueName}`,
            environmentName: activeEnvironment?.name,
            riskLevel: "amber",
            summary: "Custom API Function execution failed. Review the request, execution values, and returned Dataverse error payload.",
            sections: buildCustomApiExecutionErrorSurfaceSections({
              definition,
              executionPlan,
              values,
              errorMessage: message,
              environmentName: activeEnvironment?.name
            }),
            secondaryActions: [
              createPreviewAction({ id: "cancel", label: "Close", kind: "cancel" })
            ]
          });
          void vscode.window.showErrorMessage(`DV Quick Run: Custom API Function failed. ${message}`);
        }
        return;
      }

      if (message?.type === "openHub") {
        await vscode.commands.executeCommand("dvQuickRun.openHub");
        return;
      }

      if (message?.type === "openCapabilityExecutionInsights") {
        await vscode.commands.executeCommand("dvQuickRun.openCapabilityExecutionInsights");
        return;
      }
    }, null, ctx.ext.subscriptions);
  }

  capabilityExplorerPanel.title = `Capability Explorer (${definitions.length} Custom APIs)`;
  capabilityExplorerPanel.webview.html = renderCapabilityExplorerHtml(capabilityExplorerPanel.webview, model);
  capabilityExplorerPanel.reveal(vscode.ViewColumn.One);
}

function showCapabilityRunEnvironmentLock(args: {
  activeEnvironment: { name?: string; statusBarColor?: "white" | "amber" | "red" } | undefined;
  operationKind?: "Function" | "Action";
  reason?: string;
  state?: "stale" | "denied";
  recovery?: string;
}): void {
  const operationKind = args.operationKind ?? "Function";
  const state = args.state ?? "denied";
  const reason = args.reason ?? "Capability execution is denied because executable authority is not valid for the active environment.";
  const recovery = args.recovery ?? "Refresh Capability Explorer in the active environment before running this capability.";

  updatePreviewSurface({
    kind: "customApi",
    title: `DV Quick Run – Custom API ${operationKind} Execution ${state === "stale" ? "Stale" : "Denied"}`,
    source: "capabilityExplorer",
    sourceAction: `Run Custom API ${operationKind}`,
    environmentName: args.activeEnvironment?.name,
    riskLevel: resolveCapabilityPreviewRiskLevel(args.activeEnvironment),
    summary: reason,
    sections: [
      {
        title: "Execution authority state",
        content: [
          `State: ${state}`,
          `Operation: Custom API ${operationKind}`,
          "Execution: Not started",
          reason,
          `Recovery: ${recovery}`
        ].join("\n"),
        language: "text"
      },
      {
        title: "Safety guidance",
        content: [
          "- Active environment is the execution authority boundary.",
          "- Stale or denied capability previews fail closed.",
          "- Regenerate the preview in the active environment before execution.",
          "- No Dataverse operation was executed from this surface."
        ].join("\n"),
        language: "markdown"
      }
    ]
  });

  void vscode.window.showWarningMessage(`DV Quick Run: ${reason}`);
}


function resolveCapabilityPreviewRiskLevel(
  activeEnvironment: { statusBarColor?: "white" | "amber" | "red" } | undefined
): PreviewSurfaceRiskLevel {
  const colorHint = activeEnvironment?.statusBarColor ?? "white";
  return colorHint === "red" || colorHint === "amber" ? colorHint : "normal";
}

export function closeCapabilityExplorer(): void {
  capabilityExplorerPanelIsAccessRestricted = false;
  latestDefinitions = [];
  latestEnvironmentUrl = "";
  latestEnvironmentName = "";

  const panel = capabilityExplorerPanel;
  capabilityExplorerPanel = undefined;
  panel?.dispose();
}

export async function openCapabilityExplorer(ctx: CommandContext): Promise<void> {
  await runAction(ctx, "DV Quick Run: Open Capability Explorer failed. Check Output.", async () => {
    await buildAndRenderCapabilityExplorer(ctx);
  });
}

export function registerOpenCapabilityExplorerCommand(
  context: vscode.ExtensionContext,
  ctx: CommandContext
): void {
  const disposable = vscode.commands.registerCommand("dvQuickRun.openCapabilityExplorer", async () => {
    await openCapabilityExplorer(ctx);
  });

  context.subscriptions.push(disposable);
}
