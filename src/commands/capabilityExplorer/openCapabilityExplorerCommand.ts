import * as vscode from "vscode";
import type { CommandContext } from "../context/commandContext.js";
import { CustomApiDiscoveryService } from "../../customApi/discovery/customApiDiscoveryService.js";
import { buildCapabilityExplorerViewModel } from "../../capabilityExplorer/capabilityExplorerViewModelBuilder.js";
import { renderCapabilityExplorerHtml } from "../../webview/capabilityExplorer/renderCapabilityExplorerHtml.js";
import { buildCustomApiExecutionPreview, buildCustomApiExecutionPreviewSurfaceSections } from "../../customApi/execution/customApiExecutionPreviewBuilder.js";
import { buildCustomApiActionExecutionPlan, buildCustomApiFunctionExecutionPlan, canExecuteCustomApiAction, canExecuteCustomApiFunction, promptForCustomApiFunctionParameters } from "../../customApi/execution/customApiFunctionExecution.js";
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
import { createPreviewAction, showPreviewSurface, updatePreviewSurface } from "../../services/previewSurfaceService.js";
import type { PreviewSurfaceRiskLevel } from "../../services/previewSurfaceTypes.js";
import { logDebug, logInfo, logWarn } from "../../utils/logger.js";
import { loadODataOperationRegistry } from "../router/actions/shared/metadataAccess.js";
import { investigationContextStore } from "../../investigation/context/investigationContextStore.js";
import { resolveCapabilityExecutionSafetyLock } from "../../customApi/execution/capabilityExecutionEnvironmentGuard.js";
import { normalizeAiExecutionPolicy, type AiExecutionPolicyMode } from "../../customApi/execution/aiExecutionPolicy.js";

let capabilityExplorerPanel: vscode.WebviewPanel | undefined;
let latestDefinitions: CustomApiDefinition[] = [];
let latestEnvironmentUrl = "";
let latestEnvironmentName = "";

function getAiExecutionPolicy(): AiExecutionPolicyMode {
  return normalizeAiExecutionPolicy(vscode.workspace.getConfiguration("dvQuickRun").get("execution.aiPolicy"));
}

function captureCapabilityExecutionContext(args: {
  context: ReturnType<typeof buildCapabilityExecutionContextFromPreview>;
  environmentUrl?: string;
}): void {
  investigationContextStore.update(
    buildCapabilityExecutionInvestigationPatch(args.context, args.environmentUrl)
  );
}


async function confirmHighRiskActionExecution(definition: CustomApiDefinition): Promise<boolean> {
  const readiness = definition.actionReadiness ?? definition.executionCapability?.actionReadiness;
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
  const discoveredDefinitions = await discoveryService.discoverCustomApis();
  const activeEnvironment = ctx.envContext.getActiveEnvironment();
  latestEnvironmentUrl = activeEnvironment?.url ?? "";
  latestEnvironmentName = activeEnvironment?.name ?? "";
  let definitions = discoveredDefinitions;

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


      if (message?.type === "previewCustomApi" && typeof message.apiUniqueName === "string") {
        const definition = latestDefinitions.find((item) => item.uniqueName === message.apiUniqueName);
        if (!definition) {
          void vscode.window.showWarningMessage("Custom API definition is no longer available. Refresh Capability Explorer and try again.");
          return;
        }

        const activeEnvironment = ctx.envContext.getActiveEnvironment();
        const canRunFunction = canExecuteCustomApiFunction(definition);
        const canRunAction = canExecuteCustomApiAction(definition);
        let actionPreviewValues: Record<string, unknown> | undefined;

        if (!canRunFunction && shouldPromptForCustomApiActionPreviewParameters(definition)) {
          actionPreviewValues = await promptForCustomApiActionPreviewParameters(definition);
          if (!actionPreviewValues) {
            void vscode.window.showInformationMessage("DV Quick Run: Custom API Action preview cancelled. No Dataverse operation was executed.");
            return;
          }
        }

        const preview = buildCustomApiExecutionPreview(definition, {
          environmentUrl: latestEnvironmentUrl,
          parameterValues: actionPreviewValues
        });

        if (canRunAction) {
          const initialLock = resolveCapabilityExecutionSafetyLock({
            definition,
            expectedMethod: "POST",
            capturedEnvironmentUrl: latestEnvironmentUrl,
            capturedEnvironmentName: latestEnvironmentName,
            activeEnvironmentUrl: activeEnvironment?.url,
            activeEnvironmentName: activeEnvironment?.name
          });

          if (initialLock.isLocked) {
            showCapabilityRunEnvironmentLock({
              activeEnvironment,
              operationKind: "Action",
              reason: initialLock.reason,
              state: initialLock.state,
              recovery: initialLock.recovery
            });
            return;
          }

          const values = actionPreviewValues ?? {};
          const executionPlan = buildCustomApiActionExecutionPlan(definition, values, latestEnvironmentUrl || await ctx.getBaseUrl());
          const previewResult = await showPreviewSurface({
            kind: "customApi",
            title: "DV Quick Run – Custom API Action Preview",
            source: "capabilityExplorer",
            sourceAction: `Run ${preview.apiUniqueName}`,
            environmentName: activeEnvironment?.name,
            riskLevel: resolveCapabilityPreviewRiskLevel(activeEnvironment),
            summary: "Preview this POST Custom API Action request before execution. Execution only runs after explicit confirmation.",
            sections: [
              ...buildCustomApiExecutionPreviewSurfaceSections(preview),
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
            ],
            primaryAction: createPreviewAction({ id: "runCustomApiAction", label: preview.actionReadiness?.caution ? "Run Action with caution" : "Run Action", kind: "apply" }),
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
            void vscode.window.showInformationMessage("DV Quick Run: Custom API Action preview cancelled. No Dataverse operation was executed.");
            return;
          }

          if (!await confirmHighRiskActionExecution(definition)) {
            void vscode.window.showInformationMessage("DV Quick Run: High-risk Custom API Action execution cancelled. No Dataverse operation was executed.");
            return;
          }

          const postPreviewEnvironment = ctx.envContext.getActiveEnvironment();
          const postPreviewLock = resolveCapabilityExecutionSafetyLock({
            definition,
            expectedMethod: "POST",
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
            return;
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
              title: "DV Quick Run – Custom API Action Result",
              source: "capabilityExplorer",
              sourceAction: `Result ${definition.displayName || definition.uniqueName}`,
              environmentName: activeEnvironment?.name,
              riskLevel: definition.actionReadiness?.caution || definition.executionCapability?.actionReadiness?.caution ? "amber" : "normal",
              summary: "Custom API Action execution completed. Review the response payload, request context, captured execution metadata, and Action readiness context.",
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
            logWarn(ctx.output, `→ Custom API Action failed: ${message}`);
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
              title: "DV Quick Run – Custom API Action Result",
              source: "capabilityExplorer",
              sourceAction: `Failed ${definition.displayName || definition.uniqueName}`,
              environmentName: activeEnvironment?.name,
              riskLevel: "amber",
              summary: "Custom API Action execution failed. Review the request, execution values, and returned Dataverse error payload.",
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
            void vscode.window.showErrorMessage(`DV Quick Run: Custom API Action failed. ${message}`);
          }
          return;
        }

        if (!canRunFunction) {
          updatePreviewSurface({
            kind: "customApi",
            title: "DV Quick Run – Custom API Preview",
            source: "capabilityExplorer",
            sourceAction: `Preview ${preview.apiUniqueName}`,
            environmentName: activeEnvironment?.name,
            riskLevel: resolveCapabilityPreviewRiskLevel(activeEnvironment),
            summary: "Preview the Custom API request shape. No Dataverse operation is executed from this preview.",
            sections: buildCustomApiExecutionPreviewSurfaceSections(preview)
          });
          captureCapabilityExecutionContext({
            context: buildCapabilityExecutionContextFromPreview({
              definition,
              environmentName: activeEnvironment?.name
            }),
            environmentUrl: activeEnvironment?.url
          });
          return;
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

        const values = await promptForCustomApiFunctionParameters(definition);
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
          summary: "Preview this read-oriented Custom API Function request before execution. Execution only runs after explicit confirmation.",
          sections: [
            ...buildCustomApiExecutionPreviewSurfaceSections(preview),
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
          ],
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
