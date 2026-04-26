import { parsePatchValue } from "./smartPatchValueParser.js";
import { SmartPatchState } from "./smartPatchTypes.js";

export function normalizePath(input: string): string {
  const t = input.trim();
  if (!t) {return "";}
  return t.startsWith("/") ? t : `/${t}`;
}

export function buildPatchBody(state: SmartPatchState): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const f of state.fields) {
    body[f.logicalName] = f.setNull === true
      ? null
      : parsePatchValue({ attributeType: f.attributeType }, f.rawValue);
  }
  return body;
}

export function buildPatchPath(state: SmartPatchState): string {
  return normalizePath(`${state.entitySetName}(${state.id})`);
}

export function buildPatchCurl(
  baseUrl: string,
  patchPath: string,
  body: unknown
): string {
  const url = `${baseUrl}${patchPath}`;
  const payload = JSON.stringify(body);

  return [
    "curl -X PATCH \\",
    `  "${url}" \\`,
    '  -H "Authorization: Bearer <<token>>" \\',
    '  -H "Content-Type: application/json" \\',
    '  -H "If-Match: *" \\',
    `  -d '${payload}'`
  ].join("\n");
}