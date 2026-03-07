import * as vscode from "vscode";
import { ParsedRecord, ReadJsonResult } from "./generateQueryFromJsonTypes.js";

export function isGuidLike(s: string): boolean {
  const t = (s || "").trim();
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(t);
}

export function tryParseFromODataId(obj: any): { entitySetName: string; id: string } | undefined {
  const raw = String(obj?.["@odata.id"] ?? "").trim();
  if (!raw) {return undefined;}

  const m = raw.match(/\/api\/data\/v\d+\.\d+\/([^()\/?#]+)\(([^)]+)\)/i);
  if (!m) {return undefined;}

  const entitySetName = m[1];
  const id = m[2];
  if (!entitySetName || !isGuidLike(id)) {return undefined;}

  return { entitySetName, id };
}

export function tryParseEntitySetNameFromContextString(ctx: string): string | undefined {
  const t = (ctx || "").trim();
  if (!t) {return undefined;}

  // Examples:
  // $metadata#contacts/$entity
  // $metadata#contacts
  // $metadata#contacts(firstname,lastname)
  const m = t.match(/\$metadata#([^(/]+)/i);
  if (!m) {return undefined;}

  const frag = (m[1] || "").trim();
  return frag || undefined;
}

export function tryParseEntitySetFromContext(obj: any): string | undefined {
  const ctx = String(obj?.["@odata.context"] ?? "").trim();
  return tryParseEntitySetNameFromContextString(ctx);
}

export function tryPickPrimaryKeyGuid(
  obj: any,
  logicalNameMaybe?: string
): { id: string; fieldName?: string } | undefined {
  const keys = Object.keys(obj || {});
  if (!keys.length) {return undefined;}

  const preferred = logicalNameMaybe ? `${logicalNameMaybe.toLowerCase()}id` : undefined;
  if (preferred && typeof obj?.[preferred] === "string" && isGuidLike(obj[preferred])) {
    return { id: obj[preferred], fieldName: preferred };
  }

  for (const k of keys) {
    if (!k || !/id$/i.test(k)) {continue;}
    const v = obj?.[k];
    if (typeof v === "string" && isGuidLike(v)) {
      return { id: v, fieldName: k };
    }
  }

  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && isGuidLike(v)) {
      return { id: v, fieldName: k };
    }
  }

  return undefined;
}

export function selectTokensFromRecord(obj: any): string[] {
  const tokens = new Set<string>();

  for (const k of Object.keys(obj || {})) {
    if (!k) {continue;}

    if (k.startsWith("@odata.")) {continue;}
    if (k.includes("@OData.")) {continue;}
    if (k.includes("@Microsoft.Dynamics.CRM.")) {continue;}
    if (k.includes("@")) {continue;}

    tokens.add(k);
  }

  return Array.from(tokens.values()).sort((a, b) => a.localeCompare(b));
}

export function tryParseDataverseRecord(obj: any, fallbackEntitySetName?: string): ParsedRecord | undefined {
  if (!obj || typeof obj !== "object") {return undefined;}

  const fromOdataId = tryParseFromODataId(obj);
  if (fromOdataId) {
    return {
      entitySetName: fromOdataId.entitySetName,
      id: fromOdataId.id,
      selectFields: selectTokensFromRecord(obj),
      source: "odataId"
    };
  }

  const entitySetName = tryParseEntitySetFromContext(obj) ?? fallbackEntitySetName;
  if (!entitySetName) {return undefined;}

  const logicalNameMaybe = entitySetName.endsWith("s")
    ? entitySetName.slice(0, -1)
    : undefined;

  const pk = tryPickPrimaryKeyGuid(obj, logicalNameMaybe);
  if (!pk) {return undefined;}

  return {
    entitySetName,
    id: pk.id,
    primaryIdField: pk.fieldName,
    selectFields: selectTokensFromRecord(obj),
    source: fallbackEntitySetName ? "arrayRecord" : "context+pk"
  };
}

export function tryParseJson(text: string): any | undefined {
  const t = (text || "").trim();
  if (!t) {return undefined;}

  try {
    return JSON.parse(t);
  } catch {
    return undefined;
  }
}

export function readJsonFromEditor(): ReadJsonResult | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {return undefined;}

  const sel = editor.selection;
  if (sel && !sel.isEmpty) {
    const raw = editor.document.getText(sel);
    const parsed = tryParseJson(raw);
    if (parsed !== undefined) {
      return { json: parsed, used: "selection" };
    }
  }

  const docText = editor.document.getText();
  const parsed = tryParseJson(docText);
  if (parsed !== undefined) {
    return { json: parsed, used: "document" };
  }

  return undefined;
}