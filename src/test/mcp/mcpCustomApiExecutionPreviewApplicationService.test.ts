import * as assert from "assert";
import type { CustomApiDefinition } from "../../customApi/models/customApiTypes.js";
import { McpCustomApiExecutionPreviewApplicationService } from "../../mcp/mcpCustomApiExecutionPreviewApplicationService.js";
import type { McpCustomApiApplicationService } from "../../mcp/mcpCustomApiApplicationService.js";
import { McpCustomApiExecutionPreviewSessionStore } from "../../mcp/mcpCustomApiExecutionPreviewSessionStore.js";
import type { DvqrMcpRuntimeConfiguration } from "../../mcp/mcpRuntimeConfiguration.js";

const config = { environmentUrl: "https://example.crm6.dynamics.com" } as DvqrMcpRuntimeConfiguration;

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

function service(item: CustomApiDefinition | null) {
  const definitions = {
    resolveDefinition: async () => ({
      environmentUrl: config.environmentUrl,
      uniqueName: item?.uniqueName ?? "Missing",
      definition: item,
      invocation: null,
      catalogue: item ? [item] : []
    })
  } as unknown as McpCustomApiApplicationService;
  return new McpCustomApiExecutionPreviewApplicationService(config, definitions, new McpCustomApiExecutionPreviewSessionStore());
}

suite("mcpCustomApiExecutionPreviewApplicationService", () => {
  test("builds a metadata-only global Action preview", async () => {
    const result = await service(definition()).preview({ uniqueName: "AIReply", parameters: { Text: "Draft a reply" } });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    const content = result.structuredContent as any;
    assert.strictEqual(content.readiness, "conditional");
    assert.strictEqual(content.preview.method, "POST");
    assert.strictEqual(content.preview.route, "/api/data/v9.2/AIReply");
    assert.deepStrictEqual(content.preview.body, { Text: "Draft a reply" });
    assert.match(content.executionPlanFingerprint, /^[0-9a-f]{64}$/);
    assert.strictEqual(content.noExecutionPerformed, true);
    assert.match(content.previewId, /^dvqr-preview-/);
    assert.strictEqual(content.previewSession.singleUse, true);
    assert.strictEqual(content.previewSession.status, "awaiting-confirmation");
    assert.strictEqual(content.nextAction.tool, "dvqr_execute_custom_api");
    assert.strictEqual(content.nextAction.requiresExplicitConfirmation, true);
    assert.strictEqual(content.nextAction.confirmationValue, "EXECUTE");
    assert.strictEqual(content.nextAction.preserveExactPreview, true);
    assert.strictEqual(content.nextAction.forbidAlternativeExecutionTools, true);
    assert.strictEqual(content.nextAction.previewId, content.previewId);
    assert.match(content.nextAction.instruction, /Stop after presenting this exact preview/i);
    assert.match(content.nextAction.instruction, /only this previewId and confirmation EXECUTE/i);
    assert.match(content.nextAction.instruction, /short-lived and single-use/i);
  });

  test("blocks missing required parameters", async () => {
    const result = await service(definition()).preview({ uniqueName: "AIReply", parameters: {} });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    const content = result.structuredContent as any;
    assert.strictEqual(content.readiness, "blocked");
    assert.ok(content.issues.some((issue: string) => issue.includes("Missing required parameter: Text")));
  });

  test("constructs an entity-bound qualified route", async () => {
    const bound = definition({ bindingKind: "Bound", boundTargetKind: "entity", boundEntitySetName: "accounts" });
    const result = await service(bound).preview({
      uniqueName: "AIReply",
      parameters: { Text: "Draft" },
      target: { recordId: "11111111-1111-4111-8111-111111111111" }
    });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    const content = result.structuredContent as any;
    assert.strictEqual(content.preview.route, "/api/data/v9.2/accounts(11111111-1111-4111-8111-111111111111)/Microsoft.Dynamics.CRM.AIReply");
  });
});
