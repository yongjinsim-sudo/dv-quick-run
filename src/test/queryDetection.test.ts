import * as assert from "assert";
import { looksLikeDataverseQuery } from "../shared/editorIntelligence/queryDetection.js";

suite("queryDetection", () => {
  test("detects simple select query", () => {
    assert.strictEqual(looksLikeDataverseQuery("accounts?$select=name"), true);
  });

  test("detects filter query", () => {
    assert.strictEqual(looksLikeDataverseQuery("contacts?$filter=fullname eq 'abc'"), true);
  });

  test("detects orderby query", () => {
    assert.strictEqual(looksLikeDataverseQuery("accounts?$orderby=createdon desc"), true);
  });

  test("detects single entity path", () => {
    assert.strictEqual(looksLikeDataverseQuery("contacts"), true);
  });

  test("rejects comment line", () => {
    assert.strictEqual(looksLikeDataverseQuery("// accounts?$select=name"), false);
  });

  test("rejects empty line", () => {
    assert.strictEqual(looksLikeDataverseQuery("   "), false);
  });
});