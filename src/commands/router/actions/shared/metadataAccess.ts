export type { MetadataLoadOptions } from "./metadataAccess/metadataAccessCommon.js";
export type { RelationshipHit } from "./metadataAccess/metadataNavigationAccess.js";

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
