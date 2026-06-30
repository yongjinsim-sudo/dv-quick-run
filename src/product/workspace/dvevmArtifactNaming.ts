import { formatDvafArtifactTimestamp, sanitizeDvafArtifactSegment } from "./dvafArtifactNaming.js";

export function buildDvevmArtifactFileName(args: {
  readonly scope?: string;
  readonly createdAt?: Date;
}): string {
  const scopeSegment = sanitizeDvafArtifactSegment(args.scope, "runtime-config");
  const timestamp = formatDvafArtifactTimestamp(args.createdAt ?? new Date());
  return `DVEVM-${scopeSegment}-${timestamp}.dvevm.json`;
}
