export function looksLikeDataverseQuery(text: string): boolean {
  const line = text.trim();

  if (!line) {
    return false;
  }

  if (line.startsWith("//") || line.startsWith("#")) {
    return false;
  }

  const entityPattern = /^\/?[A-Za-z_][A-Za-z0-9_]*(\([^)]+\))?(\?.+)?$/;

  if (!entityPattern.test(line)) {
    return false;
  }

  if (line.includes("?$")) {
    return true;
  }

  if (/\([0-9a-fA-F-]{8,}\)/.test(line)) {
    return true;
  }

  if (/^\/?[A-Za-z_][A-Za-z0-9_]*$/.test(line) && line.length >= 4) {
    return true;
  }

  if (line.includes("?")) {
    return true;
  }

  return false;
}