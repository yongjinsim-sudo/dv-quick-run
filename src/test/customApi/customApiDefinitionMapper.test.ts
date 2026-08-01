import * as assert from "assert";
import { mapCustomApiDefinitions } from "../../customApi/discovery/customApiDefinitionMapper.js";

suite("customApiDefinitionMapper", () => {
  test("maps a shared Custom API metadata snapshot deterministically", () => {
    const definitions = mapCustomApiDefinitions(
      [{ customapiid: "api-1", uniquename: "new_GetSummary", displayname: "Get Summary", isfunction: true, bindingtype: 0 }],
      [{ customapirequestparameterid: "p-1", _customapiid_value: "api-1", uniquename: "RecordId", type: 12, isoptional: false }],
      [{ customapiresponsepropertyid: "r-1", _customapiid_value: "api-1", uniquename: "Summary", type: 10 }]
    );
    assert.strictEqual(definitions.length, 1);
    assert.strictEqual(definitions[0].operationKind, "Function");
    assert.strictEqual(definitions[0].bindingKind, "Unbound");
    assert.strictEqual(definitions[0].requestParameters[0].uniqueName, "RecordId");
    assert.strictEqual(definitions[0].responseProperties[0].uniqueName, "Summary");
  });
});
