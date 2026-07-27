import * as vscode from "vscode";
import { getCurrentProductPlan } from "../product/capabilities/capabilityResolver.js";
import type { EnvironmentContext } from "../services/environmentContext.js";

const providerId = "dvQuickRun.localMcp";
const workspaceEnabledKey = "dvQuickRun.localMcp.enabled";
const serverLabel = "DV Quick Run";

export interface LocalMcpStatus {
  enabled: boolean;
  registrationState: "registered" | "disabled";
  toolCount: number;
  environmentName?: string;
  environmentUrl?: string;
  mode: "Free" | "Pro";
}

export class LocalMcpLifecycle implements vscode.Disposable {
  private readonly changed = new vscode.EventEmitter<void>();
  private readonly statusBarItem: vscode.StatusBarItem;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly envContext: EnvironmentContext
  ) {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 90);
    this.statusBarItem.command = "dvQuickRun.showLocalMcpServerStatus";
    this.statusBarItem.name = "DV Quick Run Local MCP";
    this.disposables.push(this.statusBarItem, this.changed);
  }

  register(): void {
    this.disposables.push(
      vscode.lm.registerMcpServerDefinitionProvider(providerId, {
        onDidChangeMcpServerDefinitions: this.changed.event,
        provideMcpServerDefinitions: () => this.provideDefinitions(),
        resolveMcpServerDefinition: (server) => this.resolveDefinition(server)
      }),
      vscode.commands.registerCommand("dvQuickRun.enableLocalMcpServer", () => this.enable()),
      vscode.commands.registerCommand("dvQuickRun.disableLocalMcpServer", () => this.disable()),
      vscode.commands.registerCommand("dvQuickRun.showLocalMcpServerStatus", () => this.showStatus()),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("dvQuickRun.environments")) {
          this.refresh();
        }
      })
    );

    this.refresh();
  }

  dispose(): void {
    for (const disposable of this.disposables.splice(0)) {
      disposable.dispose();
    }
  }

  getStatus(): LocalMcpStatus {
    const environment = this.envContext.getActiveEnvironment();
    return {
      enabled: this.isEnabled(),
      registrationState: this.isEnabled() ? "registered" : "disabled",
      toolCount: 9,
      environmentName: environment?.name,
      environmentUrl: environment?.url,
      mode: getCurrentProductPlan() === "pro" ? "Pro" : "Free"
    };
  }

  refresh(): void {
    this.changed.fire();
    const status = this.getStatus();
    if (!status.enabled) {
      this.statusBarItem.hide();
      return;
    }

    this.statusBarItem.text = "$(plug) DVQR MCP";
    this.statusBarItem.tooltip = `DV Quick Run Local MCP enabled for this workspace\nEnvironment: ${status.environmentName ?? "Not selected"}\nMode: ${status.mode}\nVS Code starts the server on demand.`;
    this.statusBarItem.show();
  }

  private isEnabled(): boolean {
    return this.context.workspaceState.get<boolean>(workspaceEnabledKey, false);
  }

  private provideDefinitions(): vscode.McpServerDefinition[] {
    if (!this.isEnabled()) {
      return [];
    }

    const script = vscode.Uri.joinPath(this.context.extensionUri, "out", "mcp", "dvqrMcpStdioServer.js");
    const definition = new vscode.McpStdioServerDefinition(
      serverLabel,
      process.execPath,
      [script.fsPath],
      {
        ELECTRON_RUN_AS_NODE: "1"
      },
      this.context.extension.packageJSON.version as string
    );
    definition.cwd = this.context.extensionUri;
    return [definition];
  }

  private async resolveDefinition(server: vscode.McpServerDefinition): Promise<vscode.McpServerDefinition | undefined> {
    if (!this.isEnabled()) {
      return undefined;
    }

    if (!(server instanceof vscode.McpStdioServerDefinition)) {
      return server;
    }

    const environment = this.envContext.getActiveEnvironment();
    if (!environment) {
      const selection = await vscode.window.showWarningMessage(
        "DV Quick Run Local MCP needs an active Dataverse environment.",
        "Select Environment"
      );
      if (selection === "Select Environment") {
        await vscode.commands.executeCommand("dvQuickRun.selectEnvironment");
      }
    }

    const resolvedEnvironment = this.envContext.getActiveEnvironment();
    if (!resolvedEnvironment) {
      return undefined;
    }

    server.cwd = this.context.extensionUri;
    server.env = {
      ...server.env,
      ELECTRON_RUN_AS_NODE: "1",
      DVQR_MCP_ENVIRONMENT_URL: resolvedEnvironment.url,
      DVQR_MCP_PRO_ENABLED: getCurrentProductPlan() === "pro" ? "true" : "false"
    };
    return server;
  }

  private async enable(): Promise<void> {
    if (this.isEnabled()) {
      await this.showStatus();
      return;
    }

    let environment = this.envContext.getActiveEnvironment();
    if (!environment) {
      const selection = await vscode.window.showInformationMessage(
        "Select a Dataverse environment before enabling DV Quick Run Local MCP.",
        "Select Environment",
        "Cancel"
      );
      if (selection !== "Select Environment") {
        return;
      }
      await vscode.commands.executeCommand("dvQuickRun.selectEnvironment");
      environment = this.envContext.getActiveEnvironment();
      if (!environment) {
        return;
      }
    }

    const confirmation = await vscode.window.showInformationMessage(
      `Enable DV Quick Run Local MCP for this workspace?\n\nEnvironment: ${environment.name}\nMode: ${getCurrentProductPlan() === "pro" ? "Pro" : "Free"}`,
      { modal: true },
      "Enable"
    );
    if (confirmation !== "Enable") {
      return;
    }

    await this.context.workspaceState.update(workspaceEnabledKey, true);
    this.refresh();
    void vscode.window.showInformationMessage(
      "DV Quick Run Local MCP is enabled for this workspace. VS Code will start it automatically when its tools are discovered or used."
    );
  }

  private async disable(): Promise<void> {
    if (!this.isEnabled()) {
      void vscode.window.showInformationMessage("DV Quick Run Local MCP is already disabled for this workspace.");
      return;
    }

    const confirmation = await vscode.window.showWarningMessage(
      "Disable DV Quick Run Local MCP for this workspace?",
      { modal: true },
      "Disable"
    );
    if (confirmation !== "Disable") {
      return;
    }

    await this.context.workspaceState.update(workspaceEnabledKey, false);
    this.refresh();
    void vscode.window.showInformationMessage(
      "DV Quick Run Local MCP is disabled. Any running instance is owned by VS Code and will stop when no longer needed or when VS Code closes."
    );
  }

  private async showStatus(): Promise<void> {
    const status = this.getStatus();
    const detail = status.enabled
      ? `Enabled for this workspace\nEnvironment: ${status.environmentName ?? "Not selected"}\nMode: ${status.mode}\nLifecycle: VS Code-managed and started on demand`
      : "Disabled for this workspace";

    const action = await vscode.window.showInformationMessage(
      `DV Quick Run Local MCP\n\n${detail}`,
      status.enabled ? "Disable" : "Enable"
    );

    if (action === "Enable") {
      await this.enable();
    } else if (action === "Disable") {
      await this.disable();
    }
  }
}

let activeLocalMcpLifecycle: LocalMcpLifecycle | undefined;

export function getLocalMcpStatusSnapshot(): LocalMcpStatus {
  return activeLocalMcpLifecycle?.getStatus() ?? {
    enabled: false,
    registrationState: "disabled",
    toolCount: 9,
    mode: getCurrentProductPlan() === "pro" ? "Pro" : "Free"
  };
}

export function registerLocalMcpLifecycle(
  context: vscode.ExtensionContext,
  envContext: EnvironmentContext
): LocalMcpLifecycle {
  const lifecycle = new LocalMcpLifecycle(context, envContext);
  lifecycle.register();
  activeLocalMcpLifecycle = lifecycle;
  context.subscriptions.push(lifecycle, { dispose: () => { if (activeLocalMcpLifecycle === lifecycle) activeLocalMcpLifecycle = undefined; } });
  return lifecycle;
}
