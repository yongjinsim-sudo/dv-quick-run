import * as vscode from "vscode";

const KEY = "dvQuickRun.queryHistory";
const MAX = 20;

export function getQueryHistory(context: vscode.ExtensionContext): string[] {
  return context.globalState.get<string[]>(KEY) ?? [];
}

export async function addQueryToHistory(
  context: vscode.ExtensionContext,
  query: string
): Promise<void> {
  const q = query.trim();
  if (!q) {return;}

  const history = getQueryHistory(context);
  const updated = [q, ...history.filter((x) => x !== q)].slice(0, MAX);

  await context.globalState.update(KEY, updated);
}

export async function clearQueryHistory(context: vscode.ExtensionContext): Promise<void> {
  await context.globalState.update(KEY, []);
}