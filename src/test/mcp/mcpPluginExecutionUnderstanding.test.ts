import * as assert from "assert";
import { PluginExecutionUnderstandingInvestigationEvidenceProvider } from "../../pro/investigations/investigationEvidenceProvider.js";

suite("managed plugin execution understanding", () => {
  test("normalizes trace and registration surfaces without persisting full ids", () => {
    const provider = new PluginExecutionUnderstandingInvestigationEvidenceProvider();
    const result = provider.normalize({
      ok: true,
      structuredContent: {
        prerequisiteEvidenceId: "ev-mech",
        targetTable: "msemr_careplanactivity",
        interval: { fromIso: "2026-08-01T00:00:00Z", toIso: "2026-08-09T00:00:00Z" },
        traces: [{ createdon: "2026-08-02T00:00:00Z", typename: "Contoso.Plugin", messagename: "Create", primaryentity: "msemr_careplanactivity", operationtype: 1, mode: 0, depth: 1, pluginstepid: "11111111-1111-1111-1111-111111111111", correlationid: "22222222-2222-2222-2222-222222222222" }],
        registrations: [{ pluginStepId: "11111111-1111-1111-1111-111111111111", ok: true, row: { name: "Create Care Plan Activity", stage: 20, mode: 0, rank: 1, sdkmessageid: { name: "Create" }, sdkmessagefilterid: { primaryobjecttypecode: "msemr_careplanactivity" }, plugintypeid: { friendlyname: "Contoso Plugin" } } }]
      }
    }, { investigation: { subject: { kind: "Record" }, currentIntent: { directionLogicalName: "msemr_careplanactivity" } } as any, acquiredAt: "2026-08-09T00:00:00Z" });
    assert.strictEqual(result.status, "Acquired");
    const payload = result.payload as any;
    assert.strictEqual(payload.traces[0].messageName, "Create");
    assert.strictEqual(payload.traces[0].modeLabel, "Synchronous");
    assert.strictEqual(payload.registrations[0].stageLabel, "PreOperation");
    assert.strictEqual(payload.registrations[0].pluginStepIdMasked, "***11111111");
    assert.ok(!JSON.stringify(payload).includes("11111111-1111-1111-1111-111111111111"));
    assert.match(payload.interpretationBoundary, /do not by themselves prove/i);
  });
});
