import * as assert from "assert";
import { DvqrMcpLiveToolDispatcher } from "../../mcp/mcpLiveToolDispatcher.js";

suite("Pass 9.5.2 investigation intent brief", () => {
  test("returns inferred intent for a specific opening request and stops for confirmation", async () => {
    const foundation = {
      callTool: (call: { name: string }) => {
        if (call.name === "dvqr.startInvestigation") {
          return { ok: true, structuredContent: { investigationId: "inv-952", subject: { logicalName: "contact", displayLabel: "Contact ***9568de" } } };
        }
        if (call.name === "dvqr.bootstrapInvestigation") {
          return { ok: true, structuredContent: { contractVersion: "dvqr-investigation-bootstrap-v1", investigationId: "inv-952" } };
        }
        throw new Error(`Unexpected tool: ${call.name}`);
      }
    } as never;
    const freeAdapter = {
      discoverOperationalAnchors: async () => ({
        ok: true,
        structuredContent: {
          operationalAnchors: [
            { logicalName: "msemr_careplanactivity", displayName: "Care Plan Activity", score: 90, reasons: [{ message: "Relevant care-plan workflow surface." }] }
          ]
        }
      })
    } as never;
    const dispatcher = new DvqrMcpLiveToolDispatcher({ proEnabled: true, emitTextMirror: true, textMirrorMaxCharacters: 20000 } as never, freeAdapter, foundation);
    const result = await dispatcher.dispatch({
      name: "dvqr_start_investigation",
      arguments: {
        question: "Investigate why this Contact's Care Plan Activity was not created.",
        subject: { kind: "record", logicalName: "contact", recordId: "d15b208b-ee61-f011-bec2-0022489568de" }
      }
    });
    const content = result.structuredContent as {
      contractVersion?: string;
      intentInference?: { focus?: { value?: string }; problem?: { value?: string }; overallConfidence?: string };
      nextRequiredAction?: { action?: string; confirmationRequired?: boolean; confirmationTool?: string; confirmationArguments?: Record<string, unknown>; confirmationFallbackTool?: string; confirmationFallbackArguments?: Record<string, unknown>; neverRestartForConfirmation?: boolean };
    };
    assert.strictEqual(content.contractVersion, "dvqr-investigation-prepared-start-v2");
    assert.strictEqual(content.intentInference?.focus?.value, "Care Plan Activity");
    assert.match(content.intentInference?.problem?.value ?? "", /not created/i);
    assert.strictEqual(content.intentInference?.overallConfidence, "High");
    assert.strictEqual(content.nextRequiredAction?.action, "ConfirmOrEditInferredIntent");
    assert.strictEqual(content.nextRequiredAction?.confirmationRequired, true);
    assert.strictEqual(content.nextRequiredAction?.confirmationTool, "dvqr_confirm_investigation_intent");
    assert.deepStrictEqual(content.nextRequiredAction?.confirmationArguments, { investigationId: "inv-952", confirmationText: "<exact subsequent user confirmation message>" });
    assert.strictEqual(content.nextRequiredAction?.confirmationFallbackTool, "dvqr_continue_investigation");
    assert.deepStrictEqual(content.nextRequiredAction?.confirmationFallbackArguments, { investigationId: "inv-952", confirmationText: "<exact subsequent user confirmation message>" });
    assert.strictEqual(content.nextRequiredAction?.neverRestartForConfirmation, true);
    assert.match(result.content?.[0]?.text ?? "", /NEVER call dvqr_start_investigation again/i);
    assert.match(result.content?.[0]?.text ?? "", /I believe you are investigating/i);
    assert.match(result.content?.[0]?.text ?? "", /continue with or edit/i);
  });

  test("falls back to manual capture for an ambiguous opening request", async () => {
    const foundation = {
      callTool: (call: { name: string }) => call.name === "dvqr.startInvestigation"
        ? { ok: true, structuredContent: { investigationId: "inv-ambiguous", subject: { logicalName: "contact", displayLabel: "Contact" } } }
        : { ok: true, structuredContent: { contractVersion: "dvqr-investigation-bootstrap-v1", investigationId: "inv-ambiguous" } }
    } as never;
    const freeAdapter = { discoverOperationalAnchors: async () => ({ ok: true, structuredContent: { operationalAnchors: [] } }) } as never;
    const dispatcher = new DvqrMcpLiveToolDispatcher({ proEnabled: true, emitTextMirror: true, textMirrorMaxCharacters: 20000 } as never, freeAdapter, foundation);
    const result = await dispatcher.dispatch({ name: "dvqr_start_investigation", arguments: { question: "Investigate this weird thing.", subject: { logicalName: "contact" } } });
    const content = result.structuredContent as { intentInference?: { requiresClarification?: boolean }; nextRequiredAction?: { action?: string } };
    assert.strictEqual(content.intentInference?.requiresClarification, true);
    assert.strictEqual(content.nextRequiredAction?.action, "CaptureAndPersistIntent");
  });
});
