import * as assert from "assert";
import {
  buildFieldMap,
  findFieldByLogicalName,
  findFieldBySelectToken
} from "../../commands/router/actions/shared/metadataAccess/metadataFieldAccess.js";
import type { FieldDef } from "../../services/entityFieldMetadataService.js";

suite("metadataFieldAccess", () => {
  test("buildFieldMap normalizes logical names", () => {
    const fields: FieldDef[] = [
      { logicalName: "FullName", attributeType: "String", isValidForRead: true } as FieldDef,
      { logicalName: "emailaddress1", attributeType: "String", isValidForRead: true } as FieldDef
    ];

    const map = buildFieldMap(fields);
    assert.strictEqual(map.get("fullname")?.logicalName, "FullName");
    assert.strictEqual(map.get("emailaddress1")?.logicalName, "emailaddress1");
  });

  test("findFieldByLogicalName matches case-insensitively", () => {
    const fields: FieldDef[] = [
      { logicalName: "statuscode", attributeType: "Status", isValidForRead: true } as FieldDef
    ];

    const match = findFieldByLogicalName(fields, " StatusCode ");
    assert.strictEqual(match?.logicalName, "statuscode");
  });

  test("findFieldBySelectToken resolves lookup backing token", () => {
    const fields: FieldDef[] = [
      { logicalName: "ownerid", attributeType: "Owner", isValidForRead: true } as FieldDef
    ];

    const match = findFieldBySelectToken(fields, "_ownerid_value");
    assert.strictEqual(match?.logicalName, "ownerid");
  });
});
