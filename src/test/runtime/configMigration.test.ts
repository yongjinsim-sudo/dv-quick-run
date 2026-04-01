import * as assert from "assert";
import { buildTraversalConfigMigrationPlan } from "../../runtime/configMigrationCore.js";

suite("configMigration", () => {
  test("adds product plan and traversal settings when none are configured", () => {
    const result = buildTraversalConfigMigrationPlan([
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
      }
    ]);
  });

  test("does not overwrite explicit global settings", () => {
    const result = buildTraversalConfigMigrationPlan([
      {
        section: "traversal.allowedTables",
        defaultValue: ["account", "contact"],
        globalValue: ["msemr_careplan", "contact"]
      },
      {
        section: "traversal.excludedTables",
        defaultValue: ["activitypointer"],
        globalValue: []
      },
      {
        section: "traversal.explainVerbosity",
        defaultValue: "verbose",
        globalValue: "minimal"
      }
    ]);

    assert.deepStrictEqual(result.writes, []);
    assert.deepStrictEqual(result.skipped.sort(), [
      "traversal.allowedTables",
      "traversal.excludedTables",
      "traversal.explainVerbosity"
    ]);
  });

  test("does not overwrite explicit workspace settings", () => {
    const result = buildTraversalConfigMigrationPlan([
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
    const result = buildTraversalConfigMigrationPlan([
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
    const result = buildTraversalConfigMigrationPlan([
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
      "traversal.explainVerbosity"
    ]);
  });
});
