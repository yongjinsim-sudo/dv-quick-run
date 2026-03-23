import * as assert from 'assert';
import { parseFetchXml } from '../../commands/router/actions/shared/fetchXmlExplain/fetchXmlParser.js';
import { resolveFetchXmlScopes } from '../../commands/router/actions/shared/fetchXmlExplain/fetchXmlScopeResolver.js';
import { buildFetchXmlExplainModel } from '../../commands/router/actions/shared/fetchXmlExplain/fetchXmlExplainModelBuilder.js';
import { narrateFetchXmlExplain } from '../../commands/router/actions/shared/fetchXmlExplain/fetchXmlNarrator.js';
import type { FetchXmlEnrichedTree } from '../../commands/router/actions/shared/fetchXmlExplain/fetchXmlTypes.js';

suite('fetchXmlExplain parser and scope resolver', () => {
  test('preserves nested link-entity structure and condition ownership', () => {
    const document = parseFetchXml(`
      <fetch top="10">
        <entity name="contact">
          <attribute name="fullname" />
          <filter type="and">
            <condition attribute="statecode" operator="eq" value="0" />
          </filter>
          <link-entity name="account" from="accountid" to="parentcustomerid" alias="parentAccount" link-type="outer">
            <attribute name="name" />
            <filter type="and">
              <condition attribute="statecode" operator="eq" value="0" />
            </filter>
            <link-entity name="systemuser" from="systemuserid" to="owninguser" alias="owner">
              <attribute name="fullname" />
            </link-entity>
          </link-entity>
        </entity>
      </fetch>
    `);

    const resolved = resolveFetchXmlScopes(document);

    assert.strictEqual(document.rootEntity.name, 'contact');
    assert.strictEqual(document.rootEntity.linkEntities[0]?.name, 'account');
    assert.strictEqual(document.rootEntity.linkEntities[0]?.linkEntities[0]?.name, 'systemuser');
    assert.strictEqual(resolved.entities.length, 3);
    assert.strictEqual(resolved.conditions.length, 2);
    assert.strictEqual(resolved.conditions[0]?.ownerEntityName, 'contact');
    assert.strictEqual(resolved.conditions[1]?.ownerEntityName, 'account');
    assert.deepStrictEqual(resolved.entities[2]?.scopePath.entityPath, ['contact', 'account', 'systemuser']);
  });



  test('keeps sibling filter groups separate within the same entity scope', () => {
    const document = parseFetchXml(`
      <fetch>
        <entity name="contact">
          <filter type="and">
            <condition attribute="statecode" operator="eq" value="0" />
          </filter>
          <filter type="or">
            <condition attribute="firstname" operator="eq" value="A" />
            <condition attribute="lastname" operator="eq" value="B" />
          </filter>
        </entity>
      </fetch>
    `);

    const resolved = resolveFetchXmlScopes(document);
    const enriched: FetchXmlEnrichedTree = {
      document,
      entities: resolved.entities.map((entityNode) => ({
        resolved: entityNode,
        entity: { logicalName: entityNode.name, displayName: 'Contact' } as any
      })),
      attributes: [],
      conditions: resolved.conditions.map((conditionNode) => ({
        resolved: conditionNode,
        metadataHint: {
          field: {
            logicalName: conditionNode.node.attribute ?? 'unknown',
            displayName: conditionNode.node.attribute ?? 'unknown'
          } as any
        },
        operatorHint: {
          name: 'eq',
          description: 'Matches values exactly.',
          labels: { polished: 'Equals', raw: 'Equals' }
        } as any,
        resolvedValueLabels: []
      }))
    };

    const model = buildFetchXmlExplainModel(enriched);

    assert.strictEqual(model.filters.length, 2);
    assert.strictEqual(model.filters[0]?.filterType, 'and');
    assert.strictEqual(model.filters[1]?.filterType, 'or');
    assert.ok(model.filters[0]?.conditionSummaries.some((item) => item.includes('`statecode`')));
    assert.ok(model.filters[1]?.conditionSummaries.some((item) => item.includes('`firstname`')));
    assert.ok(model.filters[1]?.conditionSummaries.some((item) => item.includes('`lastname`')));
  });


  test('throws for mismatched closing tags in malformed FetchXML', () => {
    assert.throws(
      () => parseFetchXml(`
        <fetch>
          <entity name="contact">
            <filter>
              <condition attribute="statecode" operator="eq" value="0" />
            </entity>
          </filter>
        </fetch>
      `),
      /Mismatched closing tag <\/entity>.*Expected <\/filter>/,
    );
  });

  test('throws when FetchXML is missing a closing tag', () => {
    assert.throws(
      () => parseFetchXml(`
        <fetch>
          <entity name="contact">
            <filter>
              <condition attribute="statecode" operator="eq" value="0" />
            </filter>
      `),
      /Malformed FetchXML: missing closing tag <\/entity>/
    );
  });

  test('builds a narrative executive summary and result shape section', () => {
    const rawFetchXml = `
      <fetch distinct="true">
        <entity name="contact">
          <attribute name="fullname" />
          <filter>
            <condition attribute="statecode" operator="eq" value="0" />
          </filter>
          <link-entity name="account" from="accountid" to="parentcustomerid" alias="parentAccount" link-type="outer">
            <attribute name="name" />
          </link-entity>
        </entity>
      </fetch>
    `;

    const document = parseFetchXml(rawFetchXml);
    const resolved = resolveFetchXmlScopes(document);
    const enriched: FetchXmlEnrichedTree = {
      document,
      entities: resolved.entities.map((entityNode) => ({
        resolved: entityNode,
        entity: { logicalName: entityNode.name, displayName: entityNode.name === 'contact' ? 'Contact' : 'Account' } as any
      })),
      attributes: resolved.attributes.map((attributeNode) => ({
        resolved: attributeNode,
        metadataHint: {
          field: {
            logicalName: attributeNode.node.name,
            displayName: attributeNode.node.name === 'fullname' ? 'Full Name' : 'Account Name'
          } as any
        }
      })),
      conditions: resolved.conditions.map((conditionNode) => ({
        resolved: conditionNode,
        metadataHint: {
          field: { logicalName: 'statecode', displayName: 'Status' } as any
        },
        operatorHint: {
          name: 'eq',
          description: 'Matches values exactly.',
          labels: { polished: 'Equals', raw: 'Equals' }
        } as any,
        resolvedValueLabels: ['Active']
      }))
    };

    const model = buildFetchXmlExplainModel(enriched);
    const markdown = narrateFetchXmlExplain(document, model, rawFetchXml);

    assert.match(model.overview.executiveSummary, /retrieves filtered contact/i);
    assert.ok(model.resultShape.some((line) => line.includes('Each result row is anchored on the root entity')));
    assert.match(markdown, /## Result Shape/);
    assert.match(markdown, /`0` \(Active\)/);
    assert.match(markdown, /including `parentAccount`/);
  });
});
