export function buildDataverseRecordUiLink(
  baseUrl: string,
  entityLogicalName: string,
  recordId: string
): string {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const encodedEntity = encodeURIComponent(entityLogicalName);
  const encodedRecordId = encodeURIComponent(`{${recordId}}`);

  return `${normalizedBaseUrl}/main.aspx?etn=${encodedEntity}&id=${encodedRecordId}&pagetype=entityrecord`;
}

function normalizeBaseUrl(url: string): string {
  return url
    .replace(/\/api\/data\/v[0-9.]+\/?$/i, "")
    .replace(/\/$/, "");
}