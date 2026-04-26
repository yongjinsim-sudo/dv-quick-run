import * as vscode from "vscode";
import type { CommandContext } from "../../../context/commandContext.js";
import { createPreviewAction, showPreviewSurface } from "../../../../services/previewSurfaceService.js";
import { buildPatchBody, buildPatchCurl, buildPatchPath } from "./smartPatchQueryBuilder.js";
import type { SmartPatchState } from "./smartPatchTypes.js";

type PatchRiskLevel = "white" | "amber" | "red";

export async function previewAndConfirmSmartPatch(
  ctx: CommandContext,
  baseUrl: string,
  state: SmartPatchState
): Promise<boolean> {
  const patchPath = buildPatchPath(state);
  const patchBody = buildPatchBody(state);
  const environment = ctx.envContext.getEnvironmentName();
  const riskLevel = resolvePatchRiskLevel(ctx);

  const applyLabel = "Apply PATCH";
  const previewResult = await showPreviewSurface({
    kind: "patch",
    title: "DV Quick Run – PATCH Preview",
    source: "smartPatch",
    sourceAction: "Smart PATCH",
    environmentName: environment,
    riskLevel: riskLevel === "white" ? "normal" : riskLevel,
    summary: buildPatchConfirmationMessage(environment, riskLevel),
    sections: buildSmartPatchPreviewSections({
      baseUrl,
      patchPath,
      patchBody,
      state
    }),
    primaryAction: createPreviewAction({ id: "applyPatch", label: applyLabel, kind: "apply" }),
    secondaryActions: [
      createPreviewAction({ id: "cancel", label: "Cancel", kind: "cancel" })
    ]
  });

  if (previewResult.actionKind !== "apply") {
    void vscode.window.showInformationMessage("DV Quick Run: PATCH preview cancelled. No record was updated.");
    return false;
  }

  if (riskLevel === "red") {
    const redChoice = await vscode.window.showWarningMessage(
      `DV Quick Run: RED environment '${environment}'. Confirm you want to apply this PATCH.`,
      { modal: true },
      applyLabel
    );

    if (redChoice !== applyLabel) {
      void vscode.window.showInformationMessage("DV Quick Run: RED environment PATCH cancelled. No record was updated.");
      return false;
    }
  }

  return true;
}

function resolvePatchRiskLevel(ctx: CommandContext): PatchRiskLevel {
  const colorHint = ctx.envContext.getActiveEnvironment()?.statusBarColor ?? "white";
  return colorHint === "red" || colorHint === "amber" ? colorHint : "white";
}

function buildPatchConfirmationMessage(environment: string, riskLevel: PatchRiskLevel): string {
  if (riskLevel === "red") {
    return `DV Quick Run: RED environment PATCH preview is ready for ${environment}. This PATCH will update live data. Review the payload before applying.`;
  }

  if (riskLevel === "amber") {
    return `DV Quick Run: Amber environment PATCH preview is ready for ${environment}. Apply this update?`;
  }

  return `DV Quick Run: PATCH preview is ready for ${environment}. Apply this update?`;
}

function buildSmartPatchPreviewSections(args: {
  baseUrl: string;
  patchPath: string;
  patchBody: Record<string, unknown>;
  state: SmartPatchState;
}): Array<{ title: string; content: string; language?: "text" | "json" | "http" | "bash" }> {
  const fieldSummary = args.state.fields
    .map((field) => `- ${field.logicalName}: ${field.setNull === true ? "<null>" : (field.displayValue ?? field.rawValue)}`)
    .join("\n");

  return [
    {
      title: "Target",
      content: [
        `Entity: ${args.state.entitySetName} (${args.state.entityLogicalName})`,
        `Record ID: ${args.state.id}`,
        `PATCH path: ${args.patchPath}`,
        `If-Match: ${args.state.ifMatch}`
      ].join("\n"),
      language: "text"
    },
    {
      title: "Fields",
      content: fieldSummary || "(none)",
      language: "text"
    },
    {
      title: "Payload",
      content: JSON.stringify(args.patchBody, null, 2),
      language: "json"
    },
    {
      title: "HTTP",
      content: [
        `PATCH ${args.patchPath}`,
        `If-Match: ${args.state.ifMatch}`,
        "Content-Type: application/json",
        "",
        JSON.stringify(args.patchBody, null, 2)
      ].join("\n"),
      language: "http"
    },
    {
      title: "cURL",
      content: buildPatchCurl(args.baseUrl, args.patchPath, args.patchBody),
      language: "bash"
    }
  ];
}
