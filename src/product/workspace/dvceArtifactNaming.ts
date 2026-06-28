import { formatDvafArtifactTimestamp, sanitizeDvafArtifactSegment } from "./dvafArtifactNaming.js";

export function buildDvceArtifactFileName(args: {
  readonly entityLogicalName?: string;
  readonly attributeLogicalName?: string;
  readonly optionSetName?: string;
  readonly createdAt?: Date;
}): string {
  const timestamp = formatDvafArtifactTimestamp(args.createdAt ?? new Date());
  if (args.optionSetName?.trim()) {
    const optionSetSegment = sanitizeDvafArtifactSegment(args.optionSetName, "choice");
    return `DVCE-${optionSetSegment}-${timestamp}.dvce.json`;
  }

  const entitySegment = sanitizeDvafArtifactSegment(args.entityLogicalName, "unknown-entity");
  const attributeSegment = sanitizeDvafArtifactSegment(args.attributeLogicalName, "unknown-choice");
  return `DVCE-${entitySegment}-${attributeSegment}-${timestamp}.dvce.json`;
}
