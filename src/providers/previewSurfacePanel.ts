import * as vscode from "vscode";
import type {
  PreviewSurfaceActionKind,
  PreviewSurfaceModel,
  PreviewSurfaceResult
} from "../services/previewSurfaceTypes.js";
import { getPreviewSurfaceHtml } from "../webview/previewSurfaceHtml.js";

type PreviewSurfaceMessage = {
  type: "previewAction";
  previewId?: string;
  actionId?: string;
  actionKind?: PreviewSurfaceActionKind;
};

export class PreviewSurfacePanel {
  private static readonly viewType = "dvQuickRunPreviewSurface";
  private static currentPanel: vscode.WebviewPanel | undefined;
  private static currentPreviewId: string | undefined;
  private static pendingResolver: ((result: PreviewSurfaceResult) => void) | undefined;
  private static lastViewColumn: vscode.ViewColumn | undefined;
  private static hasFocusedOnce = false;

  public static show(
    model: PreviewSurfaceModel
  ): Promise<PreviewSurfaceResult> {
    if (PreviewSurfacePanel.pendingResolver && PreviewSurfacePanel.currentPreviewId) {
      PreviewSurfacePanel.pendingResolver({
        actionId: "cancel",
        actionKind: "cancel",
        previewId: PreviewSurfacePanel.currentPreviewId
      });
      PreviewSurfacePanel.pendingResolver = undefined;
    }

    PreviewSurfacePanel.currentPreviewId = model.previewId;

    if (!PreviewSurfacePanel.currentPanel) {
      const viewColumn = PreviewSurfacePanel.resolveCreateViewColumn();
      const createdPanel = vscode.window.createWebviewPanel(
        PreviewSurfacePanel.viewType,
        "DV Quick Run – Preview",
        viewColumn,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      createdPanel.webview.onDidReceiveMessage(async (message: PreviewSurfaceMessage) => {
        await PreviewSurfacePanel.handleMessage(message);
      });

      createdPanel.onDidChangeViewState((event: { webviewPanel: vscode.WebviewPanel }) => {
        PreviewSurfacePanel.lastViewColumn = event.webviewPanel.viewColumn;
      });

      createdPanel.onDidDispose(() => {
        const resolver = PreviewSurfacePanel.pendingResolver;
        const previewId = PreviewSurfacePanel.currentPreviewId ?? "";
        PreviewSurfacePanel.currentPanel = undefined;
        PreviewSurfacePanel.currentPreviewId = undefined;
        PreviewSurfacePanel.pendingResolver = undefined;
        PreviewSurfacePanel.hasFocusedOnce = false;

        resolver?.({
          actionId: "cancel",
          actionKind: "cancel",
          previewId
        });
      });

      PreviewSurfacePanel.currentPanel = createdPanel;
    }

    const panel = PreviewSurfacePanel.currentPanel;
    if (!panel) {
      throw new Error("DV Quick Run: Preview panel could not be created.");
    }
    panel.title = "DV Quick Run – Preview";
    panel.webview.html = getPreviewSurfaceHtml(panel.webview, model);

    const revealColumn = PreviewSurfacePanel.resolveRevealViewColumn(panel.viewColumn);

    if (!PreviewSurfacePanel.hasFocusedOnce) {
      panel.reveal(revealColumn, false);
      PreviewSurfacePanel.hasFocusedOnce = true;
    } else {
      panel.reveal(revealColumn, true);
    }

    return new Promise<PreviewSurfaceResult>((resolve) => {
      PreviewSurfacePanel.pendingResolver = resolve;
    });
  }


  public static update(model: PreviewSurfaceModel): void {
    PreviewSurfacePanel.currentPreviewId = model.previewId;

    if (!PreviewSurfacePanel.currentPanel) {
      const viewColumn = PreviewSurfacePanel.resolveCreateViewColumn();
      const createdPanel = vscode.window.createWebviewPanel(
        PreviewSurfacePanel.viewType,
        "DV Quick Run – Preview",
        viewColumn,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      createdPanel.webview.onDidReceiveMessage(async (message: PreviewSurfaceMessage) => {
        await PreviewSurfacePanel.handleMessage(message);
      });

      createdPanel.onDidChangeViewState((event: { webviewPanel: vscode.WebviewPanel }) => {
        PreviewSurfacePanel.lastViewColumn = event.webviewPanel.viewColumn;
      });

      createdPanel.onDidDispose(() => {
        const resolver = PreviewSurfacePanel.pendingResolver;
        const previewId = PreviewSurfacePanel.currentPreviewId ?? "";
        PreviewSurfacePanel.currentPanel = undefined;
        PreviewSurfacePanel.currentPreviewId = undefined;
        PreviewSurfacePanel.pendingResolver = undefined;
        PreviewSurfacePanel.hasFocusedOnce = false;

        resolver?.({
          actionId: "cancel",
          actionKind: "cancel",
          previewId
        });
      });

      PreviewSurfacePanel.currentPanel = createdPanel;
    }

    const panel = PreviewSurfacePanel.currentPanel;
    if (!panel) {
      throw new Error("DV Quick Run: Preview panel could not be created.");
    }

    panel.title = "DV Quick Run – Preview";
    panel.webview.html = getPreviewSurfaceHtml(panel.webview, model);

    const revealColumn = PreviewSurfacePanel.resolveRevealViewColumn(panel.viewColumn);
    panel.reveal(revealColumn, true);
  }

  public static getCurrentViewColumn(): vscode.ViewColumn | undefined {
    return PreviewSurfacePanel.currentPanel?.viewColumn;
  }

  private static resolveCreateViewColumn(): vscode.ViewColumn {
    const rightMost = PreviewSurfacePanel.getRightMostOpenViewColumn();
    if (rightMost === undefined) {
      return PreviewSurfacePanel.lastViewColumn ?? vscode.ViewColumn.Beside;
    }

    return PreviewSurfacePanel.toViewColumn(
      Math.min(rightMost + 1, vscode.ViewColumn.Nine)
    );
  }

  private static resolveRevealViewColumn(currentColumn: vscode.ViewColumn | undefined): vscode.ViewColumn | undefined {
    const rightMost = PreviewSurfacePanel.getRightMostOpenViewColumn();
    if (rightMost === undefined || currentColumn === undefined) {
      return currentColumn;
    }

    if (Number(currentColumn) >= rightMost) {
      return currentColumn;
    }

    return PreviewSurfacePanel.toViewColumn(rightMost);
  }

  private static getRightMostOpenViewColumn(): number | undefined {
    const columns = vscode.window.tabGroups.all
      .map((group) => group.viewColumn)
      .filter((column): column is vscode.ViewColumn => typeof column === "number");

    if (!columns.length) {
      return undefined;
    }

    return Math.max(...columns.map(Number));
  }

  private static toViewColumn(column: number): vscode.ViewColumn {
    return column as vscode.ViewColumn;
  }

  private static async handleMessage(message: PreviewSurfaceMessage): Promise<void> {
    if (message.type !== "previewAction") {
      return;
    }

    if (!message.previewId || message.previewId !== PreviewSurfacePanel.currentPreviewId) {
      void vscode.window.showWarningMessage("DV Quick Run: This preview is no longer current. Please review the latest preview.");
      return;
    }

    if (!message.actionId || !message.actionKind) {
      return;
    }

    const resolver = PreviewSurfacePanel.pendingResolver;
    PreviewSurfacePanel.pendingResolver = undefined;

    resolver?.({
      actionId: message.actionId,
      actionKind: message.actionKind,
      previewId: message.previewId
    });
  }
}
