import * as vscode from "vscode";
import { EnvironmentContext, EnvironmentProfile } from "./environmentContext.js";

function normalizeEnvironmentUrl(input: string): string {
  return input
    .trim()
    .replace(/\/api\/data\/v9\.2\/?$/i, "")
    .replace(/\/+$/, "");
}

function isValidEnvironmentUrl(input: string): boolean {
  return /^https:\/\/[^/]+$/i.test(input.trim());
}

export async function runEnvironmentSetup(
  envContext: EnvironmentContext
): Promise<EnvironmentProfile | undefined> {
  const name = await vscode.window.showInputBox({
    prompt: "Enter environment name",
    placeHolder: "DEV",
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value.trim()) {
        return "Environment name is required.";
      }
      return undefined;
    }
  });

  if (!name) {
    return undefined;
  }

  const rawUrl = await vscode.window.showInputBox({
    prompt: "Enter Dataverse environment URL",
    placeHolder: "https://org.crm6.dynamics.com",
    ignoreFocusOut: true,
    validateInput: (value) => {
      const normalized = normalizeEnvironmentUrl(value);
      if (!value.trim()) {
        return "Environment URL is required.";
      }
      if (!isValidEnvironmentUrl(normalized)) {
        return "Enter a valid Dataverse URL like https://org.crm6.dynamics.com";
      }
      return undefined;
    }
  });

  if (!rawUrl) {
    return undefined;
  }

  const pickedColor = await vscode.window.showQuickPick(
    [
      {
        label: "White",
        description: "Default / low-risk environment",
        value: "white" as const
      },
      {
        label: "Amber",
        description: "Warning / shared test environment",
        value: "amber" as const
      },
      {
        label: "Red",
        description: "High-risk / production-like environment",
        value: "red" as const
      }
    ],
    {
      placeHolder: "Select status bar color for this environment",
      ignoreFocusOut: true
    }
  );

  if (!pickedColor) {
    return undefined;
  }

  const profile: EnvironmentProfile = {
    name: name.trim(),
    url: normalizeEnvironmentUrl(rawUrl),
    statusBarColor: pickedColor.value
  };

  const config = vscode.workspace.getConfiguration("dvQuickRun");
  const existing = config.get<EnvironmentProfile[]>("environments") ?? [];

  const updated = [
    ...existing.filter((e) => e.name.toLowerCase() !== profile.name.toLowerCase()),
    profile
  ];

  await config.update(
    "environments",
    updated,
    vscode.ConfigurationTarget.Global
  );

  await envContext.setActiveEnvironment(profile);

  vscode.window.showInformationMessage(
    `DV Quick Run: Environment '${profile.name}' configured and selected.`
  );

  return profile;
}