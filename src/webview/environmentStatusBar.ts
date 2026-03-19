import * as vscode from "vscode";
import { EnvironmentContext } from "../services/environmentContext.js";

export class EnvironmentStatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor(
    private readonly envContext: EnvironmentContext
  ) {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.item.command = "dvQuickRun.selectEnvironment";
    this.item.tooltip = "DV Quick Run: Select active environment";
  }

  show(): void {
    this.refresh();
    this.item.show();
  }

  refresh(): void {
    const env = this.envContext.getActiveEnvironment();
    const envName = env?.name ?? "Unknown";
    const colorHint = env?.statusBarColor ?? "white";

    this.item.text = `$(database) DV: ${envName}`;
    this.item.tooltip =
      `DV Quick Run active environment: ${envName}\nClick to switch environment`;

    this.item.color = undefined;
    this.item.backgroundColor = undefined;

    if (colorHint === "red") {
      this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
    } else if (colorHint === "amber") {
      this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}