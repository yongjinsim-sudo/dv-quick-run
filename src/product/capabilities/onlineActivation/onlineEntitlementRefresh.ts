import * as vscode from "vscode";
import { canRunCrossEnvironmentDiff, shouldShowComparisonTeaser } from "../capabilityResolver.js";
import { persistEntitlementCache, resolveEntitlement } from "../entitlementResolver.js";
import { LemonSqueezyLicenseClient } from "./lemonSqueezyLicenseClient.js";
import { readOnlineLicenseKey } from "./onlineEntitlementSecrets.js";
import { resolveLemonSqueezyRuntimeConfig } from "./lemonSqueezyRuntimeConfig.js";
import { refreshOnlinePro } from "./onlineProActivationService.js";

async function refreshCommercialCapabilityContexts(): Promise<void> {
  await vscode.commands.executeCommand("setContext", "dvQuickRun.crossEnvironmentDiffAvailable", canRunCrossEnvironmentDiff());
  await vscode.commands.executeCommand("setContext", "dvQuickRun.crossEnvironmentDiffTeaserAvailable", shouldShowComparisonTeaser());
}

export function scheduleOnlineEntitlementRefresh(context: vscode.ExtensionContext): void {
  const timer = setTimeout(() => {
    void refreshOnlineEntitlementIfDue(context);
  }, 250);

  context.subscriptions.push({
    dispose: () => clearTimeout(timer)
  });
}

export async function refreshOnlineEntitlementIfDue(context: vscode.ExtensionContext, now: Date = new Date()): Promise<void> {
  const entitlement = resolveEntitlement(now);

  if (entitlement.source !== "online") {
    return;
  }

  if (entitlement.refreshDueAt !== undefined && Date.parse(entitlement.refreshDueAt) > now.getTime()) {
    return;
  }

  const licenseKey = await readOnlineLicenseKey(context.secrets);

  if (licenseKey === undefined) {
    return;
  }

  const runtimeConfig = await resolveLemonSqueezyRuntimeConfig();
  const result = await refreshOnlinePro({
    licenseKey,
    instanceId: entitlement.providerInstanceId,
    client: new LemonSqueezyLicenseClient({
      timeoutMs: 10_000,
      pathfinderVariantIds: runtimeConfig.pathfinderVariantIds
    }),
    persistCache: persistEntitlementCache,
    now
  });

  if (result.refreshed) {
    await refreshCommercialCapabilityContexts();
  }
}
