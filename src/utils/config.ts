import * as vscode from "vscode";

export function getTenantId(): string | undefined {
  const cfg = vscode.workspace.getConfiguration("dvQuickRun");
  const tid = (cfg.get<string>("tenantId") || "").trim();
  return tid || undefined;
}

export async function getBaseUrl(): Promise<string> {

    const config = vscode.workspace.getConfiguration("dvQuickRun");
    let baseUrl = config.get<string>("baseUrl");

    if (!baseUrl) {

        baseUrl = await vscode.window.showInputBox({
            prompt: "Enter Dataverse Web API base URL",
            placeHolder: "https://org7013c734.api.crm6.dynamics.com/api/data/v9.2"
        });

        if (!baseUrl) {
            throw new Error("Base URL required");
        }

        await config.update(
            "baseUrl",
            baseUrl,
            vscode.ConfigurationTarget.Global
        );
    }

    return baseUrl;
}