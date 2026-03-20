import * as assert from "assert";
import { looksLikeDataverseQuery, detectQueryKind } from "../shared/editorIntelligence/queryDetection.js";

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

  test("detects fetchxml root query", () => {
    assert.strictEqual(
      looksLikeDataverseQuery("<fetch><entity name='contact' /></fetch>"),
      true
    );
  });

  test("detects fetchxml query kind", () => {
    assert.strictEqual(
      detectQueryKind("<fetch><entity name='contact' /></fetch>"),
      "fetchxml"
    );
  });

  test("detects odata query kind", () => {
    assert.strictEqual(
      detectQueryKind("contacts?$select=fullname"),
      "odata"
    );
  });

  test("rejects partial xml fragment for now", () => {
    assert.strictEqual(
      looksLikeDataverseQuery("<entity name='contact' />"),
      false
    );
  });

  test("rejects random xml that is not fetchxml", () => {
    assert.strictEqual(
      looksLikeDataverseQuery("<root><x /></root>"),
      false
    );
  });
});