import * as assert from "assert";
import {
  buildFilterClause,
  fieldCategory,
  getFilterOperatorOptions
} from "../commands/router/actions/shared/queryMutation/filterExpressionRules.js";

suite("filterExpressionRules", () => {
  test("categorizes datetime field", () => {
    const result = fieldCategory({
      logicalName: "birthdate",
      attributeType: "DateTime"
    });

    assert.strictEqual(result, "datetime");
  });

  test("categorizes picklist as number", () => {
    const result = fieldCategory({
      logicalName: "statecode",
      attributeType: "State"
    });

    assert.strictEqual(result, "number");
  });

  test("string field includes contains operator", () => {
    const ops = getFilterOperatorOptions({
      logicalName: "fullname",
      attributeType: "String"
    });

    assert.ok(ops.some((x) => x.value.kind === "func" && x.value.fn === "contains"));
  });

  test("datetime value is not quoted", () => {
    const clause = buildFilterClause(
      { logicalName: "birthdate", attributeType: "DateTime", selectToken: "birthdate" },
      { kind: "binary", op: "eq", label: "equals", requiresValue: true },
      "1954-05-16"
    );

    assert.strictEqual(clause, "birthdate eq 1954-05-16");
  });

  test("string value is quoted and escaped", () => {
    const clause = buildFilterClause(
      { logicalName: "fullname", attributeType: "String", selectToken: "fullname" },
      { kind: "func", fn: "contains", label: "contains", requiresValue: true },
      "O'Reilly"
    );

    assert.strictEqual(clause, "contains(fullname,'O''Reilly')");
  });

  test("numeric value is not quoted", () => {
    const clause = buildFilterClause(
      { logicalName: "importsequencenumber", attributeType: "Integer", selectToken: "importsequencenumber" },
      { kind: "binary", op: "eq", label: "equals", requiresValue: true },
      "123"
    );

    assert.strictEqual(clause, "importsequencenumber eq 123");
  });
});