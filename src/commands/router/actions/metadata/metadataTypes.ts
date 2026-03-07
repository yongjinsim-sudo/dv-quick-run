export type MetadataKind =
  | "Entity (definition)"
  | "Attributes"
  | "Many-to-one relationships"
  | "One-to-many relationships"
  | "Many-to-many relationships";

export const METADATA_KINDS: readonly MetadataKind[] = [
  "Entity (definition)",
  "Attributes",
  "Many-to-one relationships",
  "One-to-many relationships",
  "Many-to-many relationships"
];