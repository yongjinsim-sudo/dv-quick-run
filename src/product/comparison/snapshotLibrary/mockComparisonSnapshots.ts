import type { ComparisonEnvironmentRef } from "../../../core/comparison/index.js";
import type { ComparisonSnapshotRegistryEntry, ComparisonSnapshotTrustState } from "../index.js";
import { cloneSnapshotsForComparison } from "./comparisonSnapshotClone.js";

interface ComparisonSnapshotFile {
  readonly environment?: ComparisonEnvironmentRef;
  readonly evidenceType?: string;
  readonly metadata?: {
    readonly capturedAtIso?: string;
  };
  readonly evidence?: unknown;
}

export interface ReadComparisonSnapshotResult {
  readonly snapshots: readonly ComparisonSnapshotFile[];
  readonly trustState: ComparisonSnapshotTrustState;
}

export const sampleSnapshots: readonly ComparisonSnapshotFile[] = [
  {
    environment: {
      label: "DEV",
      capturedAtIso: "2026-05-24T00:00:00.000Z"
    },
    evidenceType: "IdentityParticipation",
    evidence: {
      identities: [
        {
          displayName: "service_account_dev",
          isApplicationUser: true,
          roles: ["Integration Role", "Read Account"],
          teams: ["Integration Team"]
        },
        {
          displayName: "human.operator.dev@example.com",
          isApplicationUser: false,
          roles: ["System Customizer"]
        }
      ]
    }
  },
  {
    environment: {
      label: "SIT",
      capturedAtIso: "2026-05-24T00:00:00.000Z"
    },
    evidenceType: "IdentityParticipation",
    evidence: {
      identities: [
        {
          displayName: "service_account_sit",
          isApplicationUser: true,
          roles: ["Integration Role", "Read Account"],
          teams: ["Integration Team"]
        },
        {
          displayName: "service_perf_msi",
          isApplicationUser: true,
          roles: ["Automation Role"]
        }
      ]
    }
  },
  {
    environment: {
      label: "DEV",
      capturedAtIso: "2026-05-24T00:00:00.000Z"
    },
    evidenceType: "OperationalProfile",
    evidence: {
      entityLogicalName: "account",
      entityDisplayName: "Account",
      headlineBand: "moderate",
      headlineLabel: "Moderate complexity",
      dvqrScore: {
        displayScore: 42,
        band: "Moderate",
        summary: "Moderate operational density."
      },
      pluginSteps: [
        {
          sdkMessageProcessingStepId: "mock-account-create-preoperation-dev",
          name: "Account Create Validation",
          pluginTypeName: "Dvqr.Mock.Plugins.AccountValidationPlugin",
          messageName: "Create",
          primaryEntityName: "account",
          stage: 20,
          mode: 0,
          rank: 10,
          filteringAttributes: ["name", "accountnumber"],
          state: "Enabled",
          isManaged: false,
          secureConfigurationPresent: true,
          unsecureConfigurationPresent: true
        },
        {
          sdkMessageProcessingStepId: "mock-account-update-postoperation-shared",
          name: "Account Update Integration Dispatch",
          pluginTypeName: "Dvqr.Mock.Plugins.AccountIntegrationPlugin",
          messageName: "Update",
          primaryEntityName: "account",
          stage: 40,
          mode: 0,
          rank: 20,
          filteringAttributes: ["name", "telephone1"],
          state: "Enabled",
          isManaged: false,
          secureConfigurationPresent: false,
          unsecureConfigurationPresent: true
        },
        {
          sdkMessageProcessingStepId: "mock-account-legacy-background-dev-only",
          name: "Legacy Account Background Sync",
          pluginTypeName: "Dvqr.Mock.Plugins.LegacyAccountSyncPlugin",
          messageName: "Update",
          primaryEntityName: "account",
          stage: 40,
          mode: 1,
          rank: 30,
          filteringAttributes: ["address1_city"],
          state: "Enabled",
          isManaged: false,
          secureConfigurationPresent: false,
          unsecureConfigurationPresent: false
        }
      ],
      dimensions: [
        {
          id: "automation",
          label: "Automation (Plugin Steps)",
          band: "moderate",
          valueLabel: "12 synchronous plugin steps",
          evidenceStateLabel: "Moderate"
        },
        {
          id: "relationships",
          label: "Relationships",
          band: "moderate",
          valueLabel: "55 relationships",
          evidenceStateLabel: "Moderate"
        }
      ],
      workflows: [
        { name: "Account Sync Realtime", category: "workflow", mode: "realtime", state: "Deactivated", isManaged: true, owner: "Legacy" },
        { name: "Account Notify Flow", category: "flow", mode: "cloudFlow", state: "Activated", isManaged: false, owner: "Operations" },
        { name: "Legacy Account Workflow", category: "workflow", mode: "background", state: "Activated", isManaged: false, owner: "Legacy" },
        { name: "Account Consent Reminder", category: "flow", mode: "cloudFlow", state: "Activated", isManaged: false, owner: "Operations" },
        { name: "Account Address Normalisation", category: "workflow", mode: "background", state: "Activated", isManaged: false, owner: "Operations" }
      ],
      operationalContext: {
        sections: [
          {
            id: "SolutionContext",
            label: "Solution Context",
            evidence: [
              {
                evidenceType: "SolutionParticipation",
                raw: {
                  solutions: [
                    { uniqueName: "Default", friendlyName: "Default Solution", version: "1.0", isManaged: false },
                    { uniqueName: "PowerPages_RuntimeCore", friendlyName: "Power Pages Runtime Core", version: "1.0.2509.1", isManaged: true },
                    { uniqueName: "PowerPages_RuntimeCoreDependencies", friendlyName: "Power Pages Runtime Core Dependencies", version: "1.0.2305.1", isManaged: true }
                  ]
                }
              }
            ]
          }
        ]
      }
    }
  },
  {
    environment: {
      label: "SIT",
      capturedAtIso: "2026-05-24T00:00:00.000Z"
    },
    evidenceType: "OperationalProfile",
    evidence: {
      entityLogicalName: "account",
      entityDisplayName: "Account",
      headlineBand: "high",
      headlineLabel: "High complexity",
      dvqrScore: {
        displayScore: 67,
        band: "High",
        summary: "High operational density."
      },
      pluginSteps: [
        {
          sdkMessageProcessingStepId: "mock-account-create-preoperation-dev",
          name: "Account Create Validation",
          pluginTypeName: "Dvqr.Mock.Plugins.AccountValidationPlugin",
          messageName: "Create",
          primaryEntityName: "account",
          stage: 20,
          mode: 0,
          rank: 10,
          filteringAttributes: ["name", "accountnumber"],
          state: "Disabled",
          isManaged: false,
          secureConfigurationPresent: true,
          unsecureConfigurationPresent: true
        },
        {
          sdkMessageProcessingStepId: "mock-account-update-postoperation-shared",
          name: "Account Update Integration Dispatch",
          pluginTypeName: "Dvqr.Mock.Plugins.AccountIntegrationPlugin",
          messageName: "Update",
          primaryEntityName: "account",
          stage: 20,
          mode: 0,
          rank: 5,
          filteringAttributes: ["name", "telephone1", "emailaddress1"],
          state: "Enabled",
          isManaged: false,
          secureConfigurationPresent: false,
          unsecureConfigurationPresent: true
        },
        {
          sdkMessageProcessingStepId: "mock-account-sit-only-enrichment",
          name: "Account SIT Enrichment Dispatch",
          pluginTypeName: "Dvqr.Mock.Plugins.AccountEnrichmentPlugin",
          messageName: "Update",
          primaryEntityName: "account",
          stage: 40,
          mode: 1,
          rank: 40,
          filteringAttributes: ["msemr_azurefhirid"],
          state: "Enabled",
          isManaged: true,
          secureConfigurationPresent: true,
          unsecureConfigurationPresent: false
        }
      ],
      dimensions: [
        {
          id: "automation",
          label: "Automation (Plugin Steps)",
          band: "high",
          valueLabel: "28 synchronous plugin steps",
          evidenceStateLabel: "High"
        },
        {
          id: "relationships",
          label: "Relationships",
          band: "moderate",
          valueLabel: "58 relationships",
          evidenceStateLabel: "Moderate"
        },
        {
          id: "realtimeWorkflows",
          label: "Real-time Workflows",
          band: "moderate",
          valueLabel: "3 real-time workflows",
          evidenceStateLabel: "Moderate"
        }
      ],
      workflows: [
        { name: "Account Sync Realtime", category: "workflow", mode: "realtime", state: "Activated", isManaged: true, owner: "System" },
        { name: "Account Notify Flow", category: "flow", mode: "cloudFlow", state: "Activated", isManaged: false, owner: "Integration" },
        { name: "Account Enrichment Background", category: "workflow", mode: "background", state: "Activated", isManaged: false, owner: "Integration" },
        { name: "Account Consent Reminder", category: "flow", mode: "cloudFlow", state: "Activated", isManaged: false, owner: "Integration" },
        { name: "Account Address Normalisation", category: "workflow", mode: "background", state: "Activated", isManaged: false, owner: "Integration" }
      ],
      operationalContext: {
        sections: [
          {
            id: "SolutionContext",
            label: "Solution Context",
            evidence: [
              {
                evidenceType: "SolutionParticipation",
                raw: {
                  solutions: [
                    { uniqueName: "dvqr_MockOperationalAutomation", friendlyName: "DVQR Mock Operational Automation", version: "2.4.0.0", isManaged: false },
                    { uniqueName: "PowerPages_RuntimeCore", friendlyName: "Power Pages Runtime Core", version: "1.0.2509.1", isManaged: false },
                    { uniqueName: "PowerPages_RuntimeCoreDependencies", friendlyName: "Power Pages Runtime Core Dependencies", version: "1.0.9999.1", isManaged: true }
                  ]
                }
              }
            ]
          }
        ]
      }
    }
  },
  {
    environment: {
      label: "DEV",
      capturedAtIso: "2026-05-24T00:00:00.000Z"
    },
    evidenceType: "EntityMetadata",
    metadata: {
      capturedAtIso: "2026-05-24T00:00:00.000Z"
    },
    evidence: {
      metadataVersion: "entity-metadata-payload-v1",
      entities: [
        {
          metadataVersion: "entity-metadata-v1",
          logicalName: "account",
          schemaName: "Account",
          displayName: "Account",
          capturedAtIso: "2026-05-24T00:00:00.000Z",
          configuration: {
            entitySetName: "accounts",
            ownershipType: "UserOwned",
            isAuditEnabled: false,
            changeTrackingEnabled: false,
            isActivity: false,
            isCustomEntity: false,
            isManaged: true,
            isValidForAdvancedFind: true
          },
          attributes: [
            {
              logicalName: "accountcategorycode",
              schemaName: "AccountCategoryCode",
              displayName: "Category",
              attributeType: "Picklist",
              requiredLevel: "None",
              isValidForCreate: true,
              isValidForUpdate: true,
              isValidForRead: true,
              isValidForAdvancedFind: true,
              isAuditEnabled: false,
              optionSet: {
                name: "account_accountcategorycode",
                isGlobal: false,
                isMultiSelect: false,
                options: [
                  { value: 1, label: "Preferred Customer", normalizedLabel: "preferred customer" },
                  { value: 2, label: "Standard", normalizedLabel: "standard" }
                ]
              }
            },
            {
              logicalName: "customersizecode",
              schemaName: "CustomerSizeCode",
              displayName: "Customer Size",
              attributeType: "Picklist",
              requiredLevel: "None",
              isValidForCreate: true,
              isValidForUpdate: true,
              isValidForRead: true,
              isValidForAdvancedFind: false,
              isAuditEnabled: true,
              optionSet: {
                name: "account_customersizecode",
                isGlobal: false,
                isMultiSelect: false,
                options: [
                  { value: 1, label: "Default Value", normalizedLabel: "default value" }
                ]
              }
            }
          ],
          relationships: [
            {
              schemaName: "lk_accountbase_modifiedby",
              relationshipType: "ManyToOne",
              referencingEntity: "account",
              referencedEntity: "systemuser",
              referencingAttribute: "modifiedby",
              navigationPropertyName: "modifiedby"
            },
            {
              schemaName: "account_primary_contact",
              relationshipType: "ManyToOne",
              referencingEntity: "account",
              referencedEntity: "contact",
              referencingAttribute: "primarycontactid",
              navigationPropertyName: "primarycontactid"
            }
          ]
        }
      ]
    }
  },
  {
    environment: {
      label: "SIT",
      capturedAtIso: "2026-05-24T01:30:00.000Z"
    },
    evidenceType: "EntityMetadata",
    metadata: {
      capturedAtIso: "2026-05-24T01:30:00.000Z"
    },
    evidence: {
      metadataVersion: "entity-metadata-payload-v1",
      entities: [
        {
          metadataVersion: "entity-metadata-v1",
          logicalName: "account",
          schemaName: "Account",
          displayName: "Account",
          capturedAtIso: "2026-05-24T01:30:00.000Z",
          configuration: {
            entitySetName: "accounts",
            ownershipType: "UserOwned",
            isAuditEnabled: true,
            changeTrackingEnabled: true,
            isActivity: false,
            isCustomEntity: false,
            isManaged: true,
            isValidForAdvancedFind: true
          },
          attributes: [
            {
              logicalName: "accountcategorycode",
              schemaName: "AccountCategoryCode",
              displayName: "Category",
              attributeType: "Picklist",
              requiredLevel: "None",
              isValidForCreate: true,
              isValidForUpdate: true,
              isValidForRead: true,
              isValidForAdvancedFind: true,
              isAuditEnabled: true,
              optionSet: {
                name: "account_accountcategorycode",
                isGlobal: false,
                isMultiSelect: false,
                options: [
                  { value: 1, label: "Preferred Customer", normalizedLabel: "preferred customer" },
                  { value: 2, label: "Standard", normalizedLabel: "standard" }
                ]
              }
            },
            {
              logicalName: "customersizecode",
              schemaName: "CustomerSizeCode",
              displayName: "Customer Size",
              attributeType: "Picklist",
              requiredLevel: "None",
              isValidForCreate: true,
              isValidForUpdate: true,
              isValidForRead: true,
              isValidForAdvancedFind: false,
              isAuditEnabled: true,
              optionSet: {
                name: "account_customersizecode",
                isGlobal: false,
                isMultiSelect: false,
                options: [
                  { value: 1, label: "Default Value", normalizedLabel: "default value" },
                  { value: 1000000, label: "Enterprise", normalizedLabel: "enterprise" }
                ]
              }
            }
          ],
          relationships: [
            {
              schemaName: "account_primary_contact",
              relationshipType: "ManyToOne",
              referencingEntity: "account",
              referencedEntity: "contact",
              referencingAttribute: "primarycontactid",
              navigationPropertyName: "primarycontactid"
            },
            {
              schemaName: "new_account_customersegment",
              relationshipType: "ManyToOne",
              referencingEntity: "account",
              referencedEntity: "new_customersegment",
              referencingAttribute: "new_customersegmentid",
              navigationPropertyName: "new_customersegmentid"
            }
          ]
        }
      ]
    }
  }
];


const mockDevPluginStepSnapshot: ComparisonSnapshotFile = {
  environment: {
    label: "DEV",
    capturedAtIso: "2026-05-24T00:00:00.000Z"
  },
  evidenceType: "PluginStep",
  metadata: {
    capturedAtIso: "2026-05-24T00:00:00.000Z"
  },
  evidence: {
    entityLogicalName: "account",
    pluginSteps: [
      {
        sdkMessageProcessingStepId: "mock-account-create-preoperation-shared",
        name: "Account Create Validation",
        pluginTypeName: "Dvqr.Mock.Plugins.AccountValidationPlugin",
        messageName: "Create",
        primaryEntityName: "account",
        stage: 20,
        mode: 0,
        rank: 10,
        filteringAttributes: ["name", "accountnumber"],
        state: "Enabled",
        isManaged: false,
        secureConfigurationPresent: true,
        unsecureConfigurationPresent: true
      },
      {
        sdkMessageProcessingStepId: "mock-account-update-integration-shared",
        name: "Account Update Integration Dispatch",
        pluginTypeName: "Dvqr.Mock.Plugins.AccountIntegrationPlugin",
        messageName: "Update",
        primaryEntityName: "account",
        stage: 40,
        mode: 0,
        rank: 20,
        filteringAttributes: ["name", "telephone1"],
        state: "Enabled",
        isManaged: false,
        secureConfigurationPresent: false,
        unsecureConfigurationPresent: true
      },
      {
        sdkMessageProcessingStepId: "mock-account-consent-reminder-shared",
        name: "Account Consent Reminder Dispatch",
        pluginTypeName: "Dvqr.Mock.Plugins.AccountConsentPlugin",
        messageName: "Update",
        primaryEntityName: "account",
        stage: 40,
        mode: 0,
        rank: 35,
        filteringAttributes: ["emailaddress1"],
        state: "Enabled",
        isManaged: false,
        secureConfigurationPresent: false,
        unsecureConfigurationPresent: true
      },
      {
        sdkMessageProcessingStepId: "mock-account-address-normaliser-shared",
        name: "Account Address Normalisation",
        pluginTypeName: "Dvqr.Mock.Plugins.AccountAddressPlugin",
        messageName: "Update",
        primaryEntityName: "account",
        stage: 40,
        mode: 0,
        rank: 45,
        filteringAttributes: ["address1_city"],
        state: "Enabled",
        isManaged: false,
        secureConfigurationPresent: false,
        unsecureConfigurationPresent: true
      },
      {
        sdkMessageProcessingStepId: "mock-account-legacy-background-dev-only",
        name: "Legacy Account Background Sync",
        pluginTypeName: "Dvqr.Mock.Plugins.LegacyAccountSyncPlugin",
        messageName: "Update",
        primaryEntityName: "account",
        stage: 40,
        mode: 1,
        rank: 30,
        filteringAttributes: ["address1_city"],
        state: "Enabled",
        isManaged: false,
        secureConfigurationPresent: false,
        unsecureConfigurationPresent: false
      }
    ]
  }
};

const mockSitPluginStepSnapshot: ComparisonSnapshotFile = {
  environment: {
    label: "SIT",
    capturedAtIso: "2026-05-24T01:30:00.000Z"
  },
  evidenceType: "PluginStep",
  metadata: {
    capturedAtIso: "2026-05-24T01:30:00.000Z"
  },
  evidence: {
    entityLogicalName: "account",
    pluginSteps: [
      {
        sdkMessageProcessingStepId: "mock-account-create-preoperation-shared",
        name: "Account Create Validation",
        pluginTypeName: "Dvqr.Mock.Plugins.AccountValidationPlugin",
        messageName: "Create",
        primaryEntityName: "account",
        stage: 20,
        mode: 0,
        rank: 10,
        filteringAttributes: ["name", "accountnumber"],
        state: "Disabled",
        isManaged: false,
        secureConfigurationPresent: true,
        unsecureConfigurationPresent: true
      },
      {
        sdkMessageProcessingStepId: "mock-account-update-integration-shared",
        name: "Account Update Integration Dispatch",
        pluginTypeName: "Dvqr.Mock.Plugins.AccountIntegrationPlugin",
        messageName: "Update",
        primaryEntityName: "account",
        stage: 20,
        mode: 0,
        rank: 5,
        filteringAttributes: ["name", "telephone1", "emailaddress1"],
        state: "Enabled",
        isManaged: false,
        secureConfigurationPresent: false,
        unsecureConfigurationPresent: true
      },
      {
        sdkMessageProcessingStepId: "mock-account-consent-reminder-shared",
        name: "Account Consent Reminder Dispatch",
        pluginTypeName: "Dvqr.Mock.Plugins.AccountConsentPlugin",
        messageName: "Update",
        primaryEntityName: "account",
        stage: 40,
        mode: 0,
        rank: 35,
        filteringAttributes: ["emailaddress1", "telephone1"],
        state: "Enabled",
        isManaged: false,
        secureConfigurationPresent: false,
        unsecureConfigurationPresent: true
      },
      {
        sdkMessageProcessingStepId: "mock-account-address-normaliser-shared",
        name: "Account Address Normalisation",
        pluginTypeName: "Dvqr.Mock.Plugins.AccountAddressPlugin",
        messageName: "Update",
        primaryEntityName: "account",
        stage: 40,
        mode: 0,
        rank: 45,
        filteringAttributes: ["address1_city", "address1_postalcode"],
        state: "Enabled",
        isManaged: false,
        secureConfigurationPresent: false,
        unsecureConfigurationPresent: true
      },
      {
        sdkMessageProcessingStepId: "mock-account-sit-only-enrichment",
        name: "Account SIT Enrichment Dispatch",
        pluginTypeName: "Dvqr.Mock.Plugins.AccountEnrichmentPlugin",
        messageName: "Update",
        primaryEntityName: "account",
        stage: 40,
        mode: 1,
        rank: 40,
        filteringAttributes: ["msemr_azurefhirid"],
        state: "Enabled",
        isManaged: true,
        secureConfigurationPresent: true,
        unsecureConfigurationPresent: false
      }
    ]
  }
};


export const mockSnapshotRegistryEntries: readonly ComparisonSnapshotRegistryEntry[] = [
  {
    snapshotId: "dvqr-mock-timeline-account-001-baseline",
    fileUri: "dvqr-mock://timeline-account-001-baseline",
    label: "Account · Timeline Mock baseline",
    environmentLabel: "TIMELINE-MOCK",
    environmentUrl: "https://timeline-mock.crm.dynamics.com",
    entityLogicalName: "account",
    entityDisplayName: "Account",
    capturedAtIso: "2026-05-25T05:27:12.006Z",
    sourceFeature: "Mock Timeline Snapshot",
    evidenceTypes: ["EntityMetadata", "IdentityParticipation", "OperationalProfile", "PluginStep"]
  },
  {
    snapshotId: "dvqr-mock-timeline-account-002-identity",
    fileUri: "dvqr-mock://timeline-account-002-identity",
    label: "Account · Timeline Mock identity drift",
    environmentLabel: "TIMELINE-MOCK",
    environmentUrl: "https://timeline-mock.crm.dynamics.com",
    entityLogicalName: "account",
    entityDisplayName: "Account",
    capturedAtIso: "2026-06-16T06:20:23.405Z",
    sourceFeature: "Mock Timeline Snapshot",
    evidenceTypes: ["EntityMetadata", "IdentityParticipation", "OperationalProfile", "PluginStep"]
  },
  {
    snapshotId: "dvqr-mock-timeline-account-003-column",
    fileUri: "dvqr-mock://timeline-account-003-column",
    label: "Account · Timeline Mock column drift",
    environmentLabel: "TIMELINE-MOCK",
    environmentUrl: "https://timeline-mock.crm.dynamics.com",
    entityLogicalName: "account",
    entityDisplayName: "Account",
    capturedAtIso: "2026-06-16T06:31:26.106Z",
    sourceFeature: "Mock Timeline Snapshot",
    evidenceTypes: ["EntityMetadata", "IdentityParticipation", "OperationalProfile", "PluginStep"]
  },
  {
    snapshotId: "dvqr-mock-timeline-account-004-relationship",
    fileUri: "dvqr-mock://timeline-account-004-relationship",
    label: "Account · Timeline Mock relationship drift",
    environmentLabel: "TIMELINE-MOCK",
    environmentUrl: "https://timeline-mock.crm.dynamics.com",
    entityLogicalName: "account",
    entityDisplayName: "Account",
    capturedAtIso: "2026-06-16T07:23:46.723Z",
    sourceFeature: "Mock Timeline Snapshot",
    evidenceTypes: ["EntityMetadata", "IdentityParticipation", "OperationalProfile", "PluginStep"]
  },
  {
    snapshotId: "dvqr-mock-timeline-account-005-choice",
    fileUri: "dvqr-mock://timeline-account-005-choice",
    label: "Account · Timeline Mock choice drift",
    environmentLabel: "TIMELINE-MOCK",
    environmentUrl: "https://timeline-mock.crm.dynamics.com",
    entityLogicalName: "account",
    entityDisplayName: "Account",
    capturedAtIso: "2026-06-16T07:40:50.866Z",
    sourceFeature: "Mock Timeline Snapshot",
    evidenceTypes: ["EntityMetadata", "IdentityParticipation", "OperationalProfile", "PluginStep"]
  },
  {
    snapshotId: "dvqr-mock-dev-account-baseline",
    fileUri: "dvqr-mock://dev-account-baseline",
    label: "Account · DEV-MOCK baseline",
    environmentLabel: "DEV-MOCK",
    entityLogicalName: "account",
    entityDisplayName: "Account",
    capturedAtIso: "2026-05-25T00:05:25.000Z",
    sourceFeature: "Mock Operational Profile",
    evidenceTypes: ["EntityMetadata", "IdentityParticipation", "OperationalProfile", "PluginStep"]
  },
  {
    snapshotId: "dvqr-mock-sit-account-drifted",
    fileUri: "dvqr-mock://sit-account-drifted",
    label: "Account · SIT-MOCK drifted",
    environmentLabel: "SIT-MOCK",
    entityLogicalName: "account",
    entityDisplayName: "Account",
    capturedAtIso: "2026-05-25T01:30:00.000Z",
    sourceFeature: "Mock Operational Profile",
    evidenceTypes: ["EntityMetadata", "IdentityParticipation", "OperationalProfile", "PluginStep"]
  }
];

export function isMockComparisonRegistryEntry(entry: ComparisonSnapshotRegistryEntry): boolean {
  const environmentLabel = entry.environmentLabel.toUpperCase();
  const subject = (entry.entityLogicalName ?? entry.entityDisplayName ?? entry.label).toLowerCase();
  return entry.fileUri.startsWith("dvqr-mock://")
    || ((environmentLabel === "DEV-MOCK" || environmentLabel === "SIT-MOCK" || environmentLabel === "TIMELINE-MOCK")
      && subject.includes("account"));
}

export function normalizeMockComparisonRegistryEntry(entry: ComparisonSnapshotRegistryEntry): ComparisonSnapshotRegistryEntry {
  if (!isMockComparisonRegistryEntry(entry)) {
    return entry;
  }

  return {
    ...entry,
    sourceFeature: entry.sourceFeature || "Mock Operational Profile",
    evidenceTypes: [...new Set([...entry.evidenceTypes, "EntityMetadata", "PluginStep"])].sort()
  };
}

export function getMockComparisonSnapshotsForEntry(entry: ComparisonSnapshotRegistryEntry): ReadComparisonSnapshotResult | undefined {
  if (!isMockComparisonRegistryEntry(entry)) {
    return undefined;
  }

  if (entry.fileUri.includes("timeline-account-")) {
    const sequence = Number(entry.fileUri.match(/timeline-account-(\d+)/)?.[1] ?? "1");
    const useDriftedShape = sequence >= 2;
    return {
      snapshots: cloneSnapshotsForComparison([
        ...sampleSnapshots.filter((snapshot) => snapshot.environment?.label === (useDriftedShape ? "SIT" : "DEV")),
        useDriftedShape ? mockSitPluginStepSnapshot : mockDevPluginStepSnapshot
      ], entry.environmentLabel),
      trustState: sequence === 1 ? "Legacy / Unverified" : sequence === 3 ? "Modified" : "Verified"
    };
  }

  const environmentLabel = entry.environmentLabel.toUpperCase();
  if (environmentLabel === "DEV-MOCK" || entry.fileUri.includes("dev-account-baseline")) {
    return {
      snapshots: cloneSnapshotsForComparison([
        ...sampleSnapshots.filter((snapshot) => snapshot.environment?.label === "DEV"),
        mockDevPluginStepSnapshot
      ], entry.environmentLabel),
      trustState: "Verified"
    };
  }

  if (environmentLabel === "SIT-MOCK" || entry.fileUri.includes("sit-account-drifted")) {
    return {
      snapshots: cloneSnapshotsForComparison([
        ...sampleSnapshots.filter((snapshot) => snapshot.environment?.label === "SIT"),
        mockSitPluginStepSnapshot
      ], entry.environmentLabel),
      trustState: "Verified"
    };
  }

  return undefined;
}

