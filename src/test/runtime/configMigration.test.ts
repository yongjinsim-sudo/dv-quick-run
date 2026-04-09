import * as assert from "assert";
import { buildConfigMigrationPlan } from "../../runtime/configMigrationCore.js";

suite("configMigration", () => {
  test("adds product plan and traversal settings when none are configured", () => {
    const result = buildConfigMigrationPlan([
      {
        section: "productPlan",
        defaultValue: "free"
      },
      {
        section: "traversal.allowedTables",
        defaultValue: ["account", "contact"]
      },
      {
        section: "traversal.excludedTables",
        defaultValue: ["activitypointer"]
      },
      {
        section: "traversal.explainVerbosity",
        defaultValue: "verbose"
      },
      {
        section: "investigate.searchScopeTables",
        defaultValue: ["account", "contact"]
      },
      {
        section: "investigate.maxSearchTables",
        defaultValue: 10
      },
      {
        section: "investigate.maxSearchColumns",
        defaultValue: 50
      }
    ]);

    assert.deepStrictEqual(result.writes, [
      {
        section: "productPlan",
        value: "free"
      },
      {
        section: "traversal.allowedTables",
        value: ["account", "contact"]
      },
      {
        section: "traversal.excludedTables",
        value: ["activitypointer"]
      },
      {
        section: "traversal.explainVerbosity",
        value: "verbose"
      },
      {
        section: "investigate.searchScopeTables",
        value: ["account", "contact"]
      },
      {
        section: "investigate.maxSearchTables",
        value: 10
      },
      {
        section: "investigate.maxSearchColumns",
        value: 50
      }
    ]);
  });

  test("does not overwrite explicit global settings", () => {
    const result = buildConfigMigrationPlan([
      {
        section: "traversal.allowedTables",
        defaultValue: ["account", "contact"],
        globalValue: ["msemr_careplan", "contact"]
      },
      {
        section: "traversal.excludedTables",
        defaultValue: ["activitypointer"],
        globalValue: []
      }
    ]);

    assert.deepStrictEqual(result.writes, []);
    assert.deepStrictEqual(result.skipped.sort(), [
      "traversal.allowedTables",
      "traversal.excludedTables",
    ]);
  });

  test("does not overwrite explicit workspace settings", () => {
    const result = buildConfigMigrationPlan([
      {
        section: "traversal.allowedTables",
        defaultValue: ["account", "contact"],
        workspaceValue: ["account"]
      }
    ]);

    assert.deepStrictEqual(result.writes, []);
    assert.deepStrictEqual(result.skipped, ["traversal.allowedTables"]);
  });

  test("does not overwrite existing product plan", () => {
    const result = buildConfigMigrationPlan([
      {
        section: "productPlan",
        defaultValue: "free",
        globalValue: "team"
      }
    ]);

    assert.deepStrictEqual(result.writes, []);
    assert.deepStrictEqual(result.skipped, ["productPlan"]);
  });

  test("skips unsupported defaults", () => {
    const result = buildConfigMigrationPlan([
      {
        section: "traversal.allowedTables",
        defaultValue: ["account", 123]
      },
      {
        section: "traversal.excludedTables",
        defaultValue: { bad: true }
      }
    ]);

    assert.deepStrictEqual(result.writes, []);
    assert.deepStrictEqual(result.skipped.sort(), [
      "traversal.allowedTables",
      "traversal.excludedTables",
    ]);
  });

  test("adds investigate numeric defaults when none are configured", () => {
    const result = buildConfigMigrationPlan([
      {
        section: "investigate.maxSearchTables",
        defaultValue: 10
      },
      {
        section: "investigate.maxSearchColumns",
        defaultValue: 50
      }
    ]);

    assert.deepStrictEqual(result.writes, [
      {
        section: "investigate.maxSearchTables",
        value: 10
      },
      {
        section: "investigate.maxSearchColumns",
        value: 50
      }
    ]);
  });

});
