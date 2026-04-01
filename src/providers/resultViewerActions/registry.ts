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
    guid: context.guid
  });

  if (!analysis.hasUsableValue) {
    return [];
  }

  const payload = {
    guid: context.guid,
    entitySetName: context.entitySetName,
    entityLogicalName: context.entityLogicalName,
    columnName,
    rawValue
  };

  const actions: ResultViewerResolvedAction[] = [];

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
  }

  actions.push(
    {
      id: "copy-odata-filter",
      title: "Copy OData filter",
      icon: "ƒ",
      placement: "overflow",
      group: "query",
      payload
    },
    {
      id: "copy-fetchxml-condition",
      title: "Copy FetchXML condition",
      icon: "⟪⟫",
      placement: "overflow",
      group: "query",
      payload
    }
  );

  return actions;
}

export async function executeResultViewerAction(
  ctx: CommandContext,
  actionId: string,
  payload: ResultViewerActionPayload
): Promise<void> {
    const guid = String(payload.guid ?? "").trim();
    const entitySetName = payload.entitySetName?.trim();
    const columnName = String(payload.columnName ?? "").trim();
    const rawValue = String(payload.rawValue ?? "").trim();

    switch (actionId) {

        case "investigate-record": {
            if (!guid) {
                return;
            }

            const input = entitySetName
                ? `${entitySetName}(${guid})`
                : guid;

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
            if (!guid) {
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
            if (!guid) {
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

        case "copy-odata-filter": {
            if (!columnName || !rawValue) {
                return;
            }

            const filter = buildODataFilter(columnName, rawValue);
            await vscode.env.clipboard.writeText(filter);
            void vscode.window.showInformationMessage("DV Quick Run: OData filter copied.");
            return;
        }

        case "copy-fetchxml-condition": {
            if (!columnName || !rawValue) {
                return;
            }

            const condition = buildFetchXmlCondition(columnName, rawValue);
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

function buildODataFilter(columnName: string, rawValue: string): string {
    return `${columnName} eq ${formatODataValue(rawValue)}`;
}

function buildFetchXmlCondition(columnName: string, rawValue: string): string {
    return `<condition attribute="${escapeXmlAttribute(columnName)}" operator="eq" value="${escapeXmlAttribute(rawValue)}" />`;
}

function formatODataValue(rawValue: string): string {
    const value = rawValue.trim();

    if (!value) {
        return "''";
    }

    if (isGuidValue(value)) {
        return value;
    }

    if (/^-?\d+(\.\d+)?$/.test(value)) {
        return value;
    }

    const lowered = value.toLowerCase();
    if (lowered === "true" || lowered === "false") {
        return lowered;
    }

    return `'${value.replace(/'/g, "''")}'`;
}

function escapeXmlAttribute(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/'/g, "&apos;");
}
