import * as vscode from "vscode";

import { DVFORGELAB_PRODUCTS_URL, DVFORGELAB_STORE_URL, DVQR_PRICING_URL } from "../../product/capabilities/commercialLinks.js";

export async function openDvQuickRunPricing(): Promise<void> {
  await vscode.env.openExternal(vscode.Uri.parse(DVQR_PRICING_URL));
}

export async function openDvForgeLabStore(): Promise<void> {
  await vscode.env.openExternal(vscode.Uri.parse(DVFORGELAB_STORE_URL));
}

export async function openDvForgeLabProducts(): Promise<void> {
  await vscode.env.openExternal(vscode.Uri.parse(DVFORGELAB_PRODUCTS_URL));
}

export async function promptForProAccelerationAccess(surface: string): Promise<boolean> {
  const scopedSurface = surface === "Snapshot Workspace"
    ? "Snapshot Workspace and Timeline Reconstruction"
    : surface;

  const message = [
    `DV Quick Run Pro is required for ${scopedSurface}.`,
    "Early Bird: $19/month, limited to the first 200 licenses.",
    "Foundational operational understanding remains available in Free. Pro unlocks accelerated workflows such as Cross-Environment Diff, Timeline Reconstruction, reports, replay, and Upsert Artifact export."
  ].join(" ");

  const choice = await vscode.window.showInformationMessage(
    message,
    { modal: false },
    "View Pricing",
    "Direct Purchase",
    "Maybe Later"
  );

  if (choice === "View Pricing") {
    await openDvQuickRunPricing();
  }

  if (choice === "Direct Purchase") {
    await openDvForgeLabStore();
  }

  return false;
}
