import * as assert from "assert";
import * as vscode from "vscode";
import {
  appendOutput,
  normalizeMetadataName,
  runMetadataLoad
} from "../../commands/router/actions/shared/metadataAccess/metadataAccessCommon.js";

suite("metadataAccessCommon", () => {
  let originalGetConfiguredLogLevel: any;

  setup(async () => {
  });

  teardown(async () => {
  });

  test("appendOutput suppressOutput prevents logging", () => {
    const lines: string[] = [];
    const ctx = {
      output: {
        appendLine: (msg: string) => lines.push(msg),
      },
    } as any;

    appendOutput(ctx, "ignored", { suppressOutput: true });

    assert.strictEqual(lines.length, 0);
  });

  test("runMetadataLoad uses vscode progress when not silent", async () => {
    const original = vscode.window.withProgress;
    const calls: string[] = [];

    (vscode.window as any).withProgress = async (options: any, task: () => Promise<string>) => {
      calls.push(options.title);
      return await task();
    };

    try {
      const result = await runMetadataLoad("Load metadata", async () => "done");
      assert.strictEqual(result, "done");
      assert.deepStrictEqual(calls, ["Load metadata"]);
    } finally {
      (vscode.window as any).withProgress = original;
    }
  });
});