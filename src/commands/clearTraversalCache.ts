import * as vscode from 'vscode';
import { TraversalCacheService } from './router/actions/shared/traversal/traversalCacheService';

export function registerClearTraversalCacheCommand(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    'dvQuickRun.clearTraversalCache',
    () => {
      TraversalCacheService.clearAll();
      vscode.window.showInformationMessage('DV Quick Run: Traversal cache cleared');
    }
  );

  context.subscriptions.push(disposable);
}