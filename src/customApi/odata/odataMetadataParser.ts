import type { CustomApiBindingKind, CustomApiBoundTargetKind, CustomApiOperationKind } from "../models/customApiTypes.js";

export interface ODataOperationDefinition {
  name: string;
  qualifiedName: string;
  kind: CustomApiOperationKind;
  bindingKind: CustomApiBindingKind;
  boundTargetKind?: CustomApiBoundTargetKind;
  boundEntityLogicalName?: string;
  boundEntitySetName?: string;
  bindingParameterName?: string;
  importName?: string;
}

export interface ODataOperationRegistry {
  operations: ODataOperationDefinition[];
  byName: Map<string, ODataOperationDefinition[]>;
  entitySetByLogicalName: Map<string, string>;
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

function extractEntityLogicalName(typeName: string | undefined): string | undefined {
  if (!typeName) {
    return undefined;
  }

  const collectionMatch = /^Collection\(([^)]+)\)$/i.exec(typeName.trim());
  const normalizedType = collectionMatch?.[1] ?? typeName.trim();
  const parts = normalizedType.split(".");
  return parts[parts.length - 1] || undefined;
}

function classifyBoundTargetKind(typeName: string | undefined): CustomApiBoundTargetKind {
  if (!typeName) {
    return "unknown";
  }

  return /^Collection\(/i.test(typeName.trim()) ? "collection" : "entity";
}

function getFirstParameterTag(body: string): string | undefined {
  return /<Parameter\b[^>]*>/i.exec(body)?.[0];
}

function getFirstParameterType(body: string): string | undefined {
  const parameterTag = getFirstParameterTag(body);
  return parameterTag ? getAttribute(parameterTag, "Type") : undefined;
}

function getFirstParameterName(body: string): string | undefined {
  const parameterTag = getFirstParameterTag(body);
  return parameterTag ? getAttribute(parameterTag, "Name") : undefined;
}

function addOperation(
  operations: ODataOperationDefinition[],
  operation: ODataOperationDefinition
): void {
  const duplicate = operations.some((existing) => existing.kind === operation.kind
    && existing.qualifiedName.toLowerCase() === operation.qualifiedName.toLowerCase()
    && (existing.importName || "").toLowerCase() === (operation.importName || "").toLowerCase()
    && (existing.boundEntityLogicalName || "").toLowerCase() === (operation.boundEntityLogicalName || "").toLowerCase()
    && (existing.boundTargetKind || "").toLowerCase() === (operation.boundTargetKind || "").toLowerCase());

  if (!duplicate) {
    operations.push(operation);
  }
}

function buildRegistry(
  operations: ODataOperationDefinition[],
  entitySetByLogicalName: Map<string, string>
): ODataOperationRegistry {
  const byName = new Map<string, ODataOperationDefinition[]>();

  operations.forEach((operation) => {
    [operation.name, operation.qualifiedName, operation.importName].filter(Boolean).forEach((name) => {
      const key = normalizeKey(name as string);
      const existing = byName.get(key) ?? [];
      existing.push(operation);
      byName.set(key, existing);
    });
  });

  return { operations, byName, entitySetByLogicalName };
}

function parseEntitySets(metadataXml: string): Map<string, string> {
  const entitySetByLogicalName = new Map<string, string>();
  const entitySetRegex = /<EntitySet\b[^>]*>/gi;

  for (const match of metadataXml.matchAll(entitySetRegex)) {
    const tag = match[0];
    const entitySetName = getAttribute(tag, "Name");
    const entityType = getAttribute(tag, "EntityType");
    const logicalName = extractEntityLogicalName(entityType);

    if (entitySetName && logicalName) {
      entitySetByLogicalName.set(normalizeKey(logicalName), entitySetName);
    }
  }

  return entitySetByLogicalName;
}

function buildOperationFromDefinition(
  kind: CustomApiOperationKind,
  openingTag: string,
  body: string,
  entitySetByLogicalName: Map<string, string>
): ODataOperationDefinition | undefined {
  const name = getAttribute(openingTag, "Name");
  if (!name) {
    return undefined;
  }

  const isBound = /^true$/i.test(getAttribute(openingTag, "IsBound") || "");
  const bindingParameterType = isBound ? getFirstParameterType(body) : undefined;
  const bindingParameterName = isBound ? getFirstParameterName(body) : undefined;
  const boundTargetKind = isBound ? classifyBoundTargetKind(bindingParameterType) : "none";
  const boundEntityLogicalName = isBound ? extractEntityLogicalName(bindingParameterType) : undefined;
  const boundEntitySetName = boundEntityLogicalName ? entitySetByLogicalName.get(normalizeKey(boundEntityLogicalName)) : undefined;

  return {
    name,
    qualifiedName: `Microsoft.Dynamics.CRM.${name}`,
    kind,
    bindingKind: isBound ? "Bound" : "Unbound",
    boundTargetKind,
    boundEntityLogicalName,
    boundEntitySetName,
    bindingParameterName
  };
}

export function parseODataOperationRegistry(metadataXml: string): ODataOperationRegistry {
  const operations: ODataOperationDefinition[] = [];
  const entitySetByLogicalName = parseEntitySets(metadataXml);

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
      boundTargetKind: "none",
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
      boundTargetKind: "none",
      importName
    });
  }

  const functionRegex = /<Function\b(?![^>]*\/>)([^>]*)>([\s\S]*?)<\/Function>/gi;
  for (const match of metadataXml.matchAll(functionRegex)) {
    const operation = buildOperationFromDefinition("Function", `<Function${match[1]}>`, match[2] ?? "", entitySetByLogicalName);
    if (operation) {
      addOperation(operations, operation);
    }
  }

  const selfClosingFunctionRegex = /<Function\b([^>]*)\/>/gi;
  for (const match of metadataXml.matchAll(selfClosingFunctionRegex)) {
    const operation = buildOperationFromDefinition("Function", `<Function${match[1]}/>`, "", entitySetByLogicalName);
    if (operation) {
      addOperation(operations, operation);
    }
  }

  const actionRegex = /<Action\b(?![^>]*\/>)([^>]*)>([\s\S]*?)<\/Action>/gi;
  for (const match of metadataXml.matchAll(actionRegex)) {
    const operation = buildOperationFromDefinition("Action", `<Action${match[1]}>`, match[2] ?? "", entitySetByLogicalName);
    if (operation) {
      addOperation(operations, operation);
    }
  }

  const selfClosingActionRegex = /<Action\b([^>]*)\/>/gi;
  for (const match of metadataXml.matchAll(selfClosingActionRegex)) {
    const operation = buildOperationFromDefinition("Action", `<Action${match[1]}/>`, "", entitySetByLogicalName);
    if (operation) {
      addOperation(operations, operation);
    }
  }

  return buildRegistry(operations, entitySetByLogicalName);
}
