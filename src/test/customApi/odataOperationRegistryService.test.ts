import assert from "node:assert/strict";
import type { CommandContext } from "../../commands/context/commandContext.js";
import type { DataverseClient } from "../../services/dataverseClient.js";
import { ODataOperationRegistryService } from "../../customApi/odata/odataOperationRegistryService.js";

const metadata = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <Schema Namespace="Microsoft.Dynamics.CRM" xmlns="http://docs.oasis-open.org/odata/ns/edm">
      <Function Name="new_TestFunction" IsBound="false">
        <ReturnType Type="Edm.String" />
      </Function>
      <EntityContainer Name="Service">
        <FunctionImport Name="new_TestFunction" Function="Microsoft.Dynamics.CRM.new_TestFunction" />
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

function buildContext(): CommandContext {
  return {
    output: {
      appendLine: () => undefined
    },
    envContext: {},
    ext: {},
    getBaseUrl: async () => "https://example.crm.dynamics.com",
    getScope: () => "https://example.crm.dynamics.com/.default",
    getToken: async () => "token",
    getClient: () => ({})
  } as unknown as CommandContext;
}

function buildClient(callCounter: { count: number }): DataverseClient {
  return {
    getText: async () => {
      callCounter.count += 1;
      return metadata;
    }
  } as unknown as DataverseClient;
}

suite("ODataOperationRegistryService", () => {
  setup(() => {
    ODataOperationRegistryService.clearCache();
  });

  test("caches registry by normalized environment URL", async () => {
    const calls = { count: 0 };
    const service = new ODataOperationRegistryService(buildContext(), buildClient(calls), "token");

    await service.getRegistry("https://example.crm.dynamics.com/");
    await service.getRegistry("https://EXAMPLE.crm.dynamics.com");

    assert.equal(calls.count, 1);
    assert.deepEqual(ODataOperationRegistryService.getCachedEnvironmentUrls(), ["https://example.crm.dynamics.com"]);
  });

  test("clears one environment without clearing other environment registries", async () => {
    const calls = { count: 0 };
    const service = new ODataOperationRegistryService(buildContext(), buildClient(calls), "token");

    await service.getRegistry("https://one.crm.dynamics.com");
    await service.getRegistry("https://two.crm.dynamics.com");
    ODataOperationRegistryService.clearCache("https://one.crm.dynamics.com/");

    assert.deepEqual(ODataOperationRegistryService.getCachedEnvironmentUrls(), ["https://two.crm.dynamics.com"]);
  });

  test("clears all environment registries for metadata lifecycle reset", async () => {
    const calls = { count: 0 };
    const service = new ODataOperationRegistryService(buildContext(), buildClient(calls), "token");

    await service.getRegistry("https://one.crm.dynamics.com");
    await service.getRegistry("https://two.crm.dynamics.com");
    ODataOperationRegistryService.clearCache();

    assert.deepEqual(ODataOperationRegistryService.getCachedEnvironmentUrls(), []);
  });
});
