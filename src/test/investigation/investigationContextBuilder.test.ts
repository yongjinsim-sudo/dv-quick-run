import * as assert from "assert";
import { buildQueryInvestigationContext } from "../../investigation/context/investigationContextBuilder.js";

suite("investigationContextBuilder", () => {
  test("classifies encoded FetchXML request path as fetchxml", () => {
    const context = buildQueryInvestigationContext("/contacts?fetchXml=%3Cfetch%3E%3Centity%20name%3D%22contact%22%20%2F%3E%3C%2Ffetch%3E");

    assert.strictEqual(context.currentQuery?.queryType, "fetchxml");
  });


});
