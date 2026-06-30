import type { DataverseClient } from "../../services/dataverseClient.js";

export const SECRET_MASK = "********";

export interface SnapshotEnvironmentVariableDefinition {
  readonly schemaName: string;
  readonly displayName?: string;
  readonly type?: string;
  readonly typeCode?: number;
  readonly defaultValue?: string;
  readonly currentValue?: string;
  readonly hasCurrentValue?: boolean;
  readonly isManaged?: boolean;
  readonly isSecret?: boolean;
  readonly valueCaptured: boolean;
}

export interface EnvironmentVariableSnapshotPayload {
  readonly metadataVersion: "environment-variable-definitions-v1";
  readonly variables: readonly SnapshotEnvironmentVariableDefinition[];
  readonly notes?: readonly string[];
}

interface DataverseCollection<T> {
  readonly value?: readonly T[];
}

interface EnvironmentVariableDefinitionRow {
  readonly environmentvariabledefinitionid?: string;
  readonly schemaname?: string;
  readonly displayname?: string;
  readonly type?: number;
  readonly defaultvalue?: string;
  readonly ismanaged?: boolean;
  readonly [key: string]: unknown;
}

interface EnvironmentVariableValueRow {
  readonly value?: string;
  readonly environmentvariablevalueid?: string;
  readonly _environmentvariabledefinitionid_value?: string;
}

const ENVIRONMENT_VARIABLE_SECRET_TYPE_CODE = 100000005;

export async function buildEnvironmentVariableSnapshotPayload(args: {
  readonly client: DataverseClient;
  readonly token: string;
}): Promise<EnvironmentVariableSnapshotPayload | undefined> {
  const definitions = await loadEnvironmentVariableDefinitions(args.client, args.token);
  if (definitions.length === 0) {
    return undefined;
  }

  const currentValues = await loadEnvironmentVariableValues(args.client, args.token).catch(() => new Map<string, EnvironmentVariableValueRow>());
  const variables = definitions
    .map((definition) => mapEnvironmentVariableDefinition(definition, currentValues))
    .filter((definition): definition is SnapshotEnvironmentVariableDefinition => Boolean(definition));

  return {
    metadataVersion: "environment-variable-definitions-v1",
    variables,
    notes: [
      "Secret environment variable values are masked in DVQR snapshots.",
      "DVQR captures current-value evidence only where Dataverse exposes non-secret values."
    ]
  };
}

async function loadEnvironmentVariableDefinitions(client: DataverseClient, token: string): Promise<readonly EnvironmentVariableDefinitionRow[]> {
  const select = [
    "environmentvariabledefinitionid",
    "schemaname",
    "displayname",
    "type",
    "defaultvalue",
    "ismanaged"
  ].join(",");
  const response = await client.get(`/environmentvariabledefinitions?$select=${select}&$orderby=schemaname asc`, token) as DataverseCollection<EnvironmentVariableDefinitionRow>;
  return response.value ?? [];
}

async function loadEnvironmentVariableValues(client: DataverseClient, token: string): Promise<Map<string, EnvironmentVariableValueRow>> {
  const select = [
    "environmentvariablevalueid",
    "value",
    "_environmentvariabledefinitionid_value"
  ].join(",");
  const response = await client.get(`/environmentvariablevalues?$select=${select}`, token) as DataverseCollection<EnvironmentVariableValueRow>;
  const values = new Map<string, EnvironmentVariableValueRow>();
  for (const row of response.value ?? []) {
    const definitionId = normalizeId(row._environmentvariabledefinitionid_value);
    if (definitionId) {
      values.set(definitionId, row);
    }
  }
  return values;
}

function mapEnvironmentVariableDefinition(
  row: EnvironmentVariableDefinitionRow,
  currentValues: ReadonlyMap<string, EnvironmentVariableValueRow>
): SnapshotEnvironmentVariableDefinition | undefined {
  const schemaName = normalizeString(row.schemaname);
  if (!schemaName) {
    return undefined;
  }

  const definitionId = normalizeId(row.environmentvariabledefinitionid);
  const currentValue = definitionId ? currentValues.get(definitionId) : undefined;
  const isSecret = isSecretEnvironmentVariable(row);
  const capturedCurrentValue = normalizeString(currentValue?.value);

  return {
    schemaName,
    displayName: normalizeString(row.displayname),
    type: formatEnvironmentVariableType(row),
    typeCode: typeof row.type === "number" ? row.type : undefined,
    defaultValue: isSecret ? SECRET_MASK : normalizeString(row.defaultvalue),
    currentValue: isSecret ? SECRET_MASK : capturedCurrentValue,
    hasCurrentValue: Boolean(currentValue?.environmentvariablevalueid || capturedCurrentValue !== undefined),
    isManaged: typeof row.ismanaged === "boolean" ? row.ismanaged : undefined,
    isSecret,
    valueCaptured: !isSecret
  };
}

function isSecretEnvironmentVariable(row: EnvironmentVariableDefinitionRow): boolean {
  if (row.type === ENVIRONMENT_VARIABLE_SECRET_TYPE_CODE) {
    return true;
  }

  const formatted = normalizeString(row["type@OData.Community.Display.V1.FormattedValue"]);
  return /secret/i.test(formatted ?? "");
}

function formatEnvironmentVariableType(row: EnvironmentVariableDefinitionRow): string | undefined {
  const formatted = normalizeString(row["type@OData.Community.Display.V1.FormattedValue"]);
  if (formatted) {
    return formatted;
  }

  return typeof row.type === "number" ? String(row.type) : undefined;
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const text = value.trim();
  return text || undefined;
}

function normalizeId(value: unknown): string | undefined {
  const text = normalizeString(value);
  return text?.replace(/[{}]/g, "").toLowerCase();
}
