import * as os from "os";
import * as vscode from "vscode";
import { formatEntitlementSupporterTag } from "../../product/capabilities/entitlementTypes.js";

async function refreshCommercialCapabilityContexts(): Promise<void> {
  const { canRunCrossEnvironmentDiff, shouldShowComparisonTeaser } = await import("../../product/capabilities/capabilityResolver.js");

  await vscode.commands.executeCommand("setContext", "dvQuickRun.crossEnvironmentDiffAvailable", canRunCrossEnvironmentDiff());
  await vscode.commands.executeCommand("setContext", "dvQuickRun.crossEnvironmentDiffTeaserAvailable", shouldShowComparisonTeaser());
}

function formatDate(value: string | null | undefined): string {
  if (value === undefined || value === null) {
    return "Not specified";
  }

  const parsed = Date.parse(value);

  return Number.isNaN(parsed) ? value : new Date(parsed).toISOString().slice(0, 10);
}

function formatEntitlementExpiry(source: string | undefined, expiresAt: string | null | undefined): string {
  if (source === "online" && expiresAt === null) {
    return "Subscription: Active";
  }

  return `Expires: ${formatDate(expiresAt)}`;
}

async function activateProLicenseCommand(context: vscode.ExtensionContext): Promise<void> {
  const licenseKey = await vscode.window.showInputBox({
    title: "Activate DVQR Pro",
    prompt: "Enter your DVQR Pro activation key.",
    ignoreFocusOut: true,
    password: true,
    validateInput: (value) => value.trim().length === 0 ? "DVQR Pro activation key is required." : undefined
  });

  if (licenseKey === undefined) {
    return;
  }

  const defaultInstanceName = `${os.hostname()} / VS Code`;
  const instanceName = await vscode.window.showInputBox({
    title: "Activate DVQR Pro",
    prompt: "Enter a device name for this activation.",
    value: defaultInstanceName,
    ignoreFocusOut: true,
    validateInput: (value) => value.trim().length === 0 ? "Device name is required." : undefined
  });

  if (instanceName === undefined) {
    return;
  }

  const { persistEntitlementCache } = await import("../../product/capabilities/entitlementResolver.js");
  const { LemonSqueezyLicenseClient } = await import("../../product/capabilities/onlineActivation/lemonSqueezyLicenseClient.js");
  const { resolveLemonSqueezyRuntimeConfig } = await import("../../product/capabilities/onlineActivation/lemonSqueezyRuntimeConfig.js");
  const { activateOnlinePro } = await import("../../product/capabilities/onlineActivation/onlineProActivationService.js");
  const { storeOnlineLicenseKey } = await import("../../product/capabilities/onlineActivation/onlineEntitlementSecrets.js");
  const runtimeConfig = await resolveLemonSqueezyRuntimeConfig();
  const result = await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "Activating DVQR Pro...",
    cancellable: false
  }, async () => activateOnlinePro({
    licenseKey,
    instanceName,
    client: new LemonSqueezyLicenseClient({
      pathfinderVariantIds: runtimeConfig.pathfinderVariantIds
    }),
    persistCache: persistEntitlementCache
  }));

  await refreshCommercialCapabilityContexts();

  if (!result.activated) {
    await vscode.window.showWarningMessage(result.activation.message);
    return;
  }

  await storeOnlineLicenseKey(context.secrets, licenseKey);
  await vscode.window.showInformationMessage(
    result.cache?.supporterTags?.includes("Pathfinder") === true
      ? "DVQR Pro activated. DVQR Pathfinder • Early Supporter recognition is now active locally."
      : "DVQR Pro activated. Pro capabilities are now available locally."
  );
}

async function showLicenseStatusCommand(): Promise<void> {
  const { resolveEntitlement } = await import("../../product/capabilities/entitlementResolver.js");
  const entitlement = resolveEntitlement();
  const enabledCapabilities = entitlement.manifest?.grants
    .filter((grant) => grant.enabled)
    .map((grant) => grant.capabilityId)
    .join(", ") || "Free/default capabilities";
  const lines = [
    `DVQR License Status: ${entitlement.plan.toUpperCase()}`,
    `State: ${entitlement.status ?? "valid"}`,
    `Source: ${entitlement.source ?? "configuration"}`,
    formatEntitlementExpiry(entitlement.source, entitlement.expiresAt)
  ];

  if (entitlement.lastVerifiedAt !== undefined) {
    lines.push(`Last verified: ${formatDate(entitlement.lastVerifiedAt)}`);
  }
  if (entitlement.refreshDueAt !== undefined) {
    lines.push(`Refresh due: ${formatDate(entitlement.refreshDueAt)}`);
  }
  if (entitlement.graceExpiresAt !== undefined) {
    lines.push(`Grace until: ${formatDate(entitlement.graceExpiresAt)}`);
  }
  if (entitlement.supporterTags !== undefined && entitlement.supporterTags.length > 0) {
    lines.push(`Supporter: ${entitlement.supporterTags.map(formatEntitlementSupporterTag).join(", ")}`);
  }

  lines.push(`Capabilities: ${enabledCapabilities}`);

  await vscode.window.showInformationMessage(lines.join(" | "));
}

async function deactivateProLicenseCommand(context: vscode.ExtensionContext): Promise<void> {
  const { resolveEntitlement, clearEntitlementCache } = await import("../../product/capabilities/entitlementResolver.js");
  const entitlement = resolveEntitlement();

  if (entitlement.source !== "online") {
    const clearLocal = await vscode.window.showWarningMessage(
      "No Online Pro activation is currently active. Clear the local entitlement cache anyway?",
      { modal: true },
      "Clear Local Cache"
    );

    if (clearLocal === "Clear Local Cache") {
      const { clearOnlineLicenseKey } = await import("../../product/capabilities/onlineActivation/onlineEntitlementSecrets.js");
      await clearEntitlementCache();
      await clearOnlineLicenseKey(context.secrets);
      await refreshCommercialCapabilityContexts();
      await vscode.window.showInformationMessage("DVQR local entitlement cache cleared. DVQR has continued in Free mode.");
    }

    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    "Deactivate DVQR Pro on this machine?",
    { modal: true },
    "Deactivate"
  );

  if (confirm !== "Deactivate") {
    return;
  }

  const { readOnlineLicenseKey, clearOnlineLicenseKey } = await import("../../product/capabilities/onlineActivation/onlineEntitlementSecrets.js");
  const licenseKey = await readOnlineLicenseKey(context.secrets);

  if (licenseKey === undefined || entitlement.providerInstanceId === undefined) {
    await clearEntitlementCache();
    await clearOnlineLicenseKey(context.secrets);
    await refreshCommercialCapabilityContexts();
    await vscode.window.showInformationMessage("DVQR local Online Pro entitlement cleared. DVQR has continued in Free mode.");
    return;
  }

  const { LemonSqueezyLicenseClient } = await import("../../product/capabilities/onlineActivation/lemonSqueezyLicenseClient.js");
  const { resolveLemonSqueezyRuntimeConfig } = await import("../../product/capabilities/onlineActivation/lemonSqueezyRuntimeConfig.js");
  const runtimeConfig = await resolveLemonSqueezyRuntimeConfig();
  const result = await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "Deactivating DVQR Pro...",
    cancellable: false
  }, async () => new LemonSqueezyLicenseClient({
    pathfinderVariantIds: runtimeConfig.pathfinderVariantIds
  }).deactivateLicense(licenseKey, entitlement.providerInstanceId!));

  if (!result.deactivated) {
    const clearLocal = await vscode.window.showWarningMessage(
      `${result.message} Clear the local entitlement cache anyway?`,
      { modal: true },
      "Clear Local Cache"
    );

    if (clearLocal !== "Clear Local Cache") {
      return;
    }
  }

  await clearEntitlementCache();
  await clearOnlineLicenseKey(context.secrets);
  await refreshCommercialCapabilityContexts();
  await vscode.window.showInformationMessage(result.deactivated ? result.message : "DVQR local entitlement cache cleared. DVQR has continued in Free mode.");
}

export function registerOnlineProLicenseCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(vscode.commands.registerCommand("dvQuickRun.activateProLicense", async () => {
    await activateProLicenseCommand(context);
  }));
  context.subscriptions.push(vscode.commands.registerCommand("dvQuickRun.licenseStatus", showLicenseStatusCommand));
  context.subscriptions.push(vscode.commands.registerCommand("dvQuickRun.deactivateProLicense", async () => {
    await deactivateProLicenseCommand(context);
  }));
}
