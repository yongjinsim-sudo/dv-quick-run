import * as assert from "assert";
import type { CustomApiDefinition } from "../../customApi/models/customApiTypes.js";
import { McpCustomApiExecutionApplicationService } from "../../mcp/mcpCustomApiExecutionApplicationService.js";
import { McpCustomApiExecutionPreviewApplicationService } from "../../mcp/mcpCustomApiExecutionPreviewApplicationService.js";
import { McpCustomApiExecutionPreviewSessionStore } from "../../mcp/mcpCustomApiExecutionPreviewSessionStore.js";
import type { McpCustomApiApplicationService } from "../../mcp/mcpCustomApiApplicationService.js";
import type { DvqrMcpRuntimeConfiguration } from "../../mcp/mcpRuntimeConfiguration.js";

const config = {
  environmentUrl: "https://example.crm6.dynamics.com",
  requestTimeoutMs: 30000
} as DvqrMcpRuntimeConfiguration;

function definition(overrides: Partial<CustomApiDefinition> = {}): CustomApiDefinition {
  return {
    id: "1",
    uniqueName: "AIReply",
    description: "Draft a response to supplied text",
    operationKind: "Action",
    bindingKind: "Unbound",
    boundTargetKind: "none",
    isPrivate: false,
    requestParameters: [{ uniqueName: "Text", typeLabel: "Edm.String", isOptional: false }],
    responseProperties: [{ uniqueName: "PreparedResponse", typeLabel: "Edm.String" }],
    ...overrides
  };
}

function services(item: CustomApiDefinition, options?: { now?: () => number; ttlMs?: number }) {
  const definitions = {
    resolveDefinition: async () => ({
      environmentUrl: config.environmentUrl,
      uniqueName: item.uniqueName,
      definition: item,
      invocation: null,
      catalogue: [item]
    })
  } as unknown as McpCustomApiApplicationService;
  let sequence = 0;
  const store = new McpCustomApiExecutionPreviewSessionStore(
    options?.ttlMs ?? 10 * 60 * 1000,
    options?.now ?? (() => Date.now()),
    () => `dvqr-preview-test-${++sequence}`
  );
  return {
    store,
    preview: new McpCustomApiExecutionPreviewApplicationService(config, definitions, store)
  };
}

async function previewId(service: McpCustomApiExecutionPreviewApplicationService, uniqueName: string, parameters: Record<string, unknown>) {
  const result = await service.preview({ uniqueName, parameters });
  assert.strictEqual(result.ok, true);
  return ((result as { readonly structuredContent: unknown }).structuredContent as any).previewId as string;
}

suite("mcpCustomApiExecutionApplicationService", () => {
  test("executes a confirmed short-lived single-use preview session", async () => {
    const setup = services(definition());
    const parameters = { Text: "Draft a reply" };
    const id = await previewId(setup.preview, "AIReply", parameters);
    let postCalls = 0;
    const service = new McpCustomApiExecutionApplicationService(
      config,
      setup.store,
      async () => "token",
      async (args) => {
        postCalls += 1;
        assert.strictEqual(args.path, "/api/data/v9.2/AIReply");
        assert.deepStrictEqual(args.body, parameters);
        return {
          data: { PreparedResponse: "Thank you for contacting us." },
          executionContext: {
            method: "POST",
            path: args.path,
            url: `${args.baseUrl}${args.path}`,
            statusCode: 200,
            durationMs: 12,
            timestamp: "2026-08-01T00:00:00.000Z"
          },
          transport: "node-fetch"
        };
      }
    );

    const result = await service.execute({ previewId: id, confirmation: "EXECUTE" });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(postCalls, 1);
    if (!result.ok) return;
    const content = result.structuredContent as any;
    assert.strictEqual(content.executed, true);
    assert.strictEqual(content.previewId, id);
    assert.strictEqual(content.response.PreparedResponse, "Thank you for contacting us.");
    assert.strictEqual(content.executionContext.statusCode, 200);
  });

  test("requires exact explicit confirmation", async () => {
    const setup = services(definition());
    const id = await previewId(setup.preview, "AIReply", { Text: "Draft" });
    const service = new McpCustomApiExecutionApplicationService(config, setup.store, async () => "token", async () => {
      throw new Error("must not execute");
    });
    const result = await service.execute({ previewId: id, confirmation: "yes" });
    assert.strictEqual(result.ok, false);
    if (result.ok) return;
    assert.match(result.message, /confirmation/i);
    assert.strictEqual(setup.store.get(id)?.status, "awaiting-confirmation");
  });

  test("rejects direct execution without an active preview session", async () => {
    const setup = services(definition());
    const service = new McpCustomApiExecutionApplicationService(config, setup.store, async () => "token", async () => {
      throw new Error("must not execute");
    });
    const result = await service.execute({ previewId: "missing", confirmation: "EXECUTE" });
    assert.strictEqual(result.ok, false);
    if (result.ok) return;
    assert.match(result.message, /no active preview session/i);
  });

  test("consumes a preview after one execution and rejects replay", async () => {
    const setup = services(definition());
    const id = await previewId(setup.preview, "AIReply", { Text: "Draft" });
    let calls = 0;
    const service = new McpCustomApiExecutionApplicationService(config, setup.store, async () => "token", async (args) => {
      calls += 1;
      return {
        data: { PreparedResponse: "ok" },
        executionContext: { method: "POST", path: args.path, url: `${args.baseUrl}${args.path}`, statusCode: 200, durationMs: 1, timestamp: "2026-08-01T00:00:00.000Z" },
        transport: "node-fetch"
      };
    });
    const first = await service.execute({ previewId: id, confirmation: "EXECUTE" });
    assert.strictEqual(first.ok, true);
    const second = await service.execute({ previewId: id, confirmation: "EXECUTE" });
    assert.strictEqual(second.ok, false);
    if (!second.ok) assert.match(second.message, /already been consumed/i);
    assert.strictEqual(calls, 1);
  });

  test("rejects expired preview sessions", async () => {
    let now = Date.parse("2026-08-01T00:00:00.000Z");
    const setup = services(definition(), { ttlMs: 1000, now: () => now });
    const id = await previewId(setup.preview, "AIReply", { Text: "Draft" });
    now += 1001;
    const service = new McpCustomApiExecutionApplicationService(config, setup.store, async () => "token", async () => {
      throw new Error("must not execute");
    });
    const result = await service.execute({ previewId: id, confirmation: "EXECUTE" });
    assert.strictEqual(result.ok, false);
    if (!result.ok) assert.match(result.message, /expired/i);
  });

  test("atomically allows only one transport invocation for concurrent replay attempts", async () => {
    const setup = services(definition());
    const id = await previewId(setup.preview, "AIReply", { Text: "Draft" });
    let calls = 0;
    const service = new McpCustomApiExecutionApplicationService(config, setup.store, async () => "token", async (args) => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return {
        data: { PreparedResponse: "ok" },
        executionContext: { method: "POST", path: args.path, url: `${args.baseUrl}${args.path}`, statusCode: 200, durationMs: 1, timestamp: "2026-08-01T00:00:00.000Z" },
        transport: "node-fetch"
      };
    });
    const [first, second] = await Promise.all([
      service.execute({ previewId: id, confirmation: "EXECUTE" }),
      service.execute({ previewId: id, confirmation: "EXECUTE" })
    ]);
    assert.strictEqual([first.ok, second.ok].filter(Boolean).length, 1);
    assert.strictEqual(calls, 1);
  });

  test("blocks non-generate-only operations before transport and consumes the preview", async () => {
    const setup = services(definition({ uniqueName: "CreateRecord", description: "Create a record" }));
    const id = await previewId(setup.preview, "CreateRecord", { Text: "value" });
    let postCalls = 0;
    const service = new McpCustomApiExecutionApplicationService(config, setup.store, async () => "token", async () => {
      postCalls += 1;
      throw new Error("must not execute");
    });
    const result = await service.execute({ previewId: id, confirmation: "EXECUTE" });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(postCalls, 0);
    assert.strictEqual(setup.store.get(id)?.status, "consumed");
  });
});
