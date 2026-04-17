import * as vscode from "vscode";
import type { CommandContext } from "../../commands/context/commandContext.js";
import { buildDataverseRecordUiLink } from "../../commands/router/actions/investigateRecord/dataverseUiLinkBuilder.js";
import {
    findEntityByEntitySetName,
    loadEntityDefs
} from "../../commands/router/actions/shared/metadataAccess.js";
import type {
    ResultViewerActionContext,
    ResultViewerResolvedAction,
    ResultViewerActionPayload
} from "./types.js";
import {
    analyzeResultViewerColumn,
    isGuidValue
} from "./columnIntelligence.js";
import { runContinueTraversalAction } from "../../commands/router/actions/traversal/continueTraversalAction.js";
import { buildODataFilter, previewAndApplyODataFilter } from "./previewODataFilter.js";
import { previewAndApplyRootODataOrderBy } from "./previewODataOrderBy.js";
import {
  buildFetchXmlCondition as buildPreviewFetchXmlCondition,
  previewAndApplyFetchXmlCondition
} from "./previewFetchXmlCondition.js";
import { parseEditorQuery } from "../../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";

export function resolveResultViewerActions(
  context: ResultViewerActionContext
): ResultViewerResolvedAction[] {
  const rawValue = String(context.rawValue ?? "").trim();
  const columnName = String(context.columnName ?? "").trim();

  if (context.traversal) {
    const canContinue =
      context.traversal.hasNextLeg &&
      !context.traversal.isFinalLeg &&
      !!context.traversal.requiredCarryField &&
      columnName === context.traversal.requiredCarryField &&
      !!rawValue;

    if (!canContinue) {
      return [];
    }

    const nextTarget = context.traversal.nextLegEntityName?.trim();
    const carryField = context.traversal.requiredCarryField?.trim() || columnName;

    const continueTitle = nextTarget
        ? `Continue to ${nextTarget} using ${carryField}`
        : `Continue traversal using ${carryField}`;

    return [
      {
        id: "continue-traversal",
        title: continueTitle,
        icon: "➤",
        placement: "primary",
        group: "navigation",
        payload: {
          columnName,
          rawValue,
          traversalSessionId: context.traversal.traversalSessionId,
          traversalLegIndex: context.traversal.legIndex,
          carryField: columnName,
          carryValue: rawValue
        }
      }
    ];
  }

  const analysis = analyzeResultViewerColumn({
    columnName,
    rawValue,
    primaryIdField: context.primaryIdField,
    guid: context.guid,
    fieldLogicalName: context.fieldLogicalName,
    fieldAttributeType: context.fieldAttributeType
  });

  if (!analysis.hasUsableValue) {
    return [];
  }

  const payload = {
    guid: context.guid,
    entitySetName: context.entitySetName,
    entityLogicalName: context.entityLogicalName,
    primaryIdField: context.primaryIdField,
    fieldLogicalName: context.fieldLogicalName,
    fieldAttributeType: context.fieldAttributeType,
    columnName,
    rawValue
  };

  const actions: ResultViewerResolvedAction[] = [];
  const queryMode = context.queryMode ?? "odata";

  if (analysis.isPrimaryId) {
    actions.push(
      {
        id: "investigate-record",
        title: "Investigate record",
        icon: "🔎",
        placement: "primary",
        group: "inspection",
        payload
      },
      {
        id: "open-in-dataverse-ui",
        title: "Open in Dataverse UI",
        icon: "↗",
        placement: "primary",
        group: "inspection",
        payload
      },
      {
        id: "copy-record-url",
        title: "Copy record URL",
        icon: "🔗",
        placement: "overflow",
        group: "inspection",
        payload
      }
    );
  } else if (analysis.isBusinessGuid || analysis.isBusinessIdentifier) {
    actions.push({
      id: "investigate-record",
      title: "Investigate related record",
      icon: "🔎",
      placement: "primary",
      group: "inspection",
      payload: {
        ...payload,
        guid: analysis.isBusinessGuid ? rawValue : undefined
      }
    });
  }

  const isSafePreviewFilterColumn = !columnName.includes(".");

  if (isSafePreviewFilterColumn) {
    if (queryMode === "fetchxml") {
      actions.push({
        id: "preview-fetchxml-condition",
        title: "Filter by this value (FetchXML)",
        icon: "⟪⟫",
        placement: "overflow",
        group: "query",
        payload
      });
    } else {
      actions.push({
        id: "preview-odata-filter",
        title: "Filter by this value (OData)",
        icon: "ƒ",
        placement: "overflow",
        group: "query",
        payload
      });
    }
  } else if (queryMode === "fetchxml") {
    actions.push({
      id: "copy-fetchxml-condition",
      title: "Copy FetchXML condition",
      icon: "⟪⟫",
      placement: "overflow",
      group: "query",
      payload
    });
  }

  return actions;
}

export async function executeResultViewerAction(
  ctx: CommandContext,
  actionId: string,
  payload: ResultViewerActionPayload
): Promise<void> {
    console.log("[DVQR][registry] executeResultViewerAction", { actionId, payload });

    const guid = String(payload.guid ?? "").trim();
    const entitySetName = payload.entitySetName?.trim();
    const columnName = String(payload.columnName ?? "").trim();
    const rawValue = String(payload.rawValue ?? "").trim();

    switch (actionId) {

        case "investigate-record": {
            const canUseEntitySet = !!guid && !!entitySetName && columnName === String(payload.primaryIdField ?? "").trim();
            const input = canUseEntitySet
                ? `${entitySetName}(${guid})`
                : JSON.stringify({
                    __dvqrIdentifierResolution: true,
                    value: rawValue,
                    entityLogicalName: payload.entityLogicalName,
                    entitySetName: payload.entitySetName,
                    fieldLogicalName: payload.fieldLogicalName ?? columnName,
                    fieldAttributeType: payload.fieldAttributeType,
                    primaryIdField: payload.primaryIdField
                });

            await vscode.commands.executeCommand("dvQuickRun.investigateRecord", input);
            return;
        }

        case "continue-traversal": {
            await runContinueTraversalAction(ctx, {
                traversalSessionId: String(payload.traversalSessionId ?? "").trim(),
                legIndex: Number(payload.traversalLegIndex ?? 0),
                carryField: String(payload.carryField ?? "").trim(),
                carryValue: String(payload.carryValue ?? "").trim()
            });
            return;
        }

        case "open-in-dataverse-ui": {
            if (!guid || columnName !== String(payload.primaryIdField ?? "").trim()) {
                return;
            }

            const url = await buildRecordUiUrl(ctx, guid, entitySetName);
            if (!url) {
                return;
            }

            await vscode.env.openExternal(vscode.Uri.parse(url));
            return;
        }

        case "copy-record-url": {
            if (!guid || columnName !== String(payload.primaryIdField ?? "").trim()) {
                return;
            }

            const url = await buildRecordUiUrl(ctx, guid, entitySetName);
            if (!url) {
                return;
            }

            await vscode.env.clipboard.writeText(url);
            void vscode.window.showInformationMessage("DV Quick Run: Record URL copied.");
            return;
        }

        case "preview-odata-filter": {
            if (!columnName || !rawValue) {
                return;
            }

            try {
                await previewAndApplyODataFilter(columnName, rawValue);
            } catch (error) {
                const filter = buildODataFilter(columnName, rawValue);
                await vscode.env.clipboard.writeText(filter);
                const message = error instanceof Error ? error.message : String(error);
                void vscode.window.showWarningMessage(`DV Quick Run: ${message} Falling back to copied OData filter.`);
            }
            return;
        }


case "preview-root-odata-orderby": {
    if (!columnName) {
        return;
    }

    try {
        await previewAndApplyRootODataOrderBy(columnName, "asc");
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showWarningMessage(`DV Quick Run: ${message}`);
    }
    return;
}

        case "preview-fetchxml-condition": {
            if (!columnName || !rawValue) {
                return;
            }

            try {
                await previewAndApplyFetchXmlCondition(columnName, rawValue);
            } catch (error) {
                const condition = buildPreviewFetchXmlCondition(columnName, rawValue);
                await vscode.env.clipboard.writeText(condition);
                const message = error instanceof Error ? error.message : String(error);
                void vscode.window.showWarningMessage(`DV Quick Run: ${message} Falling back to copied FetchXML condition.`);
            }
            return;
        }

        case "copy-fetchxml-condition": {
            if (!columnName || !rawValue) {
                return;
            }

            const condition = buildPreviewFetchXmlCondition(columnName, rawValue);
            await vscode.env.clipboard.writeText(condition);
            void vscode.window.showInformationMessage("DV Quick Run: FetchXML condition copied.");
            return;
        }

        default:
            return;
    }
}

async function buildRecordUiUrl(
    ctx: CommandContext,
    guid: string,
    entitySetName?: string
): Promise<string | undefined> {
    if (!entitySetName?.trim()) {
        void vscode.window.showWarningMessage("DV Quick Run: Could not determine entity set for Dataverse UI link.");
        return undefined;
    }

    try {
        const token = await ctx.getToken(ctx.getScope());
        const client = ctx.getClient();
        const defs = await loadEntityDefs(ctx, client, token);
        const entityDef = findEntityByEntitySetName(defs, entitySetName);

        if (!entityDef?.logicalName) {
            throw new Error(`Could not resolve logical name for entity set '${entitySetName}'.`);
        }

        const baseUrl = await ctx.getBaseUrl();
        return buildDataverseRecordUiLink(baseUrl, entityDef.logicalName, guid);
    } catch (error) {
        const message = error instanceof Error
            ? error.message
            : String(error);

        void vscode.window.showErrorMessage(`DV Quick Run: Failed to resolve Dataverse UI link. ${message}`);
        return undefined;
    }
}


function buildFetchXmlCondition(columnName: string, rawValue: string): string {
    return `<condition attribute="${escapeXmlAttribute(columnName)}" operator="eq" value="${escapeXmlAttribute(rawValue)}" />`;
}


function escapeXmlAttribute(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/'/g, "&apos;");
}

function detectVisibleQueryMode(): "odata" | "fetchxml" | undefined {
  const editors = [
    vscode.window.activeTextEditor,
    ...vscode.window.visibleTextEditors.filter(
      (editor) => editor !== vscode.window.activeTextEditor
    )
  ].filter((editor): editor is vscode.TextEditor => !!editor);

  for (const editor of editors) {
    const text = getEditorCandidateText(editor);
    if (!text) {
      continue;
    }

    const trimmed = text.trim();
    if (!trimmed) {
      continue;
    }

    if (looksLikeFetchXmlText(trimmed)) {
      return "fetchxml";
    }

    try {
      const parsed = parseEditorQuery(trimmed);
      if (parsed.entityPath) {
        return "odata";
      }
    } catch {
      // ignore and continue
    }
  }

  return undefined;
}

function getEditorCandidateText(editor: vscode.TextEditor): string {
  const selectionText = editor.document.getText(editor.selection).trim();
  if (selectionText) {
    return selectionText;
  }

  const line = editor.document.lineAt(editor.selection.active.line).text.trim();
  if (line) {
    return line;
  }

  return editor.document.getText().trim();
}

function looksLikeFetchXmlText(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("<fetch") || trimmed.startsWith("<?xml");
}