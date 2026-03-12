import { EditorQueryTarget, getLogicalEditorQueryTarget } from "../../commands/router/actions/shared/queryMutation/editorQueryTarget.js";

export function resolveEditorQuery(): EditorQueryTarget {
  return getLogicalEditorQueryTarget();
}

export function resolveEditorQueryText(): string {
  return getLogicalEditorQueryTarget().text;
}