import * as vscode from "vscode";

import { DVFORGELAB_PRODUCTS_URL, DVQR_PRICING_URL } from "../../product/capabilities/commercialLinks.js";

export async function openDvQuickRunPricing(): Promise<void> {
  await vscode.env.openExternal(vscode.Uri.parse(DVQR_PRICING_URL));
}

export async function openDvForgeLabProducts(): Promise<void> {
  await vscode.env.openExternal(vscode.Uri.parse(DVFORGELAB_PRODUCTS_URL));
}

export async function promptForProAccelerationAccess(surface: string): Promise<boolean> {
  const message = [
    `DV Quick Run Pro is required for ${surface}.`,
    "Early Bird: $19/month, limited to the first 200 licenses.",
    "Foundational operational understanding remains available in Free. Pro unlocks accelerated workflows such as Cross-Environment Diff, reports, replay, and Upsert Artifact export."
  ].join(" ");

  const choice = await vscode.window.showInformationMessage(
    message,
    { modal: false },
    "View Pricing",
    "Maybe Later"
  );

  if (choice === "View Pricing") {
    await openDvQuickRunPricing();
  }

  return false;
}
