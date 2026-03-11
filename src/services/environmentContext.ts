import * as vscode from "vscode";
import { runEnvironmentSetup } from "./environmentSetup.js";

export interface EnvironmentProfile {
  name: string;
  url: string;
  statusBarColor?: "white" | "amber" | "red";
}

  export class EnvironmentContext {

  private activeEnv: EnvironmentProfile | undefined;

  constructor(private extensionContext: vscode.ExtensionContext) {}

  getActiveEnvironment(): EnvironmentProfile | undefined {
    return this.activeEnv;
  }

  clearActiveEnvironment(): void {
    this.activeEnv = undefined;
  }

  async initialize(): Promise<void> {
  const saved = this.extensionContext.workspaceState.get<string>("dvQuickRun.activeEnvironment");
  const environments = this.getConfiguredEnvironments();

  if (!environments.length) {
    const choice = await vscode.window.showInformationMessage(
      "DV Quick Run: No environments configured yet.",
      "Set Up Environment",
      "Open Settings JSON",
      "Cancel"
    );

    if (choice === "Set Up Environment") {
      const created = await runEnvironmentSetup(this);
      if (created) {
        this.activeEnv = created;
      }
      return;
    }

    if (choice === "Open Settings JSON") {
      const sample = `"dvQuickRun.environments": [
      {
        "name": "DEV",
        "url": "https://org.crm6.dynamics.com"
      }
    ]`;

      await vscode.env.clipboard.writeText(sample);
      await vscode.commands.executeCommand("workbench.action.openSettingsJson");

      vscode.window.showInformationMessage(
        "DV Quick Run: A sample environment configuration has been copied to your clipboard. Paste it into settings.json."
      );
      return;
    }

    return;
  }

  if (saved) {
    const match = environments.find((e) => e.name === saved);
    if (match) {
      this.activeEnv = match;
      return;
    }

    vscode.window.showWarningMessage(
      `DV Quick Run: Saved environment '${saved}' was not found. Falling back to '${environments[0].name}'.`
    );
  }

  this.activeEnv = environments[0];
}

  async setActiveEnvironment(env: EnvironmentProfile) {

    this.activeEnv = env;

    await this.extensionContext.workspaceState.update(
      "dvQuickRun.activeEnvironment",
      env.name
    );
  }

  getBaseUrl(): string {

    if (!this.activeEnv) {
      throw new Error("No active Dataverse environment selected");
    }

    return `${this.activeEnv.url}/api/data/v9.2`;
  }

  getScope(): string {

    if (!this.activeEnv) {
      throw new Error("No active Dataverse environment selected");
    }

    return `${this.activeEnv.url}/.default`;
  }

  getEnvironmentName(): string {
    return this.activeEnv?.name ?? "Unknown";
  }

  getConfiguredEnvironments(): EnvironmentProfile[] {

    const config = vscode.workspace.getConfiguration("dvQuickRun");

    return config.get<EnvironmentProfile[]>("environments") ?? [];
  }
}