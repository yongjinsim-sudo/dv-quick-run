import * as vscode from "vscode";
import type { CommandContext } from "../context/commandContext.js";
import { investigationContextStore } from "../../investigation/context/investigationContextStore.js";
import { buildExecutionInsightSuggestions } from "../../product/executionInsights/executionInsightsOrchestrator.js";
import { updatePreviewSurface } from "../../services/previewSurfaceService.js";
import { buildCapabilityExecutionInsightLinkContext, buildCapabilityExecutionInsightSections, deriveCapabilityExecutionInsightLinkSummary } from "../../customApi/execution/capabilityExecutionInsightLinking.js";
import { registerCommand } from "../registerCommandHelpers.js";

export async function openCapabilityExecutionInsights(ctx: CommandContext): Promise<void> {
  const investigationContext = investigationContextStore.getCurrent();
  const linkContext = buildCapabilityExecutionInsightLinkContext(investigationContext);

  if (!linkContext) {
    void vscode.window.showInformationMessage("DV Quick Run: Run or preview a Custom API capability before opening capability Execution Insights.");
    return;
  }

  const linkSummary = deriveCapabilityExecutionInsightLinkSummary(linkContext);
  if (linkSummary.strength === "none") {
    updatePreviewSurface({
      kind: "diagnostic",
      title: "DV Quick Run – Capability Execution Insights",
      source: "capabilityExplorer",
      sourceAction: `Execution Insights ${linkContext.operationUniqueName}`,
      environmentName: linkContext.environmentName,
      summary: "Preview-only capability context has no Dataverse runtime evidence to inspect.",
      sections: buildCapabilityExecutionInsightSections({
        context: linkContext,
        suggestions: []
      })
    });
    return;
  }

  const token = await ctx.getToken(ctx.getScope());
  const executionInsightResult = await buildExecutionInsightSuggestions({
    client: ctx.getClient(),
    token,
    queryPath: linkContext.path,
    correlationId: linkContext.correlationId,
    requestId: linkContext.requestId,
    operationId: linkContext.operationId
  });

  investigationContextStore.update({
    source: "executionInsights",
    runtime: {
      correlationId: linkContext.correlationId,
      requestId: linkContext.requestId,
      operationId: linkContext.operationId,
      providerIds: ["capabilityExecution"]
    },
    surfaceState: {
      executionInsightsOpen: true,
      recoverable: true
    }
  });

  const surfaceSummary = linkSummary.strength === "direct"
    ? "Bounded runtime evidence linked from captured Custom API execution identifiers."
    : "Bounded runtime evidence review started from the Custom API execution context.";

  updatePreviewSurface({
    kind: "diagnostic",
    title: "DV Quick Run – Capability Execution Insights",
    source: "capabilityExplorer",
    sourceAction: `Execution Insights ${linkContext.operationUniqueName}`,
    environmentName: linkContext.environmentName,
    summary: surfaceSummary,
    sections: buildCapabilityExecutionInsightSections({
      context: linkContext,
      suggestions: executionInsightResult.suggestions,
      shouldSuppressExecutionInsights: executionInsightResult.shouldSuppressExecutionInsights
    })
  });
}

export function registerOpenCapabilityExecutionInsightsCommand(
  context: vscode.ExtensionContext,
  ctx: CommandContext
): void {
  registerCommand(context, "dvQuickRun.openCapabilityExecutionInsights", openCapabilityExecutionInsights, ctx);
}
