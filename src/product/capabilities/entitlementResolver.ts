import * as vscode from "vscode";
import type { EntitlementContext } from "./entitlementTypes.js";
import { normalizeEntitlementPlan } from "./entitlementTypes.js";

export function resolveEntitlement(): EntitlementContext {
  const configuredPlan = vscode.workspace
    .getConfiguration("dvQuickRun")
    .get<string>("productPlan", "dev");

  const normalizedPlan = normalizeEntitlementPlan(configuredPlan);

  return {
    plan: normalizedPlan
  };
}