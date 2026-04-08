import type { CommandContext } from "../../../../context/commandContext.js";
import { loadEntityDefs, loadEntityRelationships, loadFields } from "../../shared/metadataAccess.js";
import { loadInvestigateScopeSettings, matchesInvestigatePattern } from "../investigateScope.js";
import type { IdentifierResolutionCandidateField, IdentifierResolutionRequest } from "./identifierResolutionTypes.js";
import { looksIdentifierLike, scoreIdentifierField } from "./identifierResolutionFieldScorer.js";

const SUPPORTED_ATTRIBUTE_TYPES = new Set(["uniqueidentifier", "string", "memo"]);

export async function buildIdentifierResolutionCandidates(
  ctx: CommandContext,
  request: IdentifierResolutionRequest
): Promise<{
  candidates: IdentifierResolutionCandidateField[];
  searchedEntityLogicalNames: string[];
  missingAllowedTables: boolean;
}> {
  const client = ctx.getClient();
  const token = await ctx.getToken(ctx.getScope());
  const entityDefs = await loadEntityDefs(ctx, client, token, { silent: true });
  const entityByLogicalName = new Map(entityDefs.map((entity) => [entity.logicalName.toLowerCase(), entity]));
  const entityBySetName = new Map(entityDefs.map((entity) => [entity.entitySetName.toLowerCase(), entity]));

  const currentEntity = request.currentEntityLogicalName
    ? entityByLogicalName.get(request.currentEntityLogicalName.trim().toLowerCase())
    : request.currentEntitySetName
      ? entityBySetName.get(request.currentEntitySetName.trim().toLowerCase())
      : undefined;

  const investigateScope = loadInvestigateScopeSettings(ctx, { log: false });
  const allowedPatterns = [...investigateScope.searchScopeTables];

  const targetEntities = new Map<string, { logicalName: string; entitySetName: string; primaryIdAttribute?: string }>();

  if (currentEntity?.logicalName && currentEntity.entitySetName) {
    targetEntities.set(currentEntity.logicalName.toLowerCase(), currentEntity);
  }

  if (allowedPatterns.length === 0) {
    return {
      candidates: [],
      searchedEntityLogicalNames: currentEntity ? [currentEntity.logicalName] : [],
      missingAllowedTables: !currentEntity
    };
  }

  for (const entity of entityDefs) {
    if (targetEntities.size >= investigateScope.maxSearchTables) {
      break;
    }

    const logicalName = entity.logicalName.trim().toLowerCase();
    if (targetEntities.has(logicalName)) {
      continue;
    }

    if (allowedPatterns.some((pattern) => matchesInvestigatePattern(logicalName, pattern))) {
      targetEntities.set(logicalName, entity);
    }
  }

  const searchedEntityLogicalNames = [...targetEntities.values()].map((entity) => entity.logicalName);
  const candidates: IdentifierResolutionCandidateField[] = [];

  for (const entity of targetEntities.values()) {
    const fields = await loadFields(ctx, client, token, entity.logicalName, { silent: true });
    const relationships = await loadEntityRelationships(ctx, client, token, entity.logicalName, { silent: true });
    const relationshipBackedFields = new Set(
      (relationships.manyToOne ?? [])
        .map((relationship) => String(relationship.referencingAttribute ?? "").trim().toLowerCase())
        .filter((value) => !!value)
    );

    for (const field of fields) {
      const fieldLogicalName = String(field.logicalName ?? "").trim();
      if (!fieldLogicalName || fieldLogicalName.startsWith("_") || fieldLogicalName.endsWith("_value")) {
        continue;
      }

      const attributeType = String(field.attributeType ?? "").trim().toLowerCase();
      if (!SUPPORTED_ATTRIBUTE_TYPES.has(attributeType)) {
        continue;
      }

      if (relationshipBackedFields.has(fieldLogicalName.toLowerCase())) {
        continue;
      }

      const isPrimaryId = fieldLogicalName.toLowerCase() === String(entity.primaryIdAttribute ?? "").trim().toLowerCase();
      if (isPrimaryId) {
        continue;
      }

      const sameField = request.currentFieldLogicalName
        && fieldLogicalName.toLowerCase() === request.currentFieldLogicalName.trim().toLowerCase();

      if (!sameField && !looksIdentifierLike(fieldLogicalName)) {
        continue;
      }

      const score = scoreIdentifierField({
        entityLogicalName: entity.logicalName,
        fieldLogicalName,
        attributeType: field.attributeType,
        currentEntityLogicalName: currentEntity?.logicalName,
        currentFieldLogicalName: request.currentFieldLogicalName,
        primaryIdField: entity.primaryIdAttribute
      });

      candidates.push({
        entityLogicalName: entity.logicalName,
        entitySetName: entity.entitySetName,
        fieldLogicalName,
        attributeType: field.attributeType,
        isPrimaryId,
        score: score.score,
        reason: score.reason
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.entityLogicalName.localeCompare(b.entityLogicalName) || a.fieldLogicalName.localeCompare(b.fieldLogicalName));

  return {
    candidates: candidates.slice(0, investigateScope.maxSearchColumns),
    searchedEntityLogicalNames,
    missingAllowedTables: false
  };
}

