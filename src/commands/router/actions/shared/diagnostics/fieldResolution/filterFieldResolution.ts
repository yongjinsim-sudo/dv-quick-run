import type { FieldDef } from '../../../../../../services/entityFieldMetadataService.js';
import type { FilterFieldResolutionResult } from './filterFieldKinds.js';
import { isLikelyNonAttributeLikeField, isPathLikeField } from './filterFieldHeuristics.js';

export function resolveFilterField(
  fieldName: string,
  fields: FieldDef[]
): FilterFieldResolutionResult {
  const normalizedFieldName = fieldName.trim();
  const normalizedLookup = normalizedFieldName.toLowerCase();

  if (isPathLikeField(normalizedFieldName)) {
    return {
      fieldName: normalizedFieldName,
      kind: 'pathLike',
      reason: 'Navigation or path-like filter syntax detected.'
    };
  }

  if (isLikelyNonAttributeLikeField(normalizedFieldName)) {
    return {
      fieldName: normalizedFieldName,
      kind: 'nonAttributeLike',
      reason: 'Likely complex, navigation, or partylist-style field.'
    };
  }

  const resolvedAttribute = fields.find(
    (field) => field.logicalName.trim().toLowerCase() === normalizedLookup
  );

  if (resolvedAttribute) {
    return {
      fieldName: normalizedFieldName,
      kind: 'attribute',
      resolvedAttribute
    };
  }

  return {
    fieldName: normalizedFieldName,
    kind: 'unknown',
    reason: 'No attribute metadata match found.'
  };
}
