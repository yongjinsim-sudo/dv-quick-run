import * as vscode from "vscode";

async function refreshCommercialCapabilityContexts(): Promise<void> {
  const { canRunCrossEnvironmentDiff, shouldShowComparisonTeaser } = await import("../../product/capabilities/capabilityResolver.js");

  await vscode.commands.executeCommand("setContext", "dvQuickRun.crossEnvironmentDiffAvailable", canRunCrossEnvironmentDiff());
  await vscode.commands.executeCommand("setContext", "dvQuickRun.crossEnvironmentDiffTeaserAvailable", shouldShowComparisonTeaser());
}

async function importOfflineLicenseCommand(): Promise<void> {
  const selected = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: {
      "DVQR Offline License": ["json", "dvqr-license"]
    },
    openLabel: "Import Offline License"
  });

  const licenseUri = selected?.[0];

  if (licenseUri === undefined) {
    return;
  }

  const { persistEntitlementCache, resolveEntitlement } = await import("../../product/capabilities/entitlementResolver.js");
  const { importOfflineLicense } = await import("../../product/capabilities/offlineLicensing/offlineLicenseImportService.js");
  const content = Buffer.from(await vscode.workspace.fs.readFile(licenseUri)).toString("utf8");
  const result = await importOfflineLicense({
    raw: content,
    persistCache: persistEntitlementCache
  });

  await refreshCommercialCapabilityContexts();

  if (!result.imported) {
    await vscode.window.showWarningMessage(result.verification.message ?? "Offline license could not be imported. DVQR has continued in Free mode.");
    return;
  }

  const entitlement = resolveEntitlement();

  await vscode.window.showInformationMessage(
    `DVQR Offline Pro license imported. Resolved ${entitlement.plan.toUpperCase()} (${entitlement.status ?? "valid"}, ${entitlement.source ?? "offline"}).`
  );
}

export function registerImportOfflineLicenseCommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(vscode.commands.registerCommand("dvQuickRun.importOfflineLicense", importOfflineLicenseCommand));
}
