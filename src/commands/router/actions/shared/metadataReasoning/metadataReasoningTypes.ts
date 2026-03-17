import type { RelationshipType } from "../../../../../metadata/metadataModel.js";

export type MetadataReasoningClassification =
  | "Local"
  | "Direct"
  | "TwoHop"
  | "TooDeep"
  | "Ambiguous"
  | "NotFound";

export type MetadataReasoningConfidence = "High" | "Medium" | "Low";

export type MetadataRelationshipDirection = "manyToOne" | "oneToMany" | "manyToMany" | "unknown";

export type MetadataEntityStructuralRole = "core" | "junction" | "lookup" | "specialized" | "unknown";

export type MetadataReasoningRelationshipEdge = {
  fromEntity: string;
  toEntity: string;
  navigationPropertyName: string;
  relationshipType: RelationshipType;
  direction: MetadataRelationshipDirection;
  schemaName?: string;
  referencingAttribute?: string;
};

export type MetadataReasoningEntityNode = {
  logicalName: string;
  fieldLogicalNames: string[];
  outboundRelationships: MetadataReasoningRelationshipEdge[];
  structuralRole?: MetadataEntityStructuralRole;
};

export type MetadataReasoningGraph = {
  entities: Record<string, MetadataReasoningEntityNode>;
};

export type MetadataPathSegment = {
  fromEntity: string;
  toEntity: string;
  navigationPropertyName: string;
  relationshipType: RelationshipType;
  direction: MetadataRelationshipDirection;
  schemaName?: string;
  referencingAttribute?: string;
};

export type MetadataPathCandidate = {
  terminalEntity: string;
  matchedField: string;
  hopCount: number;
  pathSegments: MetadataPathSegment[];
  reasons: string[];
};

export type MetadataReasoningResolveOptions = {
  queryAssistMaxDepth?: number;
  advisoryMaxDepth?: number;
};

export type MetadataReasoningResolutionResult = {
  startEntity: string;
  targetField: string;
  classification: MetadataReasoningClassification;
  confidence: MetadataReasoningConfidence;
  matchedEntity?: string;
  matchedField?: string;
  hopCount?: number;
  bestCandidate?: MetadataPathCandidate;
  assistCandidates: MetadataPathCandidate[];
  advisoryCandidates: MetadataPathCandidate[];
  reasons: string[];
};
