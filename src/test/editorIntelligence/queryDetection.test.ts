import * as assert from "assert";
import { looksLikeDataverseQuery , detectQueryKind } from "../../shared/editorIntelligence/queryDetection.js";

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

  test("detects fetchxml with xml declaration", () => {
    assert.strictEqual(
      detectQueryKind(`<?xml version="1.0"?><fetch><entity name="contact" /></fetch>`),
      "fetchxml"
    );
  });

  test("fetchxml root still counts as dataverse query when multiline", () => {
    assert.strictEqual(
      looksLikeDataverseQuery([
        `<fetch top="5">`,
        `  <entity name="contact">`,
        `    <attribute name="fullname" />`,
        `  </entity>`,
        `</fetch>`
      ].join("\n")),
      true
    );
  });

  test("rejects random angle-bracket text that is not fetchxml", () => {
    assert.strictEqual(
      detectQueryKind("<notfetch />"),
      "unknown"
    );
  });




});