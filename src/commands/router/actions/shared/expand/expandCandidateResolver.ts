import type { CommandContext } from "../../../../context/commandContext.js";
import { loadNavigationProperties } from "../metadataAccess.js";
import type { ExpandCandidate } from "./expandTypes.js";

export async function resolveSiblingExpandCandidates(
  ctx: CommandContext,
  sourceEntityLogicalName: string
): Promise<ExpandCandidate[]> {
  const client = ctx.getClient();
  const token = await ctx.getToken(ctx.getScope());
  const rows = await loadNavigationProperties(ctx, client, token, sourceEntityLogicalName);

  const candidates: ExpandCandidate[] = [];
  for (const row of rows) {
    const navigationPropertyName = String(row?.navigationPropertyName ?? "").toLowerCase().trim();
    const relationshipType = String(row?.relationshipType ?? "").trim();
    if (!navigationPropertyName || relationshipType !== "ManyToOne") {
      continue;
    }

    const targetEntityLogicalName = String(row?.referencedEntity ?? row?.referencingEntity ?? "").trim();
    if (!targetEntityLogicalName || targetEntityLogicalName.toLowerCase() === sourceEntityLogicalName.toLowerCase()) {
      continue;
    }

    candidates.push({
      sourceEntityLogicalName,
      navigationPropertyName,
      targetEntityLogicalName,
      relationshipType,
      isCollection: false,
      displayLabel: navigationPropertyName,
      description: targetEntityLogicalName
    });
  }

  const dedup = new Map<string, ExpandCandidate>();
  for (const candidate of candidates) {
    dedup.set(candidate.navigationPropertyName.toLowerCase(), candidate);
  }

  return Array.from(dedup.values()).sort((a, b) => a.navigationPropertyName.localeCompare(b.navigationPropertyName));
}
