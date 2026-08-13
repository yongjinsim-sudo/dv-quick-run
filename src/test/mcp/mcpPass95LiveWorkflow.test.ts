import * as assert from "assert";
import { DvqrMcpLiveToolDispatcher } from "../../mcp/mcpLiveToolDispatcher.js";

suite("Pass 9.5 live MCP workflow", () => {
  test("starts once, returns an inferred proposal, and stops before persistence", async () => {
    const calls: string[] = [];
    const foundation = {
      callTool: (call: { name: string }) => {
        calls.push(call.name);
        if (call.name === "dvqr.startInvestigation") {
          return {
            ok: true,
            structuredContent: {
              investigationId: "inv-952-live",
              subject: { logicalName: "contact", displayLabel: "Contact ***9568de" }
            }
          };
        }
        if (call.name === "dvqr.bootstrapInvestigation") {
          return {
            ok: true,
            structuredContent: {
              contractVersion: "dvqr-investigation-bootstrap-v1",
              investigationId: "inv-952-live"
            }
          };
        }
        throw new Error(`Unexpected tool: ${call.name}`);
      }
    } as never;

    const freeAdapter = {
      discoverOperationalAnchors: async () => ({
        ok: true,
        structuredContent: {
          operationalAnchors: [
            {
              logicalName: "msemr_careplanactivity",
              displayName: "Care Plan Activity",
              score: 90,
              reasons: [{ message: "Relevant care-plan workflow surface." }]
            }
          ]
        }
      })
    } as never;

    const dispatcher = new DvqrMcpLiveToolDispatcher(
      { proEnabled: true, emitTextMirror: true, textMirrorMaxCharacters: 20000 } as never,
      freeAdapter,
      foundation
    );

    const result = await dispatcher.dispatch({
      name: "dvqr_start_investigation",
      arguments: {
        question: "Investigate why this Contact's Care Plan Activity was not created.",
        subject: {
          kind: "record",
          logicalName: "contact",
          recordId: "d15b208b-ee61-f011-bec2-0022489568de"
        }
      }
    });

    const content = result.structuredContent as {
      contractVersion?: string;
      intentInference?: {
        focus?: { value?: string; logicalName?: string };
        problem?: { value?: string };
        goal?: { value?: string };
        overallConfidence?: string;
        requiresClarification?: boolean;
      };
      nextRequiredAction?: {
        action?: string;
        confirmationRequired?: boolean;
      };
    };

    assert.deepStrictEqual(calls, ["dvqr.startInvestigation", "dvqr.bootstrapInvestigation"]);
    assert.strictEqual(content.contractVersion, "dvqr-investigation-prepared-start-v2");
    assert.strictEqual(content.intentInference?.focus?.value, "Care Plan Activity");
    assert.strictEqual(content.intentInference?.focus?.logicalName, "msemr_careplanactivity");
    assert.match(content.intentInference?.problem?.value ?? "", /not created/i);
    assert.match(content.intentInference?.goal?.value ?? "", /determine why/i);
    assert.strictEqual(content.intentInference?.overallConfidence, "High");
    assert.strictEqual(content.intentInference?.requiresClarification, false);
    assert.strictEqual(content.nextRequiredAction?.action, "ConfirmOrEditInferredIntent");
    assert.strictEqual(content.nextRequiredAction?.confirmationRequired, true);
    assert.match(result.content?.[0]?.text ?? "", /I believe you are investigating/i);
    assert.match(result.content?.[0]?.text ?? "", /continue with or edit/i);
  });
});
