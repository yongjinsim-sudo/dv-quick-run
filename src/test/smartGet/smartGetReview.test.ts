import * as assert from "assert";
import { buildOrEditStateWithDeps } from "../../commands/router/actions/smartGet/smartGetReview.js";
import type { FilterExpr, SmartField, SmartGetState } from "../../commands/router/actions/smartGet/smartGetTypes.js";

const def = { logicalName: "contact", entitySetName: "contacts" } as any;
const fields: SmartField[] = [{ logicalName: "fullname", attributeType: "String", selectToken: "fullname" }];

suite("smartGetReview", () => {
  test("buildOrEditState builds state with selected fields and top", async () => {
    const result = await buildOrEditStateWithDeps({} as any, {
      getEntityDefs: async () => [def],
      pickEntity: async () => def,
      getSmartFields: async () => fields,
      pickFields: async () => fields,
      pickFilterField: async () => undefined,
      pickOperator: async () => undefined,
      promptFilterValue: async () => undefined,
      validateFilterValue: () => undefined,
      showError: async () => undefined,
      promptTopValue: async () => 25,
      promptOrderByValue: async () => undefined
    });

    assert.ok(result);
    assert.deepStrictEqual(result!.state, {
      entityLogicalName: "contact",
      entitySetName: "contacts",
      selectedFieldLogicalNames: ["fullname"],
      top: 25,
      filter: undefined,
      orderBy: undefined
    });
  });

  test("buildOrEditState returns undefined and shows error on invalid filter value", async () => {
    const shown: string[] = [];
    const result = await buildOrEditStateWithDeps({} as any, {
      getEntityDefs: async () => [def],
      pickEntity: async () => def,
      getSmartFields: async () => fields,
      pickFields: async () => fields,
      pickFilterField: async () => fields[0],
      pickOperator: async () => ({ kind: "binary", op: "eq" } as FilterExpr),
      promptFilterValue: async () => "bad",
      validateFilterValue: () => "Invalid filter value",
      showError: async (message) => { shown.push(message); return undefined; },
      promptTopValue: async () => 25,
      promptOrderByValue: async () => undefined
    });

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(shown, ["Invalid filter value"]);
  });

  test("buildOrEditState reuses initial filter value only for matching field", async () => {
    const initial: SmartGetState = {
      entityLogicalName: "contact",
      entitySetName: "contacts",
      selectedFieldLogicalNames: ["fullname"],
      top: 10,
      filter: { fieldLogicalName: "fullname", expr: { kind: "binary", op: "eq" }, rawValue: "Alice" }
    };

    let receivedInitial: string | undefined;
    const result = await buildOrEditStateWithDeps({} as any, {
      getEntityDefs: async () => [def],
      pickEntity: async () => def,
      getSmartFields: async () => fields,
      pickFields: async () => fields,
      pickFilterField: async () => fields[0],
      pickOperator: async () => ({ kind: "binary", op: "eq" } as FilterExpr),
      promptFilterValue: async (_field, initialValue) => { receivedInitial = initialValue; return "Alice"; },
      validateFilterValue: () => undefined,
      showError: async () => undefined,
      promptTopValue: async () => 10,
      promptOrderByValue: async () => undefined
    }, initial);

    assert.strictEqual(receivedInitial, "Alice");
    assert.strictEqual(result?.state.filter?.rawValue, "Alice");
  });
});
