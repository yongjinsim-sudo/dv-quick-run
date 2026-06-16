export type ComparisonSnapshotEvidenceType =
  | "OperationalProfile"
  | "PluginStep"
  | "WorkflowParticipation"
  | "IdentityParticipation"
  | "EntityMetadata"
  | "Unknown";


export interface SnapshotOptionMetadata {
  readonly value: number | boolean;
  readonly label?: string;
  readonly normalizedLabel?: string;
  readonly color?: string;
  readonly externalValue?: string;
}

export interface SnapshotOptionSetMetadata {
  readonly name?: string;
  readonly isGlobal?: boolean;
  readonly isMultiSelect?: boolean;
  readonly defaultValue?: number | boolean;
  readonly options: readonly SnapshotOptionMetadata[];
}

export interface SnapshotAttributeMetadata {
  readonly logicalName: string;
  readonly schemaName?: string;
  readonly displayName?: string;
  readonly attributeType?: string;
  readonly requiredLevel?: string;
  readonly isValidForCreate?: boolean;
  readonly isValidForUpdate?: boolean;
  readonly isValidForRead?: boolean;
  readonly isValidForAdvancedFind?: boolean;
  readonly maxLength?: number;
  readonly precision?: number;
  readonly scale?: number;
  readonly format?: string;
  readonly targets?: readonly string[];
  readonly isSearchable?: boolean;
  readonly isAuditEnabled?: boolean;
  readonly description?: string;
  readonly optionSet?: SnapshotOptionSetMetadata;
}

export interface SnapshotRelationshipMetadata {
  readonly schemaName: string;
  readonly relationshipType: "ManyToOne" | "OneToMany" | "ManyToMany";
  readonly referencingEntity?: string;
  readonly referencedEntity?: string;
  readonly referencingAttribute?: string;
  readonly referencedAttribute?: string;
  readonly navigationPropertyName?: string;
  readonly cascadeConfiguration?: Readonly<Record<string, string>>;
  readonly intersectEntityName?: string;
  readonly associatedMenuConfiguration?: Readonly<Record<string, unknown>>;
}

export interface SnapshotEntityConfigurationMetadata {
  readonly entitySetName?: string;
  readonly ownershipType?: string;
  readonly isAuditEnabled?: boolean;
  readonly changeTrackingEnabled?: boolean;
  readonly isActivity?: boolean;
  readonly isCustomEntity?: boolean;
  readonly isManaged?: boolean;
  readonly isValidForAdvancedFind?: boolean;
}

export interface SnapshotEntityMetadata {
  readonly metadataVersion: "entity-metadata-v1";
  readonly logicalName: string;
  readonly schemaName?: string;
  readonly displayName?: string;
  readonly capturedAtIso: string;
  readonly configuration?: SnapshotEntityConfigurationMetadata;
  readonly attributes: readonly SnapshotAttributeMetadata[];
  readonly relationships: readonly SnapshotRelationshipMetadata[];
}

export interface EntityMetadataSnapshotPayload {
  readonly metadataVersion: "entity-metadata-payload-v1";
  readonly entities: readonly SnapshotEntityMetadata[];
}

export interface ComparisonEnvironmentIdentity {
  readonly environmentId?: string;
  readonly environmentUrl?: string;
  readonly label: string;
}

export interface ComparisonSnapshotMetadata {
  readonly snapshotVersion: "comparison-snapshot-v1";
  readonly capturedAtIso: string;
  readonly sourceFeature: string;
}

export interface ComparisonEvidenceSnapshot<TPayload = unknown> {
  readonly environment: ComparisonEnvironmentIdentity;
  readonly evidenceType: ComparisonSnapshotEvidenceType;
  readonly metadata: ComparisonSnapshotMetadata;
  readonly evidence: TPayload;
}

export type ComparisonSnapshotTrustState =
  | "Verified"
  | "Modified"
  | "Legacy / Unverified"
  | "Invalid";

export interface ComparisonSnapshotIntegrity {
  readonly algorithm: "sha256";
  readonly canonicalization: "dvqr-snapshot-core-v1";
  readonly contentHash: string;
}

export type ComparisonSnapshotLineageOrigin = "captured" | "imported" | "derivedComparison" | "legacy";

export interface ComparisonSnapshotLineage {
  readonly lineageVersion: "comparison-lineage-v1";
  readonly origin: ComparisonSnapshotLineageOrigin;
  readonly createdAtIso: string;
  readonly sourceFeature?: string;
  readonly parentSnapshotIds?: readonly string[];
  readonly note?: string;
}

export interface OperationalComparisonSnapshotDocument {
  readonly kind: "dvqr-operational-comparison-snapshot";
  readonly schemaVersion?: "1.0";
  readonly snapshotVersion: "comparison-snapshot-v1";
  readonly environment: ComparisonEnvironmentIdentity;
  readonly capturedAtIso: string;
  readonly sourceFeature: string;
  readonly evidenceSnapshots: readonly ComparisonEvidenceSnapshot[];
  readonly lineage?: ComparisonSnapshotLineage;
  readonly integrity?: ComparisonSnapshotIntegrity;
}

export interface ComparisonSnapshotValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
  readonly trustState: ComparisonSnapshotTrustState;
  readonly snapshots: readonly ComparisonEvidenceSnapshot[];
}
