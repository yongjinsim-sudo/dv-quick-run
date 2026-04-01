import * as vscode from "vscode";
import type { TraversalExplainVerbosity } from "../shared/traversal/traversalTypes.js";

export function getTraversalExplainVerbosity(): TraversalExplainVerbosity {
  const value = vscode.workspace
    .getConfiguration("dvQuickRun")
    .get<string>("traversal.explainVerbosity", "verbose");

  switch (String(value ?? "verbose").toLowerCase()) {
    case "off":
      return "off";
    case "minimal":
      return "minimal";
    case "verbose":
    default:
      return "verbose";
  }
}
