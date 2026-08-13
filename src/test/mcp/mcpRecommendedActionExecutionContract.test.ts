import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";

suite("MCP recommended-action execution enforcement contract", () => {
  const repoRoot = path.resolve(__dirname, "../../..");

  test("Pass 10.9.6.2 requires and validates actionId before deterministic managed execution", () => {
    const dispatcher = fs.readFileSync(path.join(repoRoot, "src/mcp/mcpLiveToolDispatcher.ts"), "utf8");
    assert.match(dispatcher, /RecommendedActionAuthorizationRequired/);
    assert.match(dispatcher, /RecommendedActionIntegrityViolation/);
    assert.match(dispatcher, /nextRequiredAction: "dvqr_continue_investigation"/);
    assert.doesNotMatch(dispatcher, /code: "RecommendedActionAuthorizationRequired"[\s\S]{0,500}currentActionId,/);
    assert.match(dispatcher, /current\?\.kind !== "ToolCall"/);
    assert.match(dispatcher, /suppliedActionId !== currentActionId/);
    assert.match(dispatcher, /publicName !== currentTool/);
    assert.match(dispatcher, /unexpectedArgument:/);
    assert.match(dispatcher, /stripRecommendedActionToken/);
  });

  test("Pass 10.9.6.2 exposes actionId on deterministic execution schemas without changing persisted recommendation arguments", () => {
    const catalogue = fs.readFileSync(path.join(repoRoot, "src/mcp/mcpLiveToolCatalogue.ts"), "utf8");
    const application = fs.readFileSync(path.join(repoRoot, "src/pro/investigations/investigationApplicationService.ts"), "utf8");
    assert.match(catalogue, /Required execution token from the exact current recommendedAction/);
    assert.match(application, /integrity:\s*\{\s*contractVersion:\s*"dvqr-managed-recommended-action-integrity-v1"/s);
    assert.doesNotMatch(application, /arguments:\s*\{\s*\.\.\.raw\.arguments,\s*actionId\s*\}/s);
  });
});


suite("MCP Mini RCA checkpoint execution schema", () => {
  const repoRoot = path.resolve(__dirname, "../../..");
  test("Pass 10.9.6.3 accepts actionId on checkpoint alias only", () => {
    const catalogue = fs.readFileSync(path.join(repoRoot, "src/mcp/mcpLiveToolCatalogue.ts"), "utf8");
    const checkpoint = catalogue.slice(catalogue.indexOf('name: "dvqr_generate_mini_rca_checkpoint"'), catalogue.indexOf('name: "dvqr_get_mini_rca"'));
    assert.match(checkpoint, /actionId/);
    const direct = catalogue.slice(catalogue.indexOf('name: "dvqr_generate_mini_rca"'), catalogue.indexOf('name: "dvqr_generate_mini_rca_checkpoint"'));
    assert.doesNotMatch(direct, /actionId/);
  });
});
