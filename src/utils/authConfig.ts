import * as vscode from "vscode";

export function getTenantId(): string | undefined {
  const cfg = vscode.workspace.getConfiguration("dvQuickRun");
  const tid = (cfg.get<string>("tenantId") || "").trim();
  return tid || undefined;
}
