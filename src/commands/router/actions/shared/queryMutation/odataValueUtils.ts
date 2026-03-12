export function isGuidLike(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
}

export function odataQuoteString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

export function looksLikeBoolean(v: string): boolean {
  const t = v.trim().toLowerCase();
  return t === "true" || t === "false" || t === "1" || t === "0";
}

export function looksLikeNumber(v: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(v.trim());
}

export function looksLikeIsoDateTime(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(t|\s)\d{2}:\d{2}(:\d{2}(\.\d{1,7})?)?(z|[+\-]\d{2}:\d{2})?$/i.test(v.trim())
    || /^\d{4}-\d{2}-\d{2}$/.test(v.trim());
}