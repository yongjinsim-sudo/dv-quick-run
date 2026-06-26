import { formatDvafArtifactTimestamp, sanitizeDvafArtifactSegment } from "./dvafArtifactNaming.js";

export function buildDvimArtifactFileName(args: {
  readonly subjectLabel?: string;
  readonly createdAt?: Date;
}): string {
  const subjectSegment = sanitizeDvafArtifactSegment(args.subjectLabel, "identity-participation");
  const timestamp = formatDvafArtifactTimestamp(args.createdAt ?? new Date());
  return `DVIM-${subjectSegment}-${timestamp}.dvim.json`;
}
