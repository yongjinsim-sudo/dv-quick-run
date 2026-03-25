import type { FieldDef } from '../../../../../../services/entityFieldMetadataService.js';

export type FilterFieldKind = 'attribute' | 'unknown' | 'nonAttributeLike' | 'pathLike';

export interface FilterFieldResolutionResult {
  fieldName: string;
  kind: FilterFieldKind;
  resolvedAttribute?: FieldDef;
  reason?: string;
}
