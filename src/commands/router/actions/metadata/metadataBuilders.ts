import { MetadataKind } from "./metadataTypes.js";

export function buildMetadataPath(logicalName: string, kind: MetadataKind): string {
  const ln = logicalName.replace(/'/g, "''"); // escape single quotes for OData string literal

  switch (kind) {
    case "Entity (definition)":
      return `/EntityDefinitions(LogicalName='${ln}')`;

    case "Attributes":
      return `/EntityDefinitions(LogicalName='${ln}')/Attributes?$select=LogicalName,AttributeType,IsValidForRead,IsValidForCreate,IsValidForUpdate`;

    case "Many-to-one relationships":
      return `/EntityDefinitions(LogicalName='${ln}')/ManyToOneRelationships`;

    case "One-to-many relationships":
      return `/EntityDefinitions(LogicalName='${ln}')/OneToManyRelationships`;

    case "Many-to-many relationships":
      return `/EntityDefinitions(LogicalName='${ln}')/ManyToManyRelationships`;

    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function metadataVirtualPath(logicalName: string, kind: MetadataKind): string {
  const entity = logicalName.toLowerCase();

  switch (kind) {
    case "Entity (definition)":
      return `.dvqr/${entity}/${entity}.entity.json`;

    case "Attributes":
      return `.dvqr/${entity}/${entity}.attributes.json`;

    case "Many-to-one relationships":
      return `.dvqr/${entity}/${entity}.manyToOne.json`;

    case "One-to-many relationships":
      return `.dvqr/${entity}/${entity}.oneToMany.json`;

    case "Many-to-many relationships":
      return `.dvqr/${entity}/${entity}.manyToMany.json`;

    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

// Optional (kept because you already had it; not currently used by runGetMetadataAction)
export function buildTitle(logicalName: string, kind: MetadataKind): string {
  const safeKind = kind.replace(/[^\w]+/g, "_");
  return `DVQR_Metadata_${logicalName}_${safeKind}`;
}