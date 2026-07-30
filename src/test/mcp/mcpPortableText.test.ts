import * as assert from "assert";
import { buildPortableTextPayload, normalizeStructuredContent } from "../../mcp/mcpPortableText.js";

suite("mcpPortableText", () => {
  test("mirrors structured content as formatted text", () => {
    const normalized = normalizeStructuredContent({ data: { value: [{ fullname: "A" }] } });
    const result = buildPortableTextPayload(normalized, { enabled: true, maxCharacters: 32768 });
    assert.strictEqual(result.mirrored, true);
    assert.strictEqual(result.truncated, false);
    assert.match(result.text ?? "", /fullname/);
  });

  test("can disable the portable mirror", () => {
    const result = buildPortableTextPayload({ value: [1] }, { enabled: false, maxCharacters: 32768 });
    assert.strictEqual(result.mirrored, false);
    assert.strictEqual(result.text, undefined);
  });

  test("emits a bounded valid JSON envelope for large payloads", () => {
    const result = buildPortableTextPayload({ value: ["x".repeat(5000)] }, { enabled: true, maxCharacters: 1024 });
    assert.strictEqual(result.truncated, true);
    const parsed = JSON.parse(result.text ?? "{}") as Record<string, unknown>;
    assert.strictEqual(parsed.contractVersion, "dvqr-mcp-portable-text-v1");
    assert.strictEqual(parsed.truncated, true);
    assert.match(String(parsed.notice), /structuredContent/);
  });

  test("normalizes primitive payloads", () => {
    assert.deepStrictEqual(normalizeStructuredContent("ok"), { result: "ok" });
  });
});
