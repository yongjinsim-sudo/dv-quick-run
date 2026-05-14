import type { CustomApiBindingKind, CustomApiOperationKind } from "../models/customApiTypes.js";

export interface ODataOperationDefinition {
  name: string;
  qualifiedName: string;
  kind: CustomApiOperationKind;
  bindingKind: CustomApiBindingKind;
  importName?: string;
}

export interface ODataOperationRegistry {
  operations: ODataOperationDefinition[];
  byName: Map<string, ODataOperationDefinition[]>;
}

function getAttribute(tag: string, attributeName: string): string | undefined {
  const pattern = new RegExp(`${attributeName}\\s*=\\s*["']([^"']+)["']`, "i");
  const match = pattern.exec(tag);
  return match?.[1];
}

function shortName(qualifiedName: string): string {
  const parts = qualifiedName.split(".");
  return parts[parts.length - 1] || qualifiedName;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function addOperation(
  operations: ODataOperationDefinition[],
  operation: ODataOperationDefinition
): void {
  const duplicate = operations.some((existing) => existing.kind === operation.kind
    && existing.qualifiedName.toLowerCase() === operation.qualifiedName.toLowerCase()
    && (existing.importName || "").toLowerCase() === (operation.importName || "").toLowerCase());

  if (!duplicate) {
    operations.push(operation);
  }
}

function buildRegistry(operations: ODataOperationDefinition[]): ODataOperationRegistry {
  const byName = new Map<string, ODataOperationDefinition[]>();

  operations.forEach((operation) => {
    [operation.name, operation.qualifiedName, operation.importName].filter(Boolean).forEach((name) => {
      const key = normalizeKey(name as string);
      const existing = byName.get(key) ?? [];
      existing.push(operation);
      byName.set(key, existing);
    });
  });

  return { operations, byName };
}

export function parseODataOperationRegistry(metadataXml: string): ODataOperationRegistry {
  const operations: ODataOperationDefinition[] = [];

  const functionImportRegex = /<FunctionImport\b[^>]*>/gi;
  for (const match of metadataXml.matchAll(functionImportRegex)) {
    const tag = match[0];
    const importName = getAttribute(tag, "Name");
    const functionName = getAttribute(tag, "Function");
    if (!importName || !functionName) {
      continue;
    }

    addOperation(operations, {
      name: shortName(functionName),
      qualifiedName: functionName,
      kind: "Function",
      bindingKind: "Unbound",
      importName
    });
  }

  const actionImportRegex = /<ActionImport\b[^>]*>/gi;
  for (const match of metadataXml.matchAll(actionImportRegex)) {
    const tag = match[0];
    const importName = getAttribute(tag, "Name");
    const actionName = getAttribute(tag, "Action");
    if (!importName || !actionName) {
      continue;
    }

    addOperation(operations, {
      name: shortName(actionName),
      qualifiedName: actionName,
      kind: "Action",
      bindingKind: "Unbound",
      importName
    });
  }

  const functionRegex = /<Function\b[^>]*>/gi;
  for (const match of metadataXml.matchAll(functionRegex)) {
    const tag = match[0];
    const name = getAttribute(tag, "Name");
    if (!name) {
      continue;
    }

    const isBound = /^true$/i.test(getAttribute(tag, "IsBound") || "");
    addOperation(operations, {
      name,
      qualifiedName: `Microsoft.Dynamics.CRM.${name}`,
      kind: "Function",
      bindingKind: isBound ? "Bound" : "Unbound"
    });
  }

  const actionRegex = /<Action\b[^>]*>/gi;
  for (const match of metadataXml.matchAll(actionRegex)) {
    const tag = match[0];
    const name = getAttribute(tag, "Name");
    if (!name) {
      continue;
    }

    const isBound = /^true$/i.test(getAttribute(tag, "IsBound") || "");
    addOperation(operations, {
      name,
      qualifiedName: `Microsoft.Dynamics.CRM.${name}`,
      kind: "Action",
      bindingKind: isBound ? "Bound" : "Unbound"
    });
  }

  return buildRegistry(operations);
}
