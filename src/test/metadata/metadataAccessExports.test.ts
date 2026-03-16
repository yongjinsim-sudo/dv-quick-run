import * as assert from "assert";
import * as metadataAccess from "../../commands/router/actions/shared/metadataAccess.js";

suite("metadataAccess exports", () => {
  test("exports the expected public helper surface", () => {
    const expected = [
      "loadEntityDefs",
      "loadEntityDefByLogicalName",
      "loadEntityDefByEntitySetName",
      "findEntityByLogicalName",
      "findEntityByEntitySetName",
      "loadFields",
      "loadSelectableFields",
      "buildFieldMap",
      "findFieldByLogicalName",
      "findFieldBySelectToken",
      "loadNavigationProperties",
      "findFieldOnDirectlyRelatedEntity",
      "loadChoiceMetadata",
      "resolveChoiceValue",
      "matchChoiceLabel",
      "loadEntityRelationships",
      "clearRelationshipMetadataMemory"
    ];

    for (const key of expected) {
      assert.strictEqual(typeof (metadataAccess as any)[key], "function", `${key} should be exported`);
    }
  });
});
