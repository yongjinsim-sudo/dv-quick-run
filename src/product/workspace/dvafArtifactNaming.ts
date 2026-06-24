function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

export function formatDvafArtifactTimestamp(date: Date): string {
  return [
    date.getFullYear().toString(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join("");
}

export function sanitizeDvafArtifactSegment(value: string | undefined, fallback: string): string {
  const cleaned = value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return cleaned || fallback;
}

export function buildDvafArtifactFileName(args: {
  readonly entityLogicalName?: string;
  readonly createdAt?: Date;
}): string {
  const entitySegment = sanitizeDvafArtifactSegment(args.entityLogicalName, "unknown-entity");
  const timestamp = formatDvafArtifactTimestamp(args.createdAt ?? new Date());
  return `DVAF-${entitySegment}-${timestamp}.dvaf.json`;
}
