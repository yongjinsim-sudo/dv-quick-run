import * as vscode from "vscode";
import type { CommandContext } from "../../../context/commandContext.js";
import { openOrReuseRenderedMarkdownPreviewDocument } from "../../../../refinement/queryPreview.js";
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

  await openOrReuseRenderedMarkdownPreviewDocument(buildSmartPatchPreviewDocument({
    baseUrl,
    environment,
    riskLevel,
    patchPath,
    patchBody,
    state
  }));

  const applyLabel = "Apply PATCH";
  const choice = await vscode.window.showWarningMessage(
    buildPatchConfirmationMessage(environment, riskLevel),
    { modal: true },
    applyLabel
  );

  if (choice !== applyLabel) {
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
    return `DV Quick Run: RED environment PATCH preview is ready for ${environment}. Review carefully before applying.`;
  }

  if (riskLevel === "amber") {
    return `DV Quick Run: Amber environment PATCH preview is ready for ${environment}. Apply this update?`;
  }

  return `DV Quick Run: PATCH preview is ready for ${environment}. Apply this update?`;
}

function buildEnvironmentRiskBlock(environment: string, riskLevel: PatchRiskLevel): string[] {
  if (riskLevel === "red") {
    return [
      `<div style="border-left: 6px solid #dc2626; background: rgba(220, 38, 38, 0.18); padding: 12px 14px; margin: 12px 0; border-radius: 6px;">`,
      `<strong>RED ENVIRONMENT WARNING</strong><br/>`,
      `<strong>Environment:</strong> ${environment}<br/>`,
      `<strong>Risk level:</strong> RED<br/>`,
      `You are about to update Dataverse data in a high-risk environment.<br/>`,
      `Review the entity, record id, fields, and payload before applying.<br/>`,
      `A second confirmation will be required before the PATCH is executed.`,
      `</div>`
    ];
  }

  if (riskLevel === "amber") {
    return [
      `<div style="border-left: 6px solid #d97706; background: rgba(217, 119, 6, 0.16); padding: 12px 14px; margin: 12px 0; border-radius: 6px;">`,
      `<strong>Amber environment caution</strong><br/>`,
      `<strong>Environment:</strong> ${environment}<br/>`,
      `<strong>Risk level:</strong> AMBER<br/>`,
      `Review this PATCH carefully before applying.`,
      `</div>`
    ];
  }

  return [
    `<div style="border-left: 6px solid #6b7280; background: rgba(107, 114, 128, 0.08); padding: 12px 14px; margin: 12px 0; border-radius: 6px;">`,
    `<strong>Environment:</strong> ${environment}<br/>`,
    `<strong>Risk level:</strong> Normal`,
    `</div>`
  ];
}

function buildSmartPatchPreviewDocument(args: {
  baseUrl: string;
  environment: string;
  riskLevel: PatchRiskLevel;
  patchPath: string;
  patchBody: Record<string, unknown>;
  state: SmartPatchState;
}): string {
  const fieldSummary = args.state.fields
    .map((field) => `- ${field.logicalName}: ${field.rawValue}`)
    .join("\n");

  return [
    "DV Quick Run – PATCH Preview",
    "============================",
    "",
    "Preview Smart PATCH",
    "",
    ...buildEnvironmentRiskBlock(args.environment, args.riskLevel),
    "",
    `Entity: ${args.state.entitySetName} (${args.state.entityLogicalName})`,
    `Record ID: ${args.state.id}`,
    `PATCH path: ${args.patchPath}`,
    `If-Match: ${args.state.ifMatch}`,
    "",
    "Fields:",
    fieldSummary || "(none)",
    "",
    "Payload:",
    "```json",
    JSON.stringify(args.patchBody, null, 2),
    "```",
    "",
    "HTTP:",
    "```http",
    `PATCH ${args.patchPath}`,
    "If-Match: " + args.state.ifMatch,
    "Content-Type: application/json",
    "",
    JSON.stringify(args.patchBody, null, 2),
    "```",
    "",
    "cURL:",
    "```bash",
    buildPatchCurl(args.baseUrl, args.patchPath, args.patchBody),
    "```",
    "",
    "Use the confirmation dialog to apply this PATCH.",
    "Dismissing the dialog leaves the Dataverse record unchanged."
  ].join("\n");
}
