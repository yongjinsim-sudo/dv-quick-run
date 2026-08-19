import * as assert from "node:assert";
import * as path from "node:path";
import {
  requireMcpWorkspaceBinding,
  resolveMcpWorkspaceBinding
} from "../../mcp/mcpWorkspaceBinding.js";

suite("MCP canonical workspace binding", () => {
  test("resolves only an explicit configured workspace root", () => {
    const configured = path.join("C:", "work", "test-workspace");
    const binding = resolveMcpWorkspaceBinding({
      workspaceRoot: configured
    } as any);

    assert.strictEqual(binding.available, true);
    if (!binding.available) return;
    assert.strictEqual(binding.workspaceRoot, path.resolve(configured));
    assert.strictEqual(
      binding.businessPathDirectory,
      path.join(path.resolve(configured), ".dvforgelab", "dvqr", "business-paths")
    );
    assert.strictEqual(binding.source, "DVQR_MCP_WORKSPACE_ROOT");
  });

  test("does not silently fall back to process.cwd when workspace binding is absent", () => {
    const binding = resolveMcpWorkspaceBinding({ workspaceRoot: undefined } as any);
    assert.strictEqual(binding.available, false);
    if (binding.available) return;
    assert.match(binding.reason, /explicit VS Code workspace root/i);
    assert.match(binding.reason, /DVQR_MCP_WORKSPACE_ROOT/i);
    assert.throws(
      () => requireMcpWorkspaceBinding({ workspaceRoot: undefined } as any),
      /Managed Business Paths require an explicit VS Code workspace root/i
    );
  });
});
