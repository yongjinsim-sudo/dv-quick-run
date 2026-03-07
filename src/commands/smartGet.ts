import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

type SmartGetEntryAction = "smartGetEditLast" | "smartGetRerunLast" | "smartGet";

export function registerSmartGetCommand(ext: vscode.ExtensionContext, ctx: CommandContext) {
  const disposable = vscode.commands.registerCommand("dvQuickRun.smartGet", async () => {
    const picked = await vscode.window.showQuickPick(
      [
        {
          label: "Edit last query",
          description: "Resume and modify the most recent Smart GET query",
          action: "smartGetEditLast" as SmartGetEntryAction
        },
        {
          label: "Re-run last query",
          description: "Execute the most recent Smart GET query again",
          action: "smartGetRerunLast" as SmartGetEntryAction
        },
        {
          label: "Build new query",
          description: "Start a brand new Smart GET flow",
          action: "smartGet" as SmartGetEntryAction
        }
      ],
      {
        title: "DV Quick Run: Build Smart GET",
        placeHolder: "Choose how you want to continue",
        ignoreFocusOut: true
      }
    );

    if (!picked) {
      return;
    }

    await runDvQuickRunAction(picked.action, ctx);
  });

  ext.subscriptions.push(disposable);
}