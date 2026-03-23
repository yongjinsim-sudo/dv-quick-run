import type { CommandContext } from '../../../../context/commandContext.js';
import { loadChoiceMetadata, loadEntityDefByLogicalName, loadFields } from '../metadataAccess.js';
import { resolveChoiceValueFromMetadata } from '../valueAwareness.js';
import { findFetchXmlOperator } from '../../../../../shared/fetchXml/fetchXmlOperatorCatalog.js';
import {
  FetchXmlEnrichedAttribute,
  FetchXmlEnrichedCondition,
  FetchXmlEnrichedEntityNode,
  FetchXmlEnrichedTree,
  FetchXmlResolvedTree
} from './fetchXmlTypes.js';
import type { ChoiceMetadataDef } from '../../../../../services/entityChoiceMetadataService.js';
import type { EntityDef } from '../../../../../utils/entitySetCache.js';
import type { FieldDef } from '../../../../../services/entityFieldMetadataService.js';

type EntityMetadataBundle = {
  entity?: EntityDef;
  fieldsByLogicalName: Map<string, FieldDef>;
  choices: ChoiceMetadataDef[];
  choicesByFieldLogicalName: Map<string, ChoiceMetadataDef>;
};

function normalizeKey(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function buildFieldLookup(fields: FieldDef[]): Map<string, FieldDef> {
  return new Map(fields.map((field) => [normalizeKey(field.logicalName), field]));
}

function buildChoiceLookup(choices: ChoiceMetadataDef[]): Map<string, ChoiceMetadataDef> {
  return new Map(choices.map((choice) => [normalizeKey(choice.fieldLogicalName), choice]));
}

async function loadEntityMetadataBundle(
  ctx: CommandContext,
  entityName: string,
  token: string
): Promise<[string, EntityMetadataBundle]> {
  const client = ctx.getClient();
  const entityKey = normalizeKey(entityName);

  try {
    const [entity, fields, choices] = await Promise.all([
      loadEntityDefByLogicalName(ctx, client, token, entityName),
      loadFields(ctx, client, token, entityName, { silent: true }),
      loadChoiceMetadata(ctx, client, token, entityName, { silent: true })
    ]);

    return [
      entityKey,
      {
        entity,
        fieldsByLogicalName: buildFieldLookup(fields),
        choices,
        choicesByFieldLogicalName: buildChoiceLookup(choices)
      }
    ];
  } catch {
    return [
      entityKey,
      {
        entity: undefined,
        fieldsByLogicalName: new Map(),
        choices: [],
        choicesByFieldLogicalName: new Map()
      }
    ];
  }
}

function getEntityMetadataBundle(
  metadataByEntity: Map<string, EntityMetadataBundle>,
  entityName: string | undefined
): EntityMetadataBundle | undefined {
  return metadataByEntity.get(normalizeKey(entityName));
}

export async function enrichFetchXmlTree(
  ctx: CommandContext,
  tree: FetchXmlResolvedTree
): Promise<FetchXmlEnrichedTree> {
  const token = await ctx.getToken(ctx.getScope());

  const distinctEntityNames = [...new Set(tree.entities.map((entityNode) => entityNode.name))];
  const metadataEntries = await Promise.all(
    distinctEntityNames.map((entityName) => loadEntityMetadataBundle(ctx, entityName, token))
  );
  const metadataByEntity = new Map<string, EntityMetadataBundle>(metadataEntries);

  const entities: FetchXmlEnrichedEntityNode[] = tree.entities.map((entityNode) => ({
    resolved: entityNode,
    entity: getEntityMetadataBundle(metadataByEntity, entityNode.name)?.entity
  }));

  const attributes: FetchXmlEnrichedAttribute[] = tree.attributes.map((attribute) => {
    const ownerMetadata = getEntityMetadataBundle(metadataByEntity, attribute.ownerEntityName);
    const field = ownerMetadata?.fieldsByLogicalName.get(normalizeKey(attribute.node.name));
    const choiceMetadata = ownerMetadata?.choicesByFieldLogicalName.get(normalizeKey(attribute.node.name));

    return {
      resolved: attribute,
      metadataHint: {
        entity: ownerMetadata?.entity,
        field,
        choiceMetadata
      }
    };
  });

  const conditions: FetchXmlEnrichedCondition[] = tree.conditions.map((condition) => {
    const ownerMetadata = getEntityMetadataBundle(metadataByEntity, condition.ownerEntityName);
    const attributeName = condition.node.attribute;
    const field = attributeName
      ? ownerMetadata?.fieldsByLogicalName.get(normalizeKey(attributeName))
      : undefined;
    const choiceMetadata = attributeName
      ? ownerMetadata?.choicesByFieldLogicalName.get(normalizeKey(attributeName))
      : undefined;

    const resolvedValueLabels = attributeName
      ? condition.node.values.map((value) => resolveChoiceValueFromMetadata(ownerMetadata?.choices ?? [], attributeName, value)?.option.label)
      : [];

    return {
      resolved: condition,
      metadataHint: {
        entity: ownerMetadata?.entity,
        field,
        choiceMetadata
      },
      operatorHint: condition.node.operator ? findFetchXmlOperator(condition.node.operator) : undefined,
      resolvedValueLabels
    };
  });

  return {
    document: tree.document,
    entities,
    attributes,
    conditions
  };
}
