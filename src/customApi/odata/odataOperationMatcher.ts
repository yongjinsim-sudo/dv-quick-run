import type { CustomApiDefinition } from "../models/customApiTypes.js";
import type { ODataOperationDefinition, ODataOperationRegistry } from "./odataMetadataParser.js";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function scoreMatch(definition: CustomApiDefinition, operation: ODataOperationDefinition): number {
  let score = 0;

  if (operation.kind === definition.operationKind) {
    score += 10;
  }

  if (operation.bindingKind === definition.bindingKind) {
    score += 6;
  }

  if (operation.boundTargetKind && operation.boundTargetKind === definition.boundTargetKind) {
    score += 3;
  }

  if (operation.boundEntityLogicalName
    && definition.boundEntityLogicalName
    && normalize(operation.boundEntityLogicalName) === normalize(definition.boundEntityLogicalName)) {
    score += 4;
  }

  if (normalize(operation.name) === normalize(definition.uniqueName)) {
    score += 5;
  }

  if (operation.importName && normalize(operation.importName) === normalize(definition.uniqueName)) {
    score += 7;
  }

  if (normalize(operation.qualifiedName).endsWith(`.${normalize(definition.uniqueName)}`)) {
    score += 3;
  }

  return score;
}

export function findODataOperationForCustomApi(
  registry: ODataOperationRegistry,
  definition: CustomApiDefinition
): ODataOperationDefinition | undefined {
  const candidates = [
    ...(registry.byName.get(normalize(definition.uniqueName)) ?? []),
    ...(registry.byName.get(normalize(`Microsoft.Dynamics.CRM.${definition.uniqueName}`)) ?? [])
  ];

  const uniqueCandidates = Array.from(new Map(candidates.map((candidate) => [
    `${candidate.kind}:${candidate.qualifiedName}:${candidate.importName || ""}`.toLowerCase(),
    candidate
  ])).values());

  return uniqueCandidates
    .map((candidate) => ({ candidate, score: scoreMatch(definition, candidate) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.candidate;
}
