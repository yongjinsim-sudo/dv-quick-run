import * as vscode from "vscode";
import type { CommandContext } from "../commands/context/commandContext.js";
import type { FieldDef } from "../services/entityFieldMetadataService.js";
import type { ResultViewerModel } from "../services/resultViewModelBuilder.js";
import { isLookupLikeAttributeType } from "../metadata/metadataModel.js";
import { loadEntityDefByLogicalName, loadFields } from "../commands/router/actions/shared/metadataAccess.js";

const EXPORT_TIMEOUT_MS = 120_000;

type ODataPage = Record<string, unknown> & {
  value?: unknown[];
  "@odata.nextLink"?: string;
};

type ExportedBy = {
  type: "systemuser";
  id?: string;
  name?: string;
};

type DvburArtifact = {
  artifactType: "dvforgelab.dvbur";
  version: "1.0";
  source: "DVQR";
  generatedBy: "DV Quick Run";
  generatedAt: string;
  environment?: {
    name?: string;
    url?: string;
  };
  exportedBy?: ExportedBy;
  comment?: string;
  entityLogicalName: string;
  keyMode: "PrimaryId";
  keyColumn: string;
  records: Record<string, unknown>[];
};

type ExportProgress = {
  rows: number;
  pages: number;
  startedAt: number;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRows(page: ODataPage): Record<string, unknown>[] {
  return Array.isArray(page.value)
    ? page.value.filter(isPlainObject)
    : [];
}

function stripAnnotationColumns(record: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  Object.entries(record).forEach(([key, value]) => {
    if (key.includes("@")) {
      return;
    }

    if (key.startsWith("@odata.")) {
      return;
    }

    cleaned[key] = value;
  });
  return cleaned;
}

function normalizeGuid(value: unknown): string | undefined {
  const text = String(value ?? "").trim().replace(/[{}]/g, "");
  return /^[0-9a-fA-F-]{36}$/.test(text) ? text : undefined;
}

function normalizeName(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function buildEntitySetLookup(fields: readonly FieldDef[], entitySetByLogicalName: Map<string, string>): Map<string, string> {
  const lookup = new Map<string, string>();

  fields.forEach((field) => {
    if (!field.logicalName || !isLookupLikeAttributeType(field.attributeType)) {
      return;
    }

    const targets = (field.lookupTargets ?? [])
      .map((target) => entitySetByLogicalName.get(target.toLowerCase()))
      .filter((target): target is string => !!target);

    if (targets.length === 1) {
      lookup.set(field.logicalName.toLowerCase(), targets[0]);
    }
  });

  return lookup;
}

async function buildEntitySetByLogicalName(ctx: CommandContext, logicalNames: readonly string[]): Promise<Map<string, string>> {
  const client = ctx.getClient();
  const token = await ctx.getToken(ctx.getScope());
  const common: Array<[string, string]> = [
    ["account", "accounts"],
    ["contact", "contacts"],
    ["systemuser", "systemusers"],
    ["team", "teams"],
    ["businessunit", "businessunits"]
  ];
  const map = new Map<string, string>(common);
  const targets = Array.from(new Set(logicalNames.map((item) => item.trim().toLowerCase()).filter(Boolean)));

  for (const logicalName of targets) {
    const entity = await loadEntityDefByLogicalName(ctx, client, token, logicalName).catch(() => undefined);
    if (entity?.entitySetName) {
      map.set(logicalName, entity.entitySetName);
    }
  }

  return map;
}

function buildFieldLookup(fields: readonly FieldDef[]): Map<string, FieldDef> {
  const lookup = new Map<string, FieldDef>();
  fields.forEach((field) => {
    if (field.logicalName) {
      lookup.set(field.logicalName.toLowerCase(), field);
    }
  });
  return lookup;
}

function isWritableForUpsert(field: FieldDef | undefined, primaryIdField: string): boolean {
  if (!field?.logicalName) {
    return false;
  }

  if (field.logicalName.toLowerCase() === primaryIdField.toLowerCase()) {
    return true;
  }

  return field.isValidForCreate !== false || field.isValidForUpdate !== false;
}

function toDvburRecord(
  row: Record<string, unknown>,
  fields: readonly FieldDef[],
  entitySetByLogicalName: Map<string, string>,
  primaryIdField: string
): Record<string, unknown> {
  const cleaned = stripAnnotationColumns(row);
  const lookupEntitySets = buildEntitySetLookup(fields, entitySetByLogicalName);
  const fieldLookup = buildFieldLookup(fields);
  const result: Record<string, unknown> = {};

  Object.entries(cleaned).forEach(([key, value]) => {
    if (key.startsWith("_") && key.endsWith("_value")) {
      const logicalName = key.slice(1, -"_value".length);
      const field = fieldLookup.get(logicalName.toLowerCase());
      if (!isWritableForUpsert(field, primaryIdField)) {
        return;
      }

      const guid = normalizeGuid(value);
      const targetEntitySet = lookupEntitySets.get(logicalName.toLowerCase());
      if (guid && targetEntitySet) {
        result[`${logicalName}@odata.bind`] = `/${targetEntitySet}(${guid})`;
      }
      return;
    }

    const field = fieldLookup.get(key.toLowerCase());
    if (!isWritableForUpsert(field, primaryIdField)) {
      return;
    }

    result[key] = value;
  });

  return result;
}

function isODataQuery(queryPath: string): boolean {
  return !/(?:^|[?&])fetchXml=/i.test(queryPath);
}

function hasUnsupportedShape(model: ResultViewerModel): string | undefined {
  if (!model.entityLogicalName || !model.entitySetName || !model.primaryIdField) {
    return "Export DVBUR Artifact requires a deterministic single-entity Result Viewer context.";
  }

  const queryPath = model.queryPath ?? "";
  if (/[?&]\$expand=/i.test(queryPath) || model.columns.some((column) => column.includes("."))) {
    return "Export DVBUR Artifact is available for flat single-entity result sets without $expand.";
  }

  if (/[?&]\$apply=/i.test(queryPath) || /groupby\s*\(/i.test(queryPath)) {
    return "Export DVBUR Artifact is not available for aggregate or grouped result sets.";
  }

  if (!isODataQuery(queryPath) && !model.columns.includes(model.primaryIdField)) {
    return "Export DVBUR Artifact can only auto-add primary keys for OData Result Viewer queries.";
  }

  return undefined;
}

function ensurePrimaryKeyInSelect(queryPath: string, primaryIdField: string): string {
  if (!isODataQuery(queryPath)) {
    return queryPath;
  }

  const [pathPart, queryPart] = queryPath.split(/\?(.*)/s).filter((part) => part !== undefined);
  if (!queryPart) {
    return queryPath;
  }

  const params = new URLSearchParams(queryPart);
  const existingSelect = params.get("$select");
  if (!existingSelect) {
    return queryPath;
  }

  const selected = existingSelect
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (selected.some((item) => item.toLowerCase() === primaryIdField.toLowerCase())) {
    return queryPath;
  }

  selected.unshift(primaryIdField);
  params.set("$select", selected.join(","));
  return `${pathPart}?${params.toString()}`;
}

function defaultFileName(entityLogicalName: string, now = new Date()): string {
  const stamp = now.toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
    .replace("T", "-")
    .replace(/Z$/, "");
  return `${entityLogicalName}-${stamp}.dvbur.json`;
}

async function resolveExportedBy(ctx: CommandContext, token: string): Promise<ExportedBy | undefined> {
  try {
    const whoAmI = await ctx.getClient().get("/WhoAmI", token, { timeoutMs: EXPORT_TIMEOUT_MS }) as Record<string, unknown>;
    const id = normalizeGuid(whoAmI.UserId ?? whoAmI.userid);
    if (!id) {
      return undefined;
    }

    const user = await ctx.getClient().get(`/systemusers(${id})?$select=systemuserid,fullname,domainname`, token, { timeoutMs: EXPORT_TIMEOUT_MS }) as Record<string, unknown>;
    return {
      type: "systemuser",
      id,
      name: normalizeName(user.fullname) ?? normalizeName(user.domainname) ?? id
    };
  } catch {
    return undefined;
  }
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function buildProgressMessage(progress: ExportProgress): string {
  const elapsedMs = Date.now() - progress.startedAt;
  const rowsPerSecond = elapsedMs > 0 ? Math.round((progress.rows / elapsedMs) * 1000) : 0;
  return `${progress.rows.toLocaleString()} rows • ${progress.pages.toLocaleString()} page${progress.pages === 1 ? "" : "s"} • ${rowsPerSecond.toLocaleString()} rows/sec • ${formatDuration(elapsedMs)}`;
}

async function promptForComment(): Promise<string | undefined> {
  const value = await vscode.window.showInputBox({
    title: "Export DVBUR Artifact",
    prompt: "Optional export notes for record-keeping. These notes are stored in the artifact.",
    placeHolder: "e.g. Baseline export before SIT refresh",
    ignoreFocusOut: true
  });

  if (value === undefined) {
    return undefined;
  }

  return value.trim();
}

export async function exportDvburArtifactFromResultViewer(ctx: CommandContext, model: ResultViewerModel): Promise<void> {
  const unavailableReason = hasUnsupportedShape(model);
  if (unavailableReason) {
    void vscode.window.showWarningMessage(`DV Quick Run: ${unavailableReason}`);
    return;
  }

  const entityLogicalName = model.entityLogicalName as string;
  const entitySetName = model.entitySetName as string;
  const primaryIdField = model.primaryIdField as string;
  const token = await ctx.getToken(ctx.getScope());
  const exportQuery = ensurePrimaryKeyInSelect(model.queryPath, primaryIdField);
  const comment = await promptForComment();
  if (comment === undefined) {
    void vscode.window.showInformationMessage("DV Quick Run: DVBUR export cancelled. No artifact was written.");
    return;
  }

  const targetUri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(defaultFileName(entityLogicalName)),
    filters: {
      "DVBUR JSON": ["dvbur.json", "json"]
    },
    saveLabel: "Export DVBUR Artifact"
  });

  if (!targetUri) {
    void vscode.window.showInformationMessage("DV Quick Run: DVBUR export cancelled. No artifact was written.");
    return;
  }

  const activeEnvironment = ctx.envContext.getActiveEnvironment();
  const environmentUrl = activeEnvironment?.url ?? await ctx.getBaseUrl().catch(() => undefined);
  const exportedBy = await resolveExportedBy(ctx, token);
  const fields = await loadFields(ctx, ctx.getClient(), token, entityLogicalName, { silent: true }).catch(() => [] as FieldDef[]);
  if (!fields.length) {
    throw new Error("DVBUR export requires entity field metadata so read-only columns can be excluded safely.");
  }

  const lookupTargetLogicalNames = fields.flatMap((field) => field.lookupTargets ?? []);
  const entitySetByLogicalName = await buildEntitySetByLogicalName(ctx, [entityLogicalName, ...lookupTargetLogicalNames]);
  entitySetByLogicalName.set(entityLogicalName.toLowerCase(), entitySetName);

  const records: Record<string, unknown>[] = [];
  const startedAt = Date.now();
  let pages = 0;
  let nextPath: string | undefined = exportQuery;

  await vscode.window.withProgress<void>({
    location: vscode.ProgressLocation.Notification,
    title: "DV Quick Run: Exporting DVBUR Artifact",
    cancellable: true
  }, async (progress, cancellationToken) => {
    while (nextPath) {
      if (cancellationToken.isCancellationRequested) {
        throw new Error("cancelled");
      }

      const page = await ctx.getClient().get(nextPath, token, { timeoutMs: EXPORT_TIMEOUT_MS }) as ODataPage;
      pages += 1;
      const pageRows = getRows(page);
      pageRows.forEach((row) => {
        const record = toDvburRecord(row, fields, entitySetByLogicalName, primaryIdField);
        if (!(primaryIdField in record) && primaryIdField in row) {
          record[primaryIdField] = row[primaryIdField];
        }
        records.push(record);
      });

      progress.report({
        message: buildProgressMessage({ rows: records.length, pages, startedAt })
      });

      const nextLink = typeof page["@odata.nextLink"] === "string" ? page["@odata.nextLink"] : undefined;
      nextPath = nextLink?.trim() || undefined;
    }
  });

  const artifact: DvburArtifact = {
    artifactType: "dvforgelab.dvbur",
    version: "1.0",
    source: "DVQR",
    generatedBy: "DV Quick Run",
    generatedAt: new Date().toISOString(),
    environment: {
      name: activeEnvironment?.name ?? ctx.envContext.getEnvironmentName(),
      url: environmentUrl
    },
    exportedBy,
    comment: comment || undefined,
    entityLogicalName,
    keyMode: "PrimaryId",
    keyColumn: primaryIdField,
    records
  };

  await vscode.workspace.fs.writeFile(targetUri, Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`, "utf8"));
  void vscode.window.showInformationMessage(`DV Quick Run: Exported ${records.length.toLocaleString()} rows to ${targetUri.fsPath}`);
}
