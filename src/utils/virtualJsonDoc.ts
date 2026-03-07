import * as vscode from "vscode";

const SCHEME = "dvqr";

class VirtualJsonProvider implements vscode.TextDocumentContentProvider {
  private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  public readonly onDidChange = this._onDidChange.event;

  private readonly _docs = new Map<string, string>();

  set(uri: vscode.Uri, content: string) {
    this._docs.set(uri.toString(), content);
    this._onDidChange.fire(uri);
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this._docs.get(uri.toString()) ?? "";
  }
}

let provider: VirtualJsonProvider | undefined;

export function registerVirtualJsonProvider(context: vscode.ExtensionContext) {
  provider = new VirtualJsonProvider();
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(SCHEME, provider)
  );
}

function safeSegment(name: string): string {
  // Remove characters that look ugly / unsafe in filenames/titles
  return name
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safePath(input: string): string {
  // Allow virtual "folders" by sanitizing each segment
  // e.g. ".dvqr/contact/attributes.json"
  const trimmed = input.trim().replace(/^\/+/, ""); // no leading slashes
  const parts = trimmed.split("/").filter(Boolean);
  const safeParts = parts.map(safeSegment).filter(Boolean);
  return safeParts.join("/");
}

export async function showJsonNamed(titleOrPath: string, data: unknown): Promise<void> {
  if (!provider) {
    throw new Error(
      "Virtual JSON provider not registered. Call registerVirtualJsonProvider() in activate()."
    );
  }

  const pretty = JSON.stringify(data, null, 2);

  // If caller passes a path (with /), preserve it. Otherwise behave as before.
  const p = safePath(titleOrPath);

  // Add .json extension only if missing
  const finalPath = p.toLowerCase().endsWith(".json") ? p : `${p}.json`;

  const uri = vscode.Uri.parse(`${SCHEME}:/${finalPath}`);

  const existing = vscode.workspace.textDocuments.find(
    d => d.uri.toString() === uri.toString()
  );

  if (existing) {
    provider.set(uri, pretty); // refresh content
    const editor = await vscode.window.showTextDocument(existing, { preview: false });
    await collapseValueArray(editor);
    return;
  }

  provider.set(uri, pretty);

  const doc = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(doc, { preview: false });

  await collapseValueArray(editor);
}

async function collapseValueArray(editor: vscode.TextEditor): Promise<void> {
  const doc = editor.document;

  // Find the line containing:  "value": [
  let valueLine = -1;
  for (let i = 0; i < doc.lineCount; i++) {
    const text = doc.lineAt(i).text;
    if (text.includes('"value"') && text.includes("[")) {
      valueLine = i;
      break;
    }
  }

  if (valueLine < 0) {return;}

  // Ensure folding ranges are computed
  await vscode.commands.executeCommand("editor.foldAll");

  // Unfold everything first so we can fold just the target (more reliable)
  await vscode.commands.executeCommand("editor.unfoldAll");

  // Fold the region starting at the value line
  // This uses the built-in folding provider (JSON folding ranges)
  editor.selection = new vscode.Selection(valueLine, 0, valueLine, 0);
  await vscode.commands.executeCommand("editor.fold");
}