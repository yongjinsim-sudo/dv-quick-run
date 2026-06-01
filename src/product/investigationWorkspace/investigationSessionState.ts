import * as vscode from "vscode";
import type { ComparisonViewModel } from "../../core/comparison/index.js";

const INVESTIGATION_SESSION_STATE_KEY = "dvQuickRun.comparison.investigationSessionState.v1";
const MAX_INVESTIGATION_SESSION_STATES = 80;

export interface InvestigationSessionState {
  readonly activeMode?: string;
  readonly baselineExportedAt?: string;
  readonly reviewedSurfaces?: readonly string[];
  readonly verifiedItems?: readonly string[];
  readonly verificationStatusByItem?: Record<string, string>;
  readonly verificationNotesByItem?: Record<string, string>;
  readonly updatedAtIso?: string;
}

interface InvestigationSessionStateEntry {
  readonly comparisonKey: string;
  readonly state: InvestigationSessionState;
}

export function buildInvestigationSessionKey(model: ComparisonViewModel): string {
  const source = model.summary.sourceLabel || "source";
  const target = model.summary.targetLabel || "target";
  const subject = model.summary.subjectLabel || model.title;
  const sourceCaptured = model.summary.sourceCapturedAtIso ?? "";
  const targetCaptured = model.summary.targetCapturedAtIso ?? "";
  return [model.title, subject, source, target, sourceCaptured, targetCaptured].join("|");
}

export function readInvestigationSessionState(
  context: vscode.ExtensionContext,
  comparisonKey: string
): InvestigationSessionState {
  const entries = context.globalState.get<readonly InvestigationSessionStateEntry[]>(INVESTIGATION_SESSION_STATE_KEY, []);
  return entries.find((entry) => entry.comparisonKey === comparisonKey)?.state ?? {};
}

export async function clearInvestigationSessionState(
  context: vscode.ExtensionContext,
  comparisonKey: string
): Promise<void> {
  const entries = context.globalState.get<readonly InvestigationSessionStateEntry[]>(INVESTIGATION_SESSION_STATE_KEY, []);
  const next = entries.filter((entry) => entry.comparisonKey !== comparisonKey);
  await context.globalState.update(INVESTIGATION_SESSION_STATE_KEY, next);
}

export async function writeInvestigationSessionState(
  context: vscode.ExtensionContext,
  comparisonKey: string,
  state: InvestigationSessionState
): Promise<void> {
  const entries = context.globalState.get<readonly InvestigationSessionStateEntry[]>(INVESTIGATION_SESSION_STATE_KEY, []);
  const nextState: InvestigationSessionState = {
    activeMode: state.activeMode,
    baselineExportedAt: state.baselineExportedAt,
    reviewedSurfaces: Array.isArray(state.reviewedSurfaces) ? [...state.reviewedSurfaces] : [],
    verifiedItems: Array.isArray(state.verifiedItems) ? [...state.verifiedItems] : [],
    verificationStatusByItem: state.verificationStatusByItem && typeof state.verificationStatusByItem === "object" ? { ...state.verificationStatusByItem } : {},
    verificationNotesByItem: state.verificationNotesByItem && typeof state.verificationNotesByItem === "object" ? { ...state.verificationNotesByItem } : {},
    updatedAtIso: new Date().toISOString()
  };

  const withoutCurrent = entries.filter((entry) => entry.comparisonKey !== comparisonKey);
  const next = [{ comparisonKey, state: nextState }, ...withoutCurrent].slice(0, MAX_INVESTIGATION_SESSION_STATES);
  await context.globalState.update(INVESTIGATION_SESSION_STATE_KEY, next);
}
