import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

type SmartPatchEntryAction = "smartPatchEditLast" | "smartPatchRerunLast" | "smartPatch";

export function registerSmartPatchCommand(ext: vscode.ExtensionContext, ctx: CommandContext) {
  const disposable = vscode.commands.registerCommand("dvQuickRun.smartPatch", async () => {
    const picked = await vscode.window.showQuickPick(
      [
        {
          label: "Edit last PATCH",
          description: "Resume and modify the most recent Smart PATCH request",
          action: "smartPatchEditLast" as SmartPatchEntryAction
        },
        {
          label: "Re-run last PATCH",
          description: "Execute the most recent Smart PATCH request again",
          action: "smartPatchRerunLast" as SmartPatchEntryAction
        },
        {
          label: "Build new PATCH",
          description: "Start a brand new Smart PATCH flow",
          action: "smartPatch" as SmartPatchEntryAction
        }
      ],
      {
        title: "DV Quick Run: Build Smart PATCH",
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