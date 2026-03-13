import * as assert from "assert";
import * as vscode from "vscode";
import { EnvironmentContext, type EnvironmentProfile } from "../../services/environmentContext.js";

type FakeWorkspaceState = {
  values: Record<string, unknown>;
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): Promise<void>;
};

function makeWorkspaceState(seed: Record<string, unknown> = {}): FakeWorkspaceState {
  return {
    values: { ...seed },
    get<T>(key: string): T | undefined {
      return this.values[key] as T | undefined;
    },
    async update(key: string, value: unknown): Promise<void> {
      this.values[key] = value;
    }
  };
}

suite("environmentContext", () => {
  const originalGetConfiguration = vscode.workspace.getConfiguration;
  const originalShowWarningMessage = vscode.window.showWarningMessage;
  const originalShowInformationMessage = vscode.window.showInformationMessage;

  teardown(() => {
    (vscode.workspace as any).getConfiguration = originalGetConfiguration;
    (vscode.window as any).showWarningMessage = originalShowWarningMessage;
    (vscode.window as any).showInformationMessage = originalShowInformationMessage;
  });

  test("initialize restores saved active environment when present", async () => {
    const environments: EnvironmentProfile[] = [
      { name: "DEV", url: "https://dev.crm.dynamics.com" },
      { name: "UAT", url: "https://uat.crm.dynamics.com" }
    ];

    (vscode.workspace as any).getConfiguration = () => ({
      get: (key: string) => key === "environments" ? environments : undefined
    });
    (vscode.window as any).showInformationMessage = async () => undefined;

    const workspaceState = makeWorkspaceState({
      "dvQuickRun.activeEnvironment": "UAT"
    });

    const ctx = new EnvironmentContext({ workspaceState } as any);
    await ctx.initialize();

    assert.strictEqual(ctx.getActiveEnvironment()?.name, "UAT");
    assert.strictEqual(ctx.getEnvironmentName(), "UAT");
    assert.strictEqual(ctx.getBaseUrl(), "https://uat.crm.dynamics.com/api/data/v9.2");
    assert.strictEqual(ctx.getScope(), "https://uat.crm.dynamics.com/.default");
  });

  test("initialize falls back to first configured environment when saved one is missing", async () => {
    const environments: EnvironmentProfile[] = [
      { name: "DEV", url: "https://dev.crm.dynamics.com" },
      { name: "UAT", url: "https://uat.crm.dynamics.com" }
    ];
    const warnings: string[] = [];

    (vscode.workspace as any).getConfiguration = () => ({
      get: (key: string) => key === "environments" ? environments : undefined
    });
    (vscode.window as any).showInformationMessage = async () => undefined;
    (vscode.window as any).showWarningMessage = async (message: string) => {
      warnings.push(message);
      return undefined;
    };

    const workspaceState = makeWorkspaceState({
      "dvQuickRun.activeEnvironment": "PROD"
    });

    const ctx = new EnvironmentContext({ workspaceState } as any);
    await ctx.initialize();

    assert.strictEqual(ctx.getActiveEnvironment()?.name, "DEV");
    assert.strictEqual(warnings.length, 1);
    assert.ok(warnings[0].includes("Saved environment 'PROD' was not found"));
  });

  test("setActiveEnvironment updates workspace state and runtime values", async () => {
    const workspaceState = makeWorkspaceState();
    const ctx = new EnvironmentContext({ workspaceState } as any);

    await ctx.setActiveEnvironment({
      name: "TEST",
      url: "https://test.crm.dynamics.com",
      statusBarColor: "amber"
    });

    assert.strictEqual(workspaceState.values["dvQuickRun.activeEnvironment"], "TEST");
    assert.strictEqual(ctx.getEnvironmentName(), "TEST");
    assert.strictEqual(ctx.getBaseUrl(), "https://test.crm.dynamics.com/api/data/v9.2");
    assert.strictEqual(ctx.getScope(), "https://test.crm.dynamics.com/.default");
  });

  test("getBaseUrl throws when no active environment is selected", () => {
    const ctx = new EnvironmentContext({ workspaceState: makeWorkspaceState() } as any);

    assert.throws(() => ctx.getBaseUrl(), /No active Dataverse environment selected/);
    assert.throws(() => ctx.getScope(), /No active Dataverse environment selected/);
  });
});
