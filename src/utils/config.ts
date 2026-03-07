import * as vscode from "vscode";

export function getTenantId(): string | undefined {
    const cfg = vscode.workspace.getConfiguration("dvQuickRun");
    const tid = (cfg.get<string>("tenantId") || "").trim();
    return tid || undefined;
}

export async function ensureBaseUrl(): Promise<string> {

    const config = vscode.workspace.getConfiguration("dvQuickRun");
    let baseUrl = (config.get<string>("baseUrl") || "").trim();

    if (baseUrl.length > 0) {
        return baseUrl;
    }

    const input = await vscode.window.showInputBox({
        prompt: "Enter Dataverse Web API base URL",
        placeHolder: "https://yourorg.crm6.dynamics.com/api/data/v9.2",
        ignoreFocusOut: true,
        validateInput: (value) => {
            if (!value.includes("/api/data")) {
                return "Must be a Dataverse Web API URL ending with /api/data/v9.x";
            }
            return null;
        }
    });

    if (!input) {
        throw new Error("DV Quick Run base URL is required.");
    }

    baseUrl = input.trim();

    await config.update(
        "baseUrl",
        baseUrl,
        vscode.ConfigurationTarget.Global
    );

    vscode.window.showInformationMessage("DV Quick Run configured successfully.");

    return baseUrl;
}