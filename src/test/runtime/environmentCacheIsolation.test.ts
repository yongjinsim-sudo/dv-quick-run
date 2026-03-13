import * as assert from "assert";
import { toEnvironmentCachePrefix } from "../../utils/environmentCacheKey.js";
import { getCachedEntityDefs, setCachedEntityDefs } from "../../utils/entitySetCache.js";
import { getCachedFields, setCachedFields } from "../../utils/entityFieldCache.js";
import { getCachedChoiceMetadata, setCachedChoiceMetadata } from "../../utils/entityChoiceCache.js";
import { getCachedNavigationProperties, setCachedNavigationProperties } from "../../utils/entityRelationshipCache.js";

type FakeMemento = {
  values: Record<string, unknown>;
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): Promise<void>;
};

function makeMemento(seed: Record<string, unknown> = {}): FakeMemento {
  return {
    values: { ...seed },
    get<T>(key: string): T | undefined {
      return this.values[key] as T | undefined;
    },
    async update(key: string, value: unknown): Promise<void> {
      if (typeof value === "undefined") {
        delete this.values[key];
        return;
      }

      this.values[key] = value;
    }
  };
}

function makeExtensionContext() {
  return {
    globalState: makeMemento(),
    workspaceState: makeMemento()
  } as any;
}

suite("environmentCacheIsolation", () => {
  test("normalizes environment names into stable prefixes", () => {
    assert.strictEqual(toEnvironmentCachePrefix(" DEV "), "dev");
    assert.strictEqual(toEnvironmentCachePrefix("UAT West"), "uat-west");
    assert.strictEqual(toEnvironmentCachePrefix("Prod/APAC"), "prod-apac");
  });

  test("entity definition cache is isolated by environment name", async () => {
    const ctx = makeExtensionContext();
    const devDefs = [{ logicalName: "account", entitySetName: "accounts" }];
    const uatDefs = [{ logicalName: "contact", entitySetName: "contacts" }];

    await setCachedEntityDefs(ctx, "DEV", devDefs as any);
    await setCachedEntityDefs(ctx, "UAT", uatDefs as any);

    assert.deepStrictEqual(getCachedEntityDefs(ctx, "DEV"), devDefs);
    assert.deepStrictEqual(getCachedEntityDefs(ctx, "UAT"), uatDefs);
  });

  test("field metadata cache is isolated by environment and entity", async () => {
    const ctx = makeExtensionContext();
    const devFields = [{ logicalName: "name" }];
    const uatFields = [{ logicalName: "fullname" }];

    await setCachedFields(ctx, "DEV", "account", devFields as any);
    await setCachedFields(ctx, "UAT", "account", uatFields as any);

    assert.deepStrictEqual(getCachedFields(ctx, "DEV", "account"), devFields as any);
    assert.deepStrictEqual(getCachedFields(ctx, "UAT", "account"), uatFields as any);
    assert.strictEqual(getCachedFields(ctx, "DEV", "contact"), undefined);
  });

  test("choice metadata cache is isolated by environment", async () => {
    const ctx = makeExtensionContext();
    const devChoices = [{ value: 1, label: "Active" }];
    const prodChoices = [{ value: 1, label: "Enabled" }];

    await setCachedChoiceMetadata(ctx, "DEV", "statuscode", devChoices as any);
    await setCachedChoiceMetadata(ctx, "PROD", "statuscode", prodChoices as any);

    assert.deepStrictEqual(getCachedChoiceMetadata(ctx, "DEV", "statuscode"), devChoices as any);
    assert.deepStrictEqual(getCachedChoiceMetadata(ctx, "PROD", "statuscode"), prodChoices as any);
  });

  test("relationship metadata cache is isolated by environment", async () => {
    const ctx = makeExtensionContext();
    const devNav = [{ name: "primarycontactid", targetLogicalName: "contact" }];
    const sitNav = [{ name: "parentcustomerid_account", targetLogicalName: "account" }];

    await setCachedNavigationProperties(ctx, "DEV", "account", devNav as any);
    await setCachedNavigationProperties(ctx, "SIT", "account", sitNav as any);

    assert.deepStrictEqual(getCachedNavigationProperties(ctx, "DEV", "account"), devNav as any);
    assert.deepStrictEqual(getCachedNavigationProperties(ctx, "SIT", "account"), sitNav as any);
  });
});
