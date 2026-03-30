import * as assert from "assert";
import type { CommandContext } from "../../commands/context/commandContext.js";
import { clearMetadataSessionCache, setNavigationMemory } from "../../commands/router/actions/shared/metadataAccess/metadataSessionCache.js";
import { resolveSiblingExpandCandidates } from "../../commands/router/actions/shared/expand/expandCandidateResolver.js";

function createStubContext(): CommandContext {
  return {
    ext: {} as CommandContext["ext"],
    output: {
      append: () => undefined,
      appendLine: () => undefined,
      clear: () => undefined,
      dispose: () => undefined,
      hide: () => undefined,
      name: "DV Quick Run",
      replace: () => undefined,
      show: () => undefined
    },
    envContext: {
      getEnvironmentName: () => "TEST",
      getBaseUrl: () => "https://example.crm.dynamics.com",
      getScope: () => "https://example.crm.dynamics.com/.default",
      getActiveEnvironment: () => ({ name: "TEST", url: "https://example.crm.dynamics.com" })
    } as CommandContext["envContext"],
    getBaseUrl: async () => "https://example.crm.dynamics.com",
    getScope: () => "https://example.crm.dynamics.com/.default",
    getToken: async () => "token",
    getClient: () => ({}) as any
  };
}

suite("expandCandidateResolver", () => {
  teardown(() => {
    clearMetadataSessionCache();
  });

  test("returns only direct many-to-one enrichment candidates and deduplicates them", async () => {
    setNavigationMemory("contact", [
      {
        navigationPropertyName: "createdby",
        relationshipType: "ManyToOne",
        referencedEntity: "systemuser"
      },
      {
        navigationPropertyName: "CreatedBy",
        relationshipType: "ManyToOne",
        referencedEntity: "systemuser"
      },
      {
        navigationPropertyName: "parentcustomerid_account",
        relationshipType: "ManyToOne",
        referencedEntity: "account"
      },
      {
        navigationPropertyName: "contact_accounts",
        relationshipType: "OneToMany",
        referencedEntity: "account"
      },
      {
        navigationPropertyName: "selfref",
        relationshipType: "ManyToOne",
        referencedEntity: "contact"
      }
    ]);

    const candidates = await resolveSiblingExpandCandidates(createStubContext(), "contact");

    assert.deepStrictEqual(
      candidates.map((candidate) => candidate.navigationPropertyName),
      ["createdby", "parentcustomerid_account"]
    );
    assert.strictEqual(candidates[0]?.targetEntityLogicalName, "systemuser");
    assert.strictEqual(candidates[1]?.targetEntityLogicalName, "account");
  });
});
