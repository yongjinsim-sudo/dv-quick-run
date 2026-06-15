import * as vscode from "vscode";
import { previewAndApplyReplaceFilterValueAtLine } from "../refinement/filterValueReplacement.js";
import { canRunCrossEnvironmentDiff, shouldShowComparisonTeaser } from "../product/capabilities/capabilityResolver.js";
import { getDefaultEnabledCapabilityIds } from "../product/capabilities/capabilityRegistry.js";
import { createCapabilityManifest } from "../product/capabilities/capabilityManifest.js";
import { formatEntitlementSupporterTag } from "../product/capabilities/entitlementTypes.js";
import { clearEntitlementCache, persistEntitlementCache, resolveEntitlement } from "../product/capabilities/entitlementResolver.js";
import { createStoredEntitlementCache, entitlementCacheKey, entitlementCacheSchemaVersion } from "../product/capabilities/entitlementCache.js";

async function runCommandAtLine(
  documentUri: vscode.Uri,
  lineNumber: number,
  command: string
): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(documentUri);
  const editor = await vscode.window.showTextDocument(doc, {
    preview: false,
    preserveFocus: false
  });

  const pos = new vscode.Position(lineNumber, 0);

  editor.selection = new vscode.Selection(pos, pos);
  editor.revealRange(
    new vscode.Range(pos, pos),
    vscode.TextEditorRevealType.InCenter
  );

  await vscode.commands.executeCommand(command);
}

async function refreshCommercialCapabilityContexts(): Promise<void> {
  await vscode.commands.executeCommand("setContext", "dvQuickRun.crossEnvironmentDiffAvailable", canRunCrossEnvironmentDiff());
  await vscode.commands.executeCommand("setContext", "dvQuickRun.crossEnvironmentDiffTeaserAvailable", shouldShowComparisonTeaser());
}

async function showSeededEntitlementMessage(label: string): Promise<void> {
  await refreshCommercialCapabilityContexts();
  const entitlement = resolveEntitlement();
  const plan = entitlement.plan;
  const status = entitlement.status ?? "valid";
  const source = entitlement.source ?? "configuration";

  void vscode.window.showInformationMessage(
    `DVQR entitlement seed applied: ${label}. Resolved ${plan.toUpperCase()} (${status}, ${source}). Reload the window before final verification.`
  );
}

async function seedValidProEntitlementForDev(): Promise<void> {
  const manifest = createCapabilityManifest(
    "pro",
    getDefaultEnabledCapabilityIds("pro"),
    "entitlement"
  );

  await persistEntitlementCache(createStoredEntitlementCache({
    plan: "pro",
    source: "manual",
    manifest,
    cachedAt: new Date(),
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    message: "Developer-seeded Pro entitlement for local v0.12.5 WS3 validation."
  }));

  await showSeededEntitlementMessage("Valid Pro");
}

async function seedExpiredProEntitlementForDev(): Promise<void> {
  const manifest = createCapabilityManifest(
    "pro",
    ["crossEnvironmentDiff", "comparisonReportExport", "investigationHandoffExport"],
    "entitlement"
  );

  await persistEntitlementCache(createStoredEntitlementCache({
    plan: "pro",
    source: "manual",
    manifest,
    cachedAt: new Date("2026-01-01T00:00:00.000Z"),
    expiresAt: new Date("2026-01-02T00:00:00.000Z"),
    message: "Developer-seeded expired Pro entitlement for local v0.12.5 WS3 validation."
  }));

  await showSeededEntitlementMessage("Expired Pro");
}

async function seedCorruptedEntitlementForDev(context: vscode.ExtensionContext): Promise<void> {
  await context.globalState.update(entitlementCacheKey, {
    schemaVersion: entitlementCacheSchemaVersion,
    plan: "pro",
    status: "valid",
    source: "manual",
    manifest: {
      edition: "pro",
      grants: "not-an-array"
    },
    cachedAt: "not-a-date",
    expiresAt: "not-a-date"
  });

  await showSeededEntitlementMessage("Corrupted cache");
}

async function seedUnknownEditionEntitlementForDev(context: vscode.ExtensionContext): Promise<void> {
  await context.globalState.update(entitlementCacheKey, {
    schemaVersion: entitlementCacheSchemaVersion,
    plan: "dev",
    status: "valid",
    source: "manual",
    manifest: {
      edition: "dev",
      grants: [
        {
          capabilityId: "crossEnvironmentDiff",
          enabled: true,
          source: "entitlement"
        }
      ]
    },
    cachedAt: new Date().toISOString(),
    expiresAt: "2099-01-01T00:00:00.000Z",
    message: "Developer-seeded unsupported dev entitlement. This must resolve as Free."
  });

  await showSeededEntitlementMessage("Unsupported dev edition");
}

async function clearEntitlementCacheForDev(): Promise<void> {
  await clearEntitlementCache();
  await showSeededEntitlementMessage("Cleared entitlement cache");
}

async function showEntitlementStateForDev(): Promise<void> {
  const entitlement = resolveEntitlement();
  const enabledCapabilities = entitlement.manifest?.grants
    .filter((grant) => grant.enabled)
    .map((grant) => grant.capabilityId)
    .join(", ") || "default manifest / none from cache";
  const supporter = entitlement.supporterTags !== undefined && entitlement.supporterTags.length > 0
    ? ` Supporter: ${entitlement.supporterTags.map(formatEntitlementSupporterTag).join(", ")}.`
    : "";

  await vscode.window.showInformationMessage(
    `DVQR entitlement state: ${entitlement.plan.toUpperCase()} (${entitlement.status ?? "valid"}, ${entitlement.source ?? "configuration"}).${supporter} Capabilities: ${enabledCapabilities}`
  );
}

export function registerInternalSupportCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "dvQuickRun.runQueryAtLine",
      async (documentUri: vscode.Uri, lineNumber: number) => {
        await runCommandAtLine(documentUri, lineNumber, "dvQuickRun.runQueryUnderCursor");
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "dvQuickRun.explainQueryAtLine",
      async (documentUri: vscode.Uri, lineNumber: number) => {
        await runCommandAtLine(documentUri, lineNumber, "dvQuickRun.explainQuery");
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "dvQuickRun.previewReplaceFilterValueAtLine",
      async (
        documentUri: vscode.Uri,
        lineNumber: number,
        fieldLogicalName: string,
        oldValue: string,
        newValue: string
      ) => {
        await previewAndApplyReplaceFilterValueAtLine({
          documentUri,
          lineNumber,
          fieldLogicalName,
          oldValue,
          newValue
        });
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("dvQuickRun.dev.seedValidProEntitlement", seedValidProEntitlementForDev)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("dvQuickRun.dev.seedExpiredProEntitlement", seedExpiredProEntitlementForDev)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("dvQuickRun.dev.seedCorruptedEntitlement", async () => {
      await seedCorruptedEntitlementForDev(context);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("dvQuickRun.dev.seedUnknownEditionEntitlement", async () => {
      await seedUnknownEditionEntitlementForDev(context);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("dvQuickRun.dev.clearEntitlementCache", clearEntitlementCacheForDev)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("dvQuickRun.dev.showEntitlementState", showEntitlementStateForDev)
  );
}
