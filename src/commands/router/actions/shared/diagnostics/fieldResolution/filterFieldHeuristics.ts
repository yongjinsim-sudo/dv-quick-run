const NON_ATTRIBUTE_LIKE_FIELDS = new Set([
  'to',
  'cc',
  'bcc',
  'from',
  'requiredattendees',
  'optionalattendees',
  'resources'
]);

export function isPathLikeField(fieldName: string): boolean {
  return fieldName.includes('/') || fieldName.includes('.');
}

export function isLikelyNonAttributeLikeField(fieldName: string): boolean {
  return NON_ATTRIBUTE_LIKE_FIELDS.has(fieldName.trim().toLowerCase());
}