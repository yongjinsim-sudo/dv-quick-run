import assert from "node:assert/strict";
import { suite, test } from "mocha";
import { getCustomApiTypeMetadata, isCustomApiTypePreviewReady } from "../../customApi/metadata/customApiMetadataEnrichment.js";

suite("customApiMetadataEnrichment", () => {
  test("maps Dataverse Custom API numeric type codes to readable labels", () => {
    assert.equal(getCustomApiTypeMetadata("10").label, "String");
    assert.equal(getCustomApiTypeMetadata("12").label, "Guid");
    assert.equal(getCustomApiTypeMetadata("3").label, "Entity");
  });

  test("classifies simple parameter types as preview-ready", () => {
    assert.equal(isCustomApiTypePreviewReady("10"), true);
    assert.equal(isCustomApiTypePreviewReady("12"), true);
  });

  test("keeps complex parameter types inspect-only", () => {
    const metadata = getCustomApiTypeMetadata("3");

    assert.equal(metadata.executionSupport, "inspect-only");
    assert.equal(metadata.supportLabel, "Inspect only");
  });
});
