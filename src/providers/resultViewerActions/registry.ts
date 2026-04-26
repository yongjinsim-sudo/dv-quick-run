import * as vscode from "vscode";
import type { CommandContext } from "../../commands/context/commandContext.js";
import { buildDataverseRecordUiLink } from "../../commands/router/actions/investigateRecord/dataverseUiLinkBuilder.js";
import {
  findEntityByEntitySetName,
  loadEntityDefs
} from "../../commands/router/actions/shared/metadataAccess.js";
import type {
  ResultViewerActionContext,
  ResultViewerActionPayload,
  ResultViewerResolvedAction
} from "./types.js";
import type { SmartPatchRefreshSourceTarget } from "../../commands/router/actions/smartPatch/smartPatchTypes.js";
import { analyzeResultViewerColumn } from "./columnIntelligence.js";
import { runContinueTraversalAction } from "../../commands/router/actions/traversal/continueTraversalAction.js";
import { buildODataFilter, previewAndApplyODataFilter } from "./previewODataFilter.js";
import { previewAndApplyRootODataOrderBy } from "./previewODataOrderBy.js";
import {
  buildFetchXmlCondition as buildPreviewFetchXmlCondition,
  previewAndApplyFetchXmlCondition
} from "./previewFetchXmlCondition.js";
import { previewAndApplyAddSelectFromColumn } from "./previewAddSelectFromColumn.js";
import { previewAndApplyExpandRelationship } from "./previewExpandRelationship.js";
import { runSmartPatchPrefilledWorkflow } from "../../commands/router/actions/smartPatch/smartPatchWorkflows.js";
import {
  getSupportedSliceDefinitions,
  previewAndApplyFetchXmlSlice,
  previewAndApplyODataSlice,
  type ResultViewerSliceOperation
} from "./previewResultViewerSlice.js";


function isResultViewerPatchSupportedField(attributeType?: string): boolean {
  const type = String(attributeType ?? "").trim().toLowerCase();
  return type === "string" ||
    type === "boolean" ||
    type === "datetime" ||
    type === "integer" ||
    type === "bigint" ||
    type === "decimal" ||
    type === "double" ||
    type === "money" ||
    type === "picklist" ||
    type === "state" ||
    type === "status";
}

export function resolveResultViewerActions(
  context: ResultViewerActionContext
): ResultViewerResolvedAction[] {
  const rawValue = String(context.rawValue ?? "").trim();
  const columnName = String(context.columnName ?? "").trim();
  const isNullValue = context.isNullValue === true;

  if (context.traversal) {
    return resolveTraversalActions(context, columnName, rawValue);
  }

  const analysis = analyzeResultViewerColumn({
    columnName,
    rawValue,
    primaryIdField: context.primaryIdField,
    guid: context.guid,
    fieldLogicalName: context.fieldLogicalName,
    fieldAttributeType: context.fieldAttributeType
  });

  if (!analysis.hasUsableValue && !isNullValue) {
    return [];
  }

  const payload: ResultViewerActionPayload = {
    guid: context.guid,
    entitySetName: context.entitySetName,
    entityLogicalName: context.entityLogicalName,
    primaryIdField: context.primaryIdField,
    fieldLogicalName: context.fieldLogicalName,
    fieldAttributeType: context.fieldAttributeType,
    currentValue: rawValue,
    displayValue: context.displayValue,
    isNullValue,
    columnName,
    rawValue,
    sourceDocumentUri: context.sourceDocumentUri,
    sourceRangeStartLine: context.sourceRangeStartLine,
    sourceRangeStartCharacter: context.sourceRangeStartCharacter,
    sourceRangeEndLine: context.sourceRangeEndLine,
    sourceRangeEndCharacter: context.sourceRangeEndCharacter
  };

  const actions: ResultViewerResolvedAction[] = [];
  const queryMode = context.queryMode ?? "odata";
  const isRootColumn = !columnName.includes(".");
  const shouldExposeSliceActions =
    isRootColumn &&
    !analysis.isPrimaryId &&
    !analysis.isBusinessGuid &&
    !analysis.isBusinessIdentifier;

  const sliceDefinitions = shouldExposeSliceActions
    ? getSupportedSliceDefinitions(context.fieldAttributeType, rawValue)
    : [];

  if (analysis.isPrimaryId) {
    actions.push(
      createAction({
        id: "investigate-record",
        title: "Investigate record",
        icon: "🔎",
        placement: "primary",
        group: "investigate",
        kind: "execute",
        payload
      }),
      createAction({
        id: "open-in-dataverse-ui",
        title: "Open in Dataverse UI",
        icon: "↗",
        placement: "primary",
        group: "metadata",
        kind: "open",
        payload
      }),
      createAction({
        id: "copy-record-url",
        title: "Copy record URL",
        icon: "🔗",
        placement: "overflow",
        group: "copy",
        kind: "copy",
        payload
      }),
      createAction({
        id: "update-record",
        title: "Update this record",
        icon: "✎",
        placement: "overflow",
        group: "correct",
        kind: "execute",
        payload,
        isEnabled: !!payload.guid && !!payload.entitySetName && !!payload.entityLogicalName,
        disabledReason: (!!payload.guid && !!payload.entitySetName && !!payload.entityLogicalName)
          ? undefined
          : "Update this record requires entity, table, and record id context."
      })
    );
  } else if (analysis.isBusinessGuid || analysis.isBusinessIdentifier) {
    actions.push(
      createAction({
        id: "investigate-record",
        title: "Investigate related record",
        icon: "🔎",
        placement: "primary",
        group: "investigate",
        kind: "execute",
        payload: {
          ...payload,
          guid: analysis.isBusinessGuid ? rawValue : undefined
        }
      })
    );
  }

  if (queryMode === "fetchxml") {
    actions.push(
      createAction({
        id: "preview-add-select",
        title: "Add this column to $select",
        icon: "+",
        placement: "overflow",
        group: "refine",
        kind: "preview",
        payload,
        isEnabled: false,
        disabledReason: "Add to $select from Result Viewer is currently available for OData queries only."
      })
    );

    if (isRootColumn) {
      actions.push(
        createAction({
          id: "preview-fetchxml-condition",
          title: "Filter by this value",
          icon: "⟪⟫",
          placement: "overflow",
          group: "refine",
          kind: "preview",
          payload
        }),
        ...sliceDefinitions.map((definition) =>
          createAction({
            id: "preview-fetchxml-slice",
            title: definition.title,
            icon: "◫",
            placement: "overflow",
            group: "slice",
            kind: "preview",
            payload: {
              ...payload,
              sliceOperation: definition.operation
            }
          })
        )
      );
    } else {
      actions.push(
        createAction({
          id: "copy-fetchxml-condition",
          title: "Copy FetchXML condition",
          icon: "⟪⟫",
          placement: "overflow",
          group: "copy",
          kind: "copy",
          payload
        })
      );
    }

    actions.push(
      createAction({
        id: "preview-root-odata-orderby",
        title: "Sort by this column",
        icon: "⇅",
        placement: "overflow",
        group: "refine",
        kind: "preview",
        payload,
        isEnabled: false,
        disabledReason: "Root order by from Result Viewer is currently available for OData queries only."
      }),
      createAction({
        id: "copy-display-value",
        title: "Copy display value",
        icon: "📋",
        placement: "overflow",
        group: "copy",
        kind: "copy",
        payload
      }),
      createAction({
        id: "copy-raw-value",
        title: "Copy raw value",
        icon: "📋",
        placement: "overflow",
        group: "copy",
        kind: "copy",
        payload
      }),
      createAction({
        id: "copy-row-json",
        title: "Copy row JSON",
        icon: "{}",
        placement: "overflow",
        group: "copy",
        kind: "copy",
        payload
      })
    );

    return sortActions(actions.filter((action) => analysis.isPrimaryId || action.id !== "copy-row-json"));
  }

  actions.push(
    createAction({
      id: "preview-add-select",
      title: "Add this column to $select",
      icon: "+",
      placement: "overflow",
      group: "refine",
      kind: "preview",
      payload
    }),
    createAction({
      id: "preview-root-odata-orderby",
      title: "Sort by this column",
      icon: "⇅",
      placement: "overflow",
      group: "refine",
      kind: "preview",
      payload,
      isEnabled: isRootColumn,
      disabledReason: isRootColumn ? undefined : "Result Viewer sort preview currently supports root-level columns only."
    })
  );

  if (isRootColumn) {
    actions.push(
      createAction({
        id: "preview-odata-filter",
        title: "Filter by this value",
        icon: "ƒ",
        placement: "overflow",
        group: "refine",
        kind: "preview",
        payload
      }),
      ...sliceDefinitions.map((definition) =>
        createAction({
          id: "preview-odata-slice",
          title: definition.title,
          icon: "◫",
          placement: "overflow",
          group: "slice",
          kind: "preview",
          payload: {
            ...payload,
            sliceOperation: definition.operation
          }
        })
      )
    );

    const canUpdateField = !!payload.guid &&
      !!payload.entitySetName?.trim() &&
      !!payload.entityLogicalName?.trim() &&
      !!payload.fieldLogicalName?.trim() &&
      isResultViewerPatchSupportedField(payload.fieldAttributeType) &&
      !analysis.isPrimaryId &&
      !analysis.isLookupGuid &&
      !analysis.isBusinessGuid &&
      !analysis.isBusinessIdentifier;

    if (canUpdateField) {
      actions.push(
        createAction({
          id: "update-field",
          title: isNullValue ? "Set field value" : "Update this field",
          icon: "✎",
          placement: "overflow",
          group: "correct",
          kind: "execute",
          payload
        })
      );

      if (!isNullValue) {
        actions.push(
          createAction({
            id: "set-field-null",
            title: "Set this field to null",
            icon: "∅",
            placement: "overflow",
            group: "correct",
            kind: "execute",
            payload: {
              ...payload,
              isNullValue: true,
              rawValue: "",
              currentValue: ""
            }
          })
        );
      }
    }
  }

  if (!isRootColumn && !analysis.isPrimaryId) {
    actions.push(
      createAction({
        id: "update-field",
        title: "Update expanded field unavailable",
        icon: "✎",
        placement: "overflow",
        group: "correct",
        kind: "execute",
        payload,
        isEnabled: false,
        disabledReason: "Smart PATCH from expanded or flattened columns is not supported yet. Patch the root record or open the related record first."
      })
    );
  }

  actions.push(
    createAction({
      id: "copy-display-value",
      title: "Copy display value",
      icon: "📋",
      placement: "overflow",
      group: "copy",
      kind: "copy",
      payload
    }),
    createAction({
      id: "copy-raw-value",
      title: "Copy raw value",
      icon: "📋",
      placement: "overflow",
      group: "copy",
      kind: "copy",
      payload
    }),
    createAction({
      id: "copy-row-json",
      title: "Copy row JSON",
      icon: "{}",
      placement: "overflow",
      group: "copy",
      kind: "copy",
      payload
    })
  );

  return sortActions(actions.filter((action) => analysis.isPrimaryId || action.id !== "copy-row-json"));
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

    case "update-record": {
      if (!guid || !payload.entitySetName?.trim() || !payload.entityLogicalName?.trim()) {
        return;
      }

      await runSmartPatchPrefilledWorkflow(ctx, {
        entityLogicalName: payload.entityLogicalName.trim(),
        entitySetName: payload.entitySetName.trim(),
        id: guid,
        refreshSourceTarget: buildSmartPatchRefreshSourceTarget(payload)
      });
      return;
    }

    case "update-field":
    case "set-field-null": {
      const fieldLogicalName = String(payload.fieldLogicalName ?? columnName).trim();
      const fieldAttributeType = String(payload.fieldAttributeType ?? "").trim();
      if (!guid || !payload.entitySetName?.trim() || !payload.entityLogicalName?.trim() || !fieldLogicalName || !fieldAttributeType) {
        return;
      }

      const setNull = actionId === "set-field-null";
      await runSmartPatchPrefilledWorkflow(ctx, {
        entityLogicalName: payload.entityLogicalName.trim(),
        entitySetName: payload.entitySetName.trim(),
        id: guid,
        fields: [{
          logicalName: fieldLogicalName,
          attributeType: fieldAttributeType,
          rawValue: "",
          setNull
        }],
        refreshSourceTarget: buildSmartPatchRefreshSourceTarget(payload)
      });
      return;
    }

    case "copy-display-value": {
      const text = payload.isNullValue === true ? "∅" : String(payload.displayValue ?? rawValue ?? "");
      await vscode.env.clipboard.writeText(text);
      void vscode.window.showInformationMessage("DV Quick Run: Display value copied.");
      return;
    }

    case "copy-raw-value": {
      const text = payload.isNullValue === true ? "null" : String(rawValue ?? "");
      await vscode.env.clipboard.writeText(text);
      void vscode.window.showInformationMessage("DV Quick Run: Raw value copied.");
      return;
    }

    case "copy-row-json": {
      const text = String(payload.rowJson ?? "").trim();
      if (!text) {
        return;
      }

      await vscode.env.clipboard.writeText(text);
      void vscode.window.showInformationMessage("DV Quick Run: Row JSON copied.");
      return;
    }

    case "copy-column-name": {
      if (!columnName) {
        return;
      }

      await vscode.env.clipboard.writeText(columnName);
      void vscode.window.showInformationMessage("DV Quick Run: Column name copied.");
      return;
    }

    case "preview-add-select": {
      if (!columnName) {
        return;
      }

      try {
        await previewAndApplyAddSelectFromColumn(columnName);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showWarningMessage(`DV Quick Run: ${message}`);
      }
      return;
    }

    case "preview-odata-filter": {
      const isNullFilterValue = payload.isNullValue === true;
      if (!columnName || (!rawValue && !isNullFilterValue)) {
        return;
      }

      const filterValue = isNullFilterValue ? null : rawValue;

      try {
        await previewAndApplyODataFilter(columnName, filterValue);
      } catch (error) {
        const filter = buildODataFilter(columnName, filterValue);
        await vscode.env.clipboard.writeText(filter);
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showWarningMessage(`DV Quick Run: ${message} Falling back to copied OData filter.`);
      }
      return;
    }
    case "preview-odata-slice": {
      const hasRawValue = rawValue !== undefined && rawValue !== null;
      if (!columnName || !hasRawValue || !payload.sliceOperation) {
        return;
      }
      try {
        await previewAndApplyODataSlice(columnName, String(rawValue), payload.sliceOperation as ResultViewerSliceOperation);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showWarningMessage(`DV Quick Run: ${message}`);
      }
      return;
    }

    case "preview-fetchxml-slice": {
      const hasRawValue = rawValue !== undefined && rawValue !== null;
      if (!columnName || !hasRawValue || !payload.sliceOperation) {
        return;
      }
      try {
        await previewAndApplyFetchXmlSlice(columnName, String(rawValue), payload.sliceOperation as ResultViewerSliceOperation);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showWarningMessage(`DV Quick Run: ${message}`);
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
      const isNullFilterValue = payload.isNullValue === true;
      if (!columnName || (!rawValue && !isNullFilterValue)) {
        return;
      }

      const filterValue = isNullFilterValue ? null : rawValue;

      try {
        await previewAndApplyFetchXmlCondition(columnName, filterValue);
      } catch (error) {
        const condition = buildPreviewFetchXmlCondition(columnName, filterValue);
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

    case "preview-expand-relationship": {
      const relationshipFieldLogicalName = String(payload.fieldLogicalName ?? "").trim();
      if (!relationshipFieldLogicalName) {
        return;
      }

      try {
        await previewAndApplyExpandRelationship(ctx, {
          entitySetName: payload.entitySetName,
          entityLogicalName: payload.entityLogicalName,
          relationshipFieldLogicalName,
          sourceDocumentUri: payload.sourceDocumentUri,
          sourceRangeStartLine: payload.sourceRangeStartLine,
          sourceRangeStartCharacter: payload.sourceRangeStartCharacter,
          sourceRangeEndLine: payload.sourceRangeEndLine,
          sourceRangeEndCharacter: payload.sourceRangeEndCharacter
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showWarningMessage(`DV Quick Run: ${message}`);
      }
      return;
    }

    default:
      return;
  }
}

function resolveTraversalActions(
  context: ResultViewerActionContext,
  columnName: string,
  rawValue: string
): ResultViewerResolvedAction[] {
  const traversal = context.traversal;
  if (!traversal) {
    return [];
  }

  const canContinue =
    traversal.hasNextLeg &&
    !traversal.isFinalLeg &&
    !!traversal.requiredCarryField &&
    columnName === traversal.requiredCarryField &&
    !!rawValue;

  if (!canContinue) {
    return [];
  }

  const nextTarget = traversal.nextLegEntityName?.trim();
  const carryField = traversal.requiredCarryField?.trim() || columnName;

  return [
    createAction({
      id: "continue-traversal",
      title: nextTarget
        ? `Continue Guided Traversal to ${nextTarget} using ${carryField}`
        : `Continue Guided Traversal using ${carryField}`,
      icon: "➤",
      placement: "primary",
      group: "traversal",
      kind: "execute",
      payload: {
        columnName,
        rawValue,
        traversalSessionId: traversal.traversalSessionId,
        traversalLegIndex: traversal.legIndex,
        carryField: columnName,
        carryValue: rawValue
      }
    })
  ];
}

function createAction(action: ResultViewerResolvedAction): ResultViewerResolvedAction {
  return {
    ...action,
    isEnabled: action.isEnabled ?? true
  };
}

function sortActions(actions: ResultViewerResolvedAction[]): ResultViewerResolvedAction[] {
  const groupOrder: Record<ResultViewerResolvedAction["group"], number> = {
    refine: 0,
    slice: 1,
    dice: 2,
    correct: 3,
    investigate: 4,
    traversal: 5,
    copy: 6,
    metadata: 7
  };

  return actions.slice().sort((left, right) => {
    const placementDelta = rankPlacement(left.placement) - rankPlacement(right.placement);
    if (placementDelta !== 0) {
      return placementDelta;
    }

    const groupDelta = groupOrder[left.group] - groupOrder[right.group];
    if (groupDelta !== 0) {
      return groupDelta;
    }

    return left.title.localeCompare(right.title);
  });
}

function rankPlacement(placement: ResultViewerResolvedAction["placement"]): number {
  return placement === "primary" ? 0 : 1;
}

function buildSmartPatchRefreshSourceTarget(payload: ResultViewerActionPayload): SmartPatchRefreshSourceTarget | undefined {
  const hasSourceTarget = !!payload.sourceDocumentUri?.trim() &&
    payload.sourceRangeStartLine !== undefined &&
    payload.sourceRangeStartCharacter !== undefined &&
    payload.sourceRangeEndLine !== undefined &&
    payload.sourceRangeEndCharacter !== undefined;

  if (!hasSourceTarget) {
    return undefined;
  }

  return {
    sourceDocumentUri: payload.sourceDocumentUri?.trim() ?? "",
    sourceRangeStartLine: Number(payload.sourceRangeStartLine),
    sourceRangeStartCharacter: Number(payload.sourceRangeStartCharacter),
    sourceRangeEndLine: Number(payload.sourceRangeEndLine),
    sourceRangeEndCharacter: Number(payload.sourceRangeEndCharacter)
  };
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
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(`DV Quick Run: Failed to resolve Dataverse UI link. ${message}`);
    return undefined;
  }
}
