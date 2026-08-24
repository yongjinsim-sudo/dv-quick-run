export interface McpInputValidationResult {
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly normalizedArguments: Record<string, unknown>;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOGICAL_NAME = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const PATH_ID = /^bp_[0-9a-f]{8}$/;
const MAX_GENERIC_STRING = 4096;
const MAX_QUERY_STRING = 12000;
const MAX_ARRAY_ITEMS = 100;
const MAX_OBJECT_DEPTH = 8;
const DATAVERSE_HOST_SUFFIXES = [
  ".dynamics.com",
  ".dynamics.cn",
  ".microsoftdynamics.us",
  ".microsoftdynamics.de",
  ".appsplatform.us"
] as const;

function isDataverseEnvironmentHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  return DATAVERSE_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

function schemaRecord(schema: unknown): Record<string, unknown> {
  return schema && typeof schema === "object" ? schema as Record<string, unknown> : {};
}

function validateString(name: string, value: string, schema: Record<string, unknown>, issues: string[]): string {
  const trimmed = value.trim();
  const explicitMax = typeof schema.maxLength === "number" ? schema.maxLength : undefined;
  const max = explicitMax ?? (name === "query" ? MAX_QUERY_STRING : MAX_GENERIC_STRING);
  if (value.length > max) issues.push(`${name} exceeds the maximum length of ${max}.`);

  if (/environmenturl$/i.test(name)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
        issues.push(`${name} must be an HTTPS URL without embedded credentials.`);
      } else if (!isDataverseEnvironmentHost(parsed.hostname)) {
        issues.push(`${name} must identify a supported Dataverse environment host.`);
      }
    } catch {
      issues.push(`${name} must be a valid HTTPS URL.`);
    }
  }
  if (/recordid$/i.test(name) && trimmed && !GUID.test(trimmed.replace(/[{}]/g, ""))) {
    issues.push(`${name} is not a canonical Dataverse GUID.`);
  }
  if (/pathid$/i.test(name) && trimmed && !PATH_ID.test(trimmed)) {
    issues.push(`${name} must be an exact Business Path ID.`);
  }
  if (/(^|\.)(sourceTable|targetTable|fromTable|toTable|logicalName|lookupAttribute|intersectTable)$/i.test(name)
    && trimmed && !LOGICAL_NAME.test(trimmed)) {
    issues.push(`${name} must be a Dataverse logical name.`);
  }
  return value;
}


function validateUnstructured(name: string, value: unknown, issues: string[], depth: number): unknown {
  if (depth > MAX_OBJECT_DEPTH) { issues.push(`${name || "arguments"} exceeds the maximum nesting depth.`); return value; }
  if (typeof value === "string") return validateString(name, value, {}, issues);
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_ITEMS) issues.push(`${name} must not exceed ${MAX_ARRAY_ITEMS} item(s).`);
    return value.map((item, index) => validateUnstructured(`${name}[${index}]`, item, issues, depth + 1));
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > MAX_ARRAY_ITEMS) issues.push(`${name || "arguments"} must not exceed ${MAX_ARRAY_ITEMS} fields.`);
    const result: Record<string, unknown> = {};
    for (const [key, item] of entries) result[key] = validateUnstructured(name ? `${name}.${key}` : key, item, issues, depth + 1);
    return result;
  }
  return value;
}

function validateValue(
  name: string,
  value: unknown,
  schemaInput: unknown,
  issues: string[],
  depth: number
): unknown {
  if (depth > MAX_OBJECT_DEPTH) {
    issues.push(`${name || "arguments"} exceeds the maximum nesting depth.`);
    return value;
  }
  const schema = schemaRecord(schemaInput);
  const type = schema.type;

  if (type === "string") {
    if (typeof value !== "string") { issues.push(`${name} must be a string.`); return value; }
    const enums = Array.isArray(schema.enum) ? schema.enum : undefined;
    if (enums && !enums.includes(value)) issues.push(`${name} is not an allowed value.`);
    return validateString(name, value, schema, issues);
  }
  if (type === "integer") {
    if (!Number.isInteger(value)) { issues.push(`${name} must be an integer.`); return value; }
    const n = value as number;
    const minimum = typeof schema.minimum === "number" ? schema.minimum : undefined;
    const maximum = typeof schema.maximum === "number" ? schema.maximum : undefined;
    if (minimum !== undefined && n < minimum) issues.push(`${name} must be at least ${minimum}.`);
    if (maximum !== undefined && n > maximum) issues.push(`${name} must not exceed ${maximum}.`);
    return value;
  }
  if (type === "boolean") {
    if (typeof value !== "boolean") issues.push(`${name} must be a boolean.`);
    return value;
  }
  if (type === "array") {
    if (!Array.isArray(value)) { issues.push(`${name} must be an array.`); return value; }
    const minItems = typeof schema.minItems === "number" ? schema.minItems : undefined;
    const maxItems = typeof schema.maxItems === "number" ? schema.maxItems : MAX_ARRAY_ITEMS;
    if (minItems !== undefined && value.length < minItems) issues.push(`${name} requires at least ${minItems} item(s).`);
    if (value.length > maxItems) issues.push(`${name} must not exceed ${maxItems} item(s).`);
    return value.map((item, index) => validateValue(`${name}[${index}]`, item, schema.items, issues, depth + 1));
  }
  if (type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) { issues.push(`${name || "arguments"} must be an object.`); return value; }
    const object = value as Record<string, unknown>;
    const properties = schemaRecord(schema.properties);
    // Required business inputs remain canonical application-service semantics.
    // This boundary gate protects shape, type, bounds and escalation without
    // masking established lifecycle/policy errors for omitted values.
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(object)) {
        if (!(key in properties)) issues.push(`${name ? `${name}.` : ""}${key} is not an allowed argument.`);
      }
    }
    const normalized: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(object)) {
      normalized[key] = key in properties
        ? validateValue(name ? `${name}.${key}` : key, item, properties[key], issues, depth + 1)
        : validateUnstructured(name ? `${name}.${key}` : key, item, issues, depth + 1);
    }
    return normalized;
  }

  return validateUnstructured(name, value, issues, depth);
}

export function validateMcpToolArguments(
  inputSchema: Record<string, unknown>,
  args: Record<string, unknown>
): McpInputValidationResult {
  const issues: string[] = [];
  const normalized = validateValue("", args, inputSchema, issues, 0);
  return {
    valid: issues.length === 0,
    issues,
    normalizedArguments: (normalized && typeof normalized === "object" && !Array.isArray(normalized))
      ? normalized as Record<string, unknown>
      : args
  };
}
