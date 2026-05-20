import * as assert from "assert";
import { buildOperationalContextViewModel } from "../../product/operationalContext/operationalContextEngine.js";
import type { OperationalContextProvider } from "../../product/operationalContext/operationalContextTypes.js";

suite("operationalContextEngine", () => {
  test("aggregates provider evidence with one-hop context and no causality claims", async () => {
    const provider: OperationalContextProvider = {
      id: "solutionContext",
      label: "Solution Context",
      async collect(request) {
        assert.strictEqual(request.maxExpansionDepth, 1);
        return {
          providerId: "solutionContext",
          label: "Solution Context",
          evidence: [{
            subject: request.subject,
            evidenceType: "SolutionParticipation",
            title: "Solution participation",
            summary: "This entity appears in one solution component. Participation is not deployment causality.",
            source: "metadata",
            scope: "oneHopRelated",
            confidence: "related"
          }]
        };
      }
    };

    const model = await buildOperationalContextViewModel({
      subject: { type: "entity", logicalName: "account", displayName: "Account" },
      providers: [provider]
    });

    assert.strictEqual(model.sections.length, 1);
    assert.strictEqual(model.sections[0]?.label, "Solution Context");
    assert.ok(model.guardrails.some((item) => item.includes("curated semantic expansions")));
    assert.ok(model.guardrails.some((item) => item.includes("Participation does not imply causality")));

    const text = JSON.stringify(model).toLowerCase();
    assert.ok(!text.includes("root cause"));
    assert.ok(!text.includes("caused by"));
  });

  test("degrades provider failures into contextual unavailable state", async () => {
    const provider: OperationalContextProvider = {
      id: "accessContext",
      label: "Access Context",
      async collect() {
        throw new Error("missing privilege evidence unavailable");
      }
    };

    const model = await buildOperationalContextViewModel({
      subject: { type: "capability", logicalName: "sample_CustomAction" },
      providers: [provider]
    });

    assert.strictEqual(model.sections.length, 1);
    assert.strictEqual(model.sections[0]?.evidence.length, 0);
    assert.strictEqual(model.sections[0]?.unavailableReason, "missing privilege evidence unavailable");
    assert.ok(model.sections[0]?.summary.includes("missing privilege evidence unavailable"));
  });
});
