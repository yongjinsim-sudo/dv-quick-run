import type { CommandContext } from "../../../context/commandContext.js";
import {
  loadEntityDefByLogicalName,
  loadEntityRelationships,
  loadFields
} from "../shared/metadataAccess.js";
import { isLookupLikeAttributeType } from "../../../../metadata/metadataModel.js";

export type InvestigationFieldResolutionKind = "primaryKey" | "referenceKey" | "ownedIdentifier" | "notSupported";

export interface InvestigationFieldResolution {
  kind: InvestigationFieldResolutionKind;
  targetEntityLogicalName?: string;
  targetEntitySetName?: string;
  reason?: string;
}

export async function classifyInvestigationField(
  ctx: CommandContext,
  args: {
    entityLogicalName?: string;
    fieldLogicalName?: string;
    primaryIdField?: string;
  }
): Promise<InvestigationFieldResolution> {
  const entityLogicalName = String(args.entityLogicalName ?? "").trim();
  const fieldLogicalName = String(args.fieldLogicalName ?? "").trim();
  const primaryIdField = String(args.primaryIdField ?? "").trim();

  if (!entityLogicalName || !fieldLogicalName) {
    return { kind: "notSupported" };
  }

  if (primaryIdField && fieldLogicalName.toLowerCase() === primaryIdField.toLowerCase()) {
    return { kind: "primaryKey", reason: "matches primary id field" };
  }

  const client = ctx.getClient();
  const token = await ctx.getToken(ctx.getScope());
  const fields = await loadFields(ctx, client, token, entityLogicalName, { silent: true });
  const field = fields.find((candidate) => String(candidate.logicalName ?? "").trim().toLowerCase() === fieldLogicalName.toLowerCase());
  const attributeType = String(field?.attributeType ?? "").trim().toLowerCase();

  if (field && isLookupLikeAttributeType(attributeType)) {
    const lookupTarget = field.lookupTargets?.[0]?.trim();
    if (lookupTarget) {
      const entityDef = await loadEntityDefByLogicalName(ctx, client, token, lookupTarget);
      return {
        kind: "referenceKey",
        targetEntityLogicalName: lookupTarget,
        targetEntitySetName: entityDef?.entitySetName,
        reason: `lookup target ${lookupTarget}`
      };
    }
  }

  const relationships = await loadEntityRelationships(ctx, client, token, entityLogicalName, { silent: true });
  const relationship = (relationships.manyToOne ?? []).find((candidate) =>
    String(candidate.referencingAttribute ?? "").trim().toLowerCase() === fieldLogicalName.toLowerCase()
  );

  if (relationship?.referencedEntity) {
    const entityDef = await loadEntityDefByLogicalName(ctx, client, token, relationship.referencedEntity);
    return {
      kind: "referenceKey",
      targetEntityLogicalName: relationship.referencedEntity,
      targetEntitySetName: entityDef?.entitySetName,
      reason: `relationship target ${relationship.referencedEntity}`
    };
  }

  return {
    kind: "ownedIdentifier",
    reason: "non-lookup scalar field"
  };
}
