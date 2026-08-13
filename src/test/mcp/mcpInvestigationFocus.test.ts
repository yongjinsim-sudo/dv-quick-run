import * as assert from "assert";
import { InvestigationFocusSuggestionService } from "../../pro/investigations/investigationFocus.js";

suite("investigation focus suggestions", () => {
  test("ranks runtime-observed surfaces above metadata-derived anchors and preserves custom", () => {
    const investigation = { investigationId: "inv-00000000-0000-0000-0000-000000000001", subject: { logicalName: "contact" } };
    const service = new InvestigationFocusSuggestionService({ get: () => investigation } as never, { list: () => [
      { providerId: "relationship-context", status: "Acquired", payload: { operationalAnchors: [{ logicalName: "msemr_encounter", score: 100 }, { logicalName: "msemr_careplan", score: 80 }] } },
      { providerId: "runtime-relationship", status: "Acquired", payload: { classification: "Observed", requestedTargetTable: "msemr_careplan" } }
    ] } as never);
    const suggestions = service.suggest(investigation.investigationId);
    assert.strictEqual(suggestions[0].logicalName, "msemr_careplan");
    assert.strictEqual(suggestions[0].source, "RuntimeObserved");
    assert.ok(suggestions.some((item) => item.logicalName === "msemr_encounter"));
    assert.strictEqual(suggestions[suggestions.length - 1].focusId, "custom");
  });
});
