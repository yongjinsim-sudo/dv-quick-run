import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";

const SAMPLE_FETCHXML = `<fetch top="5">
  <entity name="account">
    <attribute name="name" />
    <attribute name="accountnumber" />
  </entity>
</fetch>`;

async function openSampleInEditor(content: string): Promise<void> {
  const document = await vscode.workspace.openTextDocument({
    content,
    language: "xml"
  });

  await vscode.window.showTextDocument(document, { preview: false });
}

export async function runTryFetchXmlSampleAction(
  ctx: CommandContext
): Promise<void> {
  await openSampleInEditor(SAMPLE_FETCHXML);

  const hasActiveEnvironment = !!ctx.envContext.getActiveEnvironment();

  if (!hasActiveEnvironment) {
    const choice = await vscode.window.showInformationMessage(
      "Try a FetchXML query in 1 click 👇 Set up an environment first.",
      "Set Up Environment"
    );

    if (choice === "Set Up Environment") {
      await vscode.commands.executeCommand("dvQuickRun.addEnvironment");
    }

    return;
  }

  const choice = await vscode.window.showInformationMessage(
    "Try a FetchXML query in 1 click 👇",
    "Run Query"
  );

  if (choice === "Run Query") {
    await vscode.commands.executeCommand("dvQuickRun.runQueryUnderCursor");
  }
}