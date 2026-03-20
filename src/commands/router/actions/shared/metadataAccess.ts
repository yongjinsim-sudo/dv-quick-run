export type { MetadataLoadOptions } from "./metadataAccess/metadataAccessCommon.js";
export type { RelationshipHit } from "./metadataAccess/metadataNavigationAccess.js";
import type { CommandContext } from "../../../context/commandContext.js";
import { loadEntityDefByLogicalName } from "./metadataAccess/metadataEntityAccess.js";

export {
  loadEntityDefs,
  loadEntityDefByLogicalName,
  loadEntityDefByEntitySetName,
  findEntityByLogicalName,
  findEntityByEntitySetName
} from "./metadataAccess/metadataEntityAccess.js";

export {
  loadFields,
  loadSelectableFields,
  buildFieldMap,
  findFieldByLogicalName,
  findFieldBySelectToken
} from "./metadataAccess/metadataFieldAccess.js";

export {
  loadNavigationProperties,
  findFieldOnDirectlyRelatedEntity
} from "./metadataAccess/metadataNavigationAccess.js";

export {
  loadChoiceMetadata,
  resolveChoiceValue,
  matchChoiceLabel
} from "./metadataAccess/metadataChoiceAccess.js";

export {
  loadEntityRelationships,
  clearRelationshipMetadataMemory
} from "./metadataAccess/metadataRelationshipAccess.js";

export async function getEntitySetNameByLogicalName(
  logicalName: string,
  ctx: CommandContext
): Promise<string | undefined> {
  const client = ctx.getClient();
  const token = await ctx.getToken(ctx.getScope());

  const entity = await loadEntityDefByLogicalName(ctx, client, token, logicalName);

  return entity?.entitySetName;
}
