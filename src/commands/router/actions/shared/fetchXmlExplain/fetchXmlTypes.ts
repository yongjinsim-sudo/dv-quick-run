import type { ChoiceMetadataDef } from '../../../../../services/entityChoiceMetadataService.js';
import type { FieldDef } from '../../../../../services/entityFieldMetadataService.js';
import type { EntityDef } from '../../../../../utils/entitySetCache.js';
import type { FetchXmlOperatorDef } from '../../../../../shared/fetchXml/fetchXmlOperatorTypes.js';

export interface FetchXmlDocumentNode {
  kind: 'document';
  fetchAttributes: Record<string, string | undefined>;
  rootEntity: FetchXmlEntityNode;
}

export interface FetchXmlEntityNode {
  kind: 'entity';
  name: string;
  alias?: string;
  attributes: FetchXmlAttributeNode[];
  filters: FetchXmlFilterNode[];
  linkEntities: FetchXmlLinkEntityNode[];
}

export interface FetchXmlLinkEntityNode {
  kind: 'link-entity';
  name: string;
  alias?: string;
  from?: string;
  to?: string;
  linkType?: string;
  attributes: FetchXmlAttributeNode[];
  filters: FetchXmlFilterNode[];
  linkEntities: FetchXmlLinkEntityNode[];
}

export interface FetchXmlAttributeNode {
  kind: 'attribute';
  name: string;
  alias?: string;
}

export interface FetchXmlFilterNode {
  kind: 'filter';
  type?: 'and' | 'or';
  conditions: FetchXmlConditionNode[];
  childFilters: FetchXmlFilterNode[];
}

export interface FetchXmlConditionNode {
  kind: 'condition';
  attribute?: string;
  operator?: string;
  values: string[];
  entityName?: string;
}

export interface FetchXmlScopePath {
  entityPath: string[];
  aliasPath: string[];
}

export interface FetchXmlResolvedAttribute {
  node: FetchXmlAttributeNode;
  ownerEntityName: string;
  ownerAlias?: string;
  scopePath: FetchXmlScopePath;
  depth: number;
}

export interface FetchXmlResolvedCondition {
  node: FetchXmlConditionNode;
  ownerEntityName: string;
  ownerAlias?: string;
  scopePath: FetchXmlScopePath;
  filterTypePath: Array<'and' | 'or' | undefined>;
  filterGroupPath: string[];
  depth: number;
}

export interface FetchXmlResolvedEntityNode {
  kind: 'entity' | 'link-entity';
  name: string;
  alias?: string;
  from?: string;
  to?: string;
  linkType?: string;
  depth: number;
  scopePath: FetchXmlScopePath;
  attributes: FetchXmlResolvedAttribute[];
  conditions: FetchXmlResolvedCondition[];
}

export interface FetchXmlResolvedTree {
  document: FetchXmlDocumentNode;
  entities: FetchXmlResolvedEntityNode[];
  attributes: FetchXmlResolvedAttribute[];
  conditions: FetchXmlResolvedCondition[];
}

export interface FetchXmlFieldMetadataHint {
  entity?: EntityDef;
  field?: FieldDef;
  choiceMetadata?: ChoiceMetadataDef;
}

export interface FetchXmlEnrichedAttribute {
  resolved: FetchXmlResolvedAttribute;
  metadataHint?: FetchXmlFieldMetadataHint;
}

export interface FetchXmlEnrichedCondition {
  resolved: FetchXmlResolvedCondition;
  metadataHint?: FetchXmlFieldMetadataHint;
  operatorHint?: FetchXmlOperatorDef;
  resolvedValueLabels: Array<string | undefined>;
}

export interface FetchXmlEnrichedEntityNode {
  resolved: FetchXmlResolvedEntityNode;
  entity?: EntityDef;
}

export interface FetchXmlEnrichedTree {
  document: FetchXmlDocumentNode;
  entities: FetchXmlEnrichedEntityNode[];
  attributes: FetchXmlEnrichedAttribute[];
  conditions: FetchXmlEnrichedCondition[];
}

export interface FetchXmlExplainOverview {
  rootEntityName: string;
  rootEntityDisplayName?: string;
  selectedAttributeCount: number;
  linkedEntityCount: number;
  hasFilters: boolean;
  estimatedResultShapeSummary: string;
  executiveSummary: string;
}

export interface FetchXmlExplainStructureItem {
  entityName: string;
  entityAlias?: string;
  depth: number;
  selectedAttributes: string[];
  summary: string;
}

export interface FetchXmlExplainRelationshipItem {
  parentEntityName: string;
  childEntityName: string;
  childAlias?: string;
  from?: string;
  to?: string;
  linkType?: string;
  summary: string;
}

export interface FetchXmlExplainFilterGroup {
  ownerEntityName: string;
  ownerAlias?: string;
  filterType?: 'and' | 'or';
  conditionSummaries: string[];
  summary: string;
}

export interface FetchXmlExplainOperatorItem {
  operator: string;
  summary: string;
}

export interface FetchXmlExplainDiagnostic {
  severity: 'info' | 'note' | 'warning';
  code: string;
  summary: string;
}

export interface FetchXmlExplainSuggestion {
  code: string;
  summary: string;
}

export interface FetchXmlExplainModel {
  overview: FetchXmlExplainOverview;
  resultShape: string[];
  structure: FetchXmlExplainStructureItem[];
  relationships: FetchXmlExplainRelationshipItem[];
  filters: FetchXmlExplainFilterGroup[];
  operators: FetchXmlExplainOperatorItem[];
  diagnostics: FetchXmlExplainDiagnostic[];
  suggestions: FetchXmlExplainSuggestion[];
}
