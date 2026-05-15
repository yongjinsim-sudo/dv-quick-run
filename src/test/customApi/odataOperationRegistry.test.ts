import assert from "node:assert/strict";
import { suite, test } from "mocha";
import { parseODataOperationRegistry } from "../../customApi/odata/odataMetadataParser.js";
import { applyCustomApiExecutionEligibility, resolveCustomApiExecutionEligibility } from "../../customApi/odata/odataOperationEligibility.js";
import type { CustomApiDefinition } from "../../customApi/models/customApiTypes.js";

function buildDefinition(overrides: Partial<CustomApiDefinition> = {}): CustomApiDefinition {
  return {
    id: "api-1",
    uniqueName: "new_TestFunction",
    displayName: "Test Function",
    operationKind: "Function",
    bindingKind: "Unbound",
    requestParameters: [],
    responseProperties: [],
    executionReadiness: "preview-ready",
    executionReadinessLabel: "Preview-ready",
    executionReadinessReason: "All parameters are preview-ready.",
    ...overrides
  };
}

const metadata = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <Schema Namespace="Microsoft.Dynamics.CRM" xmlns="http://docs.oasis-open.org/odata/ns/edm">
      <Function Name="new_TestFunction" IsBound="false">
        <ReturnType Type="Edm.String" />
      </Function>
      <Action Name="new_TestAction" IsBound="false" />
      <Function Name="new_DefinitionOnly" IsBound="false">
        <ReturnType Type="Edm.String" />
      </Function>
      <Function Name="new_BoundFunction" IsBound="true">
        <Parameter Name="entity" Type="Microsoft.Dynamics.CRM.account" />
      </Function>
      <EntityContainer Name="Service">
        <FunctionImport Name="new_TestFunction" Function="Microsoft.Dynamics.CRM.new_TestFunction" />
        <ActionImport Name="new_TestAction" Action="Microsoft.Dynamics.CRM.new_TestAction" />
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

suite("odataOperationRegistry", () => {
  test("parses FunctionImport, ActionImport, Function and Action definitions", () => {
    const registry = parseODataOperationRegistry(metadata);

    assert.ok(registry.operations.some((operation) => operation.kind === "Function" && operation.importName === "new_TestFunction"));
    assert.ok(registry.operations.some((operation) => operation.kind === "Action" && operation.importName === "new_TestAction"));
    assert.ok(registry.operations.some((operation) => operation.kind === "Function" && operation.name === "new_BoundFunction" && operation.bindingKind === "Bound"));
  });

  test("marks matching unbound function as executable", () => {
    const registry = parseODataOperationRegistry(metadata);
    const eligibility = resolveCustomApiExecutionEligibility(buildDefinition(), registry);

    assert.equal(eligibility.state, "executable");
    assert.equal(eligibility.odataQualifiedName, "Microsoft.Dynamics.CRM.new_TestFunction");
    assert.equal(eligibility.odataInvocationName, "new_TestFunction");
  });

  test("marks matching public unbound ActionImport as executable eligibility", () => {
    const registry = parseODataOperationRegistry(metadata);
    const eligibility = resolveCustomApiExecutionEligibility(buildDefinition({
      uniqueName: "new_TestAction",
      operationKind: "Action"
    }), registry);

    assert.equal(eligibility.state, "executable");
    assert.equal(eligibility.odataKind, "Action");
    assert.equal(eligibility.odataQualifiedName, "Microsoft.Dynamics.CRM.new_TestAction");
    assert.equal(eligibility.odataInvocationName, "new_TestAction");
  });

  test("keeps private Actions inspect-only before OData execution eligibility", () => {
    const registry = parseODataOperationRegistry(metadata);
    const eligibility = resolveCustomApiExecutionEligibility(buildDefinition({
      uniqueName: "new_TestAction",
      operationKind: "Action",
      isPrivate: true
    }), registry);

    assert.equal(eligibility.state, "preview-only-private");
  });

  test("marks unbound operation definitions without imports as preview-only", () => {
    const registry = parseODataOperationRegistry(metadata);
    const eligibility = resolveCustomApiExecutionEligibility(buildDefinition({ uniqueName: "new_DefinitionOnly" }), registry);

    assert.equal(eligibility.state, "preview-only-not-found");
  });

  test("marks missing operation as preview-only metadata", () => {
    const registry = parseODataOperationRegistry(metadata);
    const eligibility = resolveCustomApiExecutionEligibility(buildDefinition({ uniqueName: "new_NotInOData" }), registry);

    assert.equal(eligibility.state, "preview-only-not-found");
  });

  test("attaches central execution capability when applying eligibility", () => {
    const registry = parseODataOperationRegistry(metadata);
    const [definition] = applyCustomApiExecutionEligibility([buildDefinition()], registry);

    assert.equal(definition.executionEligibility?.state, "executable");
    assert.equal(definition.executionCapability?.mode, "executable");
    assert.equal(definition.executionCapability?.canExecute, true);
  });

  test("marks unsupported parameter APIs as preview-only before OData execution", () => {
    const registry = parseODataOperationRegistry(metadata);
    const eligibility = resolveCustomApiExecutionEligibility(buildDefinition({
      executionReadiness: "inspect-only",
      requestParameters: [{ uniqueName: "Target", typeLabel: "Entity", executionSupport: "inspect-only" }]
    }), registry);

    assert.equal(eligibility.state, "preview-only-unsupported-parameters");
  });
});
