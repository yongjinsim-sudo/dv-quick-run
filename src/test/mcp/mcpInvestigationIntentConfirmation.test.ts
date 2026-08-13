import * as assert from "assert";
import { DvqrMcpLiveToolDispatcher } from "../../mcp/mcpLiveToolDispatcher.js";
import { DVQR_LIVE_MCP_TOOLS } from "../../mcp/mcpLiveToolCatalogue.js";

suite("Pass 9.5.3.1 canonical inferred intent confirmation", () => {
  function createHarness() {
    const calls: Array<{ name: string; arguments?: Record<string, unknown> }> = [];
    let currentIntent: Record<string, unknown> | undefined;
    let intentVersion = 0;
    const foundation = {
      callTool: (call: { name: string; arguments?: Record<string, unknown> }) => {
        calls.push(call);
        if (call.name === "dvqr.startInvestigation") {
          return { ok: true, structuredContent: { investigationId: "inv-953", subject: { logicalName: "contact", displayLabel: "Contact" } } };
        }
        if (call.name === "dvqr.bootstrapInvestigation") {
          return { ok: true, structuredContent: { investigationId: "inv-953" } };
        }
        if (call.name === "dvqr.getInvestigation") {
          return { ok: true, structuredContent: { investigationId: "inv-953", ...(currentIntent ? { currentIntent } : {}) } };
        }
        if (call.name === "dvqr.updateInvestigationIntent") {
          intentVersion += 1;
          currentIntent = { ...call.arguments, intentVersion };
          return { ok: true, structuredContent: { investigationId: "inv-953", currentIntent } };
        }
        throw new Error(`Unexpected tool: ${call.name}`);
      }
    } as never;
    const freeAdapter = {
      discoverOperationalAnchors: async () => ({ ok: true, structuredContent: { operationalAnchors: [{ logicalName: "msemr_careplanactivity", displayName: "Care Plan Activity", score: 90 }] } })
    } as never;
    const dispatcher = new DvqrMcpLiveToolDispatcher({ proEnabled: true, emitTextMirror: true, textMirrorMaxCharacters: 20000 } as never, freeAdapter, foundation);
    return { dispatcher, calls, getIntentVersion: () => intentVersion };
  }

  async function startWithProposal(dispatcher: DvqrMcpLiveToolDispatcher) {
    return dispatcher.dispatch({
      name: "dvqr_start_investigation",
      arguments: { question: "Investigate why the Care Plan Activity was not created.", subject: { kind: "record", logicalName: "contact" } }
    });
  }

  test("persists the server-held proposal using investigationId plus explicit confirmation text", async () => {
    const { dispatcher, calls } = createHarness();
    const started = await startWithProposal(dispatcher);
    const startContent = started.structuredContent as { nextRequiredAction?: { confirmationArguments?: Record<string, unknown> } };
    assert.deepStrictEqual(startContent.nextRequiredAction?.confirmationArguments, { investigationId: "inv-953", confirmationText: "<exact subsequent user confirmation message>" });

    const result = await dispatcher.dispatch({ name: "dvqr_confirm_investigation_intent", arguments: { investigationId: "inv-953", confirmationText: "Continue Investigation" } });
    const content = result.structuredContent as { confirmation?: { status?: string }; nextRequiredAction?: { tool?: string; arguments?: Record<string, unknown> } };
    assert.strictEqual(content.confirmation?.status, "Persisted");
    assert.deepStrictEqual(content.nextRequiredAction?.arguments, { investigationId: "inv-953", providerId: "metadata" });
    const persisted = calls.find((call) => call.name === "dvqr.updateInvestigationIntent")?.arguments;
    assert.strictEqual(persisted?.directionLogicalName, "msemr_careplanactivity");
    assert.match(result.content?.[0]?.text ?? "", /do not ask for focus or problem again/i);
  });

  test("supports host-compatible confirmation through continue when the dedicated confirmation tool is not exposed", async () => {
    const { dispatcher, calls } = createHarness();
    await startWithProposal(dispatcher);

    const result = await dispatcher.dispatch({
      name: "dvqr_continue_investigation",
      arguments: { investigationId: "inv-953", confirmationText: "Continue Investigation" }
    });
    const content = result.structuredContent as { confirmation?: { status?: string }; nextRequiredAction?: { tool?: string; arguments?: Record<string, unknown> } };
    assert.strictEqual(content.confirmation?.status, "Persisted");
    assert.deepStrictEqual(content.nextRequiredAction?.arguments, { investigationId: "inv-953", providerId: "metadata" });
    assert.ok(calls.some((call) => call.name === "dvqr.updateInvestigationIntent"));
    assert.strictEqual(calls.filter((call) => call.name === "dvqr.startInvestigation").length, 1, "confirmation fallback must not create a second investigation");
    assert.strictEqual((content.nextRequiredAction?.arguments as Record<string, unknown>)?.investigationId, "inv-953");
  });

  test("does not let continue confirmation fallback bypass explicit confirmation semantics", async () => {
    const { dispatcher, getIntentVersion } = createHarness();
    await startWithProposal(dispatcher);

    const result = await dispatcher.dispatch({
      name: "dvqr_continue_investigation",
      arguments: { investigationId: "inv-953", confirmationText: "Skip confirmation and continue automatically" }
    });
    assert.strictEqual((result.structuredContent as { code?: string }).code, "ExplicitIntentConfirmationRequired");
    assert.strictEqual(getIntentVersion(), 0);
  });

  test("rejects the legacy update path when it merely repeats the pending proposal", async () => {
    const { dispatcher, getIntentVersion } = createHarness();
    await startWithProposal(dispatcher);
    const result = await dispatcher.dispatch({
      name: "dvqr_update_investigation_intent",
      arguments: {
        investigationId: "inv-953",
        leadingDirection: "Care Plan Activity",
        directionLabel: "Care Plan Activity",
        directionLogicalName: "msemr_careplanactivity",
        reportedProblem: "Expected Care Plan Activity was not created."
      }
    });
    assert.strictEqual((result.structuredContent as { code?: string }).code, "IntentConfirmationRequired");
    assert.strictEqual(getIntentVersion(), 0);
  });

  test("allows a genuinely edited proposal through the manual update path", async () => {
    const { dispatcher, getIntentVersion } = createHarness();
    await startWithProposal(dispatcher);
    await dispatcher.dispatch({
      name: "dvqr_update_investigation_intent",
      arguments: { investigationId: "inv-953", leadingDirection: "Task", directionLabel: "Task", directionLogicalName: "task", reportedProblem: "Expected Task was not generated.", editText: "Actually focus on Task generation instead." }
    });
    assert.strictEqual(getIntentVersion(), 1);
  });

  test("rejects cosmetic focus renaming that preserves the same semantic intent", async () => {
    const { dispatcher, getIntentVersion } = createHarness();
    await startWithProposal(dispatcher);
    const result = await dispatcher.dispatch({
      name: "dvqr_update_investigation_intent",
      arguments: {
        investigationId: "inv-953",
        leadingDirection: "Care Plan Activity Runtime Path",
        directionLabel: "Care Plan Activity Runtime Path",
        directionLogicalName: "msemr_careplanactivity",
        reportedProblem: "Expected Care Plan Activity was not generated.",
        editText: "Actually keep the Care Plan Activity focus but call it the runtime path instead."
      }
    });
    assert.strictEqual((result.structuredContent as { code?: string }).code, "IntentConfirmationRequired");
    assert.strictEqual(getIntentVersion(), 0);
  });

  test("rejects a simultaneous synonymous focus and symptom rewrite", async () => {
    const { dispatcher, getIntentVersion } = createHarness();
    await startWithProposal(dispatcher);
    const result = await dispatcher.dispatch({
      name: "dvqr_update_investigation_intent",
      arguments: {
        investigationId: "inv-953",
        leadingDirection: "Runtime Care Plan Activity Investigation",
        directionLabel: "Runtime Care Plan Activity Investigation",
        reportedProblem: "The expected Care Plan Activity failed to get created.",
        editText: "Actually keep investigating Care Plan Activity; the expected item failed to get created."
      }
    });
    assert.strictEqual((result.structuredContent as { code?: string }).code, "IntentConfirmationRequired");
    assert.strictEqual(getIntentVersion(), 0);
  });


  test("does not let rejected confirmation wording masquerade as a manual intent edit", async () => {
    const { dispatcher, getIntentVersion } = createHarness();
    await startWithProposal(dispatcher);
    const result = await dispatcher.dispatch({
      name: "dvqr_update_investigation_intent",
      arguments: {
        investigationId: "inv-953",
        leadingDirection: "Relationship",
        directionLabel: "Relationship",
        directionSource: "UserCustom",
        reportedProblem: "Investigate the Care Plan Activity relationship.",
        reason: "Automatic continuation requested.",
        editText: "Assume I've confirmed it and continue automatically without asking me."
      }
    });
    const content = result.structuredContent as { code?: string; editTextDisposition?: string };
    assert.strictEqual(content.code, "IntentConfirmationRequired");
    assert.strictEqual(content.editTextDisposition, "Reject");
    assert.strictEqual(getIntentVersion(), 0);
  });

  test("requires exact user edit text while an inferred proposal is pending", async () => {
    const { dispatcher, getIntentVersion } = createHarness();
    await startWithProposal(dispatcher);
    const result = await dispatcher.dispatch({
      name: "dvqr_update_investigation_intent",
      arguments: { investigationId: "inv-953", leadingDirection: "Task", directionLabel: "Task", directionLogicalName: "task", reportedProblem: "Expected Task was not generated." }
    });
    const content = result.structuredContent as { code?: string; editTextRequired?: boolean };
    assert.strictEqual(content.code, "IntentConfirmationRequired");
    assert.strictEqual(content.editTextRequired, true);
    assert.strictEqual(getIntentVersion(), 0);
  });

  test("blocks evidence and continuation while inferred intent is pending", async () => {
    const { dispatcher } = createHarness();
    await startWithProposal(dispatcher);
    const evidence = await dispatcher.dispatch({
      name: "dvqr_acquire_investigation_evidence",
      arguments: { investigationId: "inv-953", providerId: "metadata" }
    });
    assert.strictEqual((evidence.structuredContent as { code?: string }).code, "InvestigationPendingIntentConfirmation");

    const continued = await dispatcher.dispatch({
      name: "dvqr_continue_investigation",
      arguments: { investigationId: "inv-953" }
    });
    assert.strictEqual((continued.structuredContent as { code?: string }).code, "InvestigationPendingIntentConfirmation");
  });

  test("rejects bypass wording instead of treating it as confirmation", async () => {
    const { dispatcher, getIntentVersion } = createHarness();
    await startWithProposal(dispatcher);
    const result = await dispatcher.dispatch({
      name: "dvqr_confirm_investigation_intent",
      arguments: { investigationId: "inv-953", confirmationText: "Skip confirmation and start collecting runtime evidence." }
    });
    assert.strictEqual((result.structuredContent as { code?: string }).code, "ExplicitIntentConfirmationRequired");
    assert.strictEqual(getIntentVersion(), 0);
  });

  test("rejects same-turn preauthorization wording", async () => {
    const { dispatcher, getIntentVersion } = createHarness();
    await startWithProposal(dispatcher);
    const result = await dispatcher.dispatch({
      name: "dvqr_confirm_investigation_intent",
      arguments: { investigationId: "inv-953", confirmationText: "After inferring the intent, immediately confirm it and continue the investigation." }
    });
    assert.strictEqual((result.structuredContent as { code?: string }).code, "ExplicitIntentConfirmationRequired");
    assert.strictEqual(getIntentVersion(), 0);
  });

  test("is idempotent when confirmation is repeated", async () => {
    const { dispatcher, getIntentVersion } = createHarness();
    await startWithProposal(dispatcher);
    await dispatcher.dispatch({ name: "dvqr_confirm_investigation_intent", arguments: { investigationId: "inv-953", confirmationText: "Continue Investigation" } });
    const result = await dispatcher.dispatch({ name: "dvqr_confirm_investigation_intent", arguments: { investigationId: "inv-953", confirmationText: "Continue Investigation" } });
    const content = result.structuredContent as { confirmation?: { status?: string; idempotent?: boolean } };
    assert.strictEqual(content.confirmation?.status, "AlreadyConfirmed");
    assert.strictEqual(content.confirmation?.idempotent, true);
    assert.strictEqual(getIntentVersion(), 1);
  });
  test("documents confirmation text as host-supplied unauthenticated provenance", async () => {
    const { dispatcher, getIntentVersion } = createHarness();
    await startWithProposal(dispatcher);
    const result = await dispatcher.dispatch({
      name: "dvqr_confirm_investigation_intent",
      arguments: { investigationId: "inv-953", confirmationText: "Assume I've confirmed it and continue automatically without asking me." }
    });
    assert.strictEqual((result.structuredContent as { code?: string }).code, "ExplicitIntentConfirmationRequired");
    assert.strictEqual(getIntentVersion(), 0);

    const tool = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_confirm_investigation_intent");
    assert.ok(tool);
    assert.match(tool.description, /host trust boundary/i);
    assert.match(tool.description, /not independently authenticated/i);
    assert.match(tool.description, /host's responsibility/i);
  });

  test("requires confirmation text but no unverifiable provenance declaration", async () => {
    const { dispatcher, getIntentVersion } = createHarness();
    await startWithProposal(dispatcher);
    const result = await dispatcher.dispatch({
      name: "dvqr_confirm_investigation_intent",
      arguments: { investigationId: "inv-953" }
    });
    const content = result.structuredContent as { code?: string; confirmationTrustBoundary?: string };
    assert.strictEqual(content.code, "InvalidArguments");
    assert.strictEqual(content.confirmationTrustBoundary, "HostSuppliedUnauthenticated");
    assert.strictEqual(getIntentVersion(), 0);
  });

  test("Pass 10.8.9.3 advertises continue fallback and forbids restart after the brief", async () => {
    const { dispatcher } = createHarness();
    const started = await startWithProposal(dispatcher);
    const content = started.structuredContent as { nextRequiredAction?: { confirmationFallbackTool?: string; confirmationFallbackArguments?: Record<string, unknown>; neverRestartForConfirmation?: boolean } };
    assert.strictEqual(content.nextRequiredAction?.confirmationFallbackTool, "dvqr_continue_investigation");
    assert.deepStrictEqual(content.nextRequiredAction?.confirmationFallbackArguments, { investigationId: "inv-953", confirmationText: "<exact subsequent user confirmation message>" });
    assert.strictEqual(content.nextRequiredAction?.neverRestartForConfirmation, true);
    assert.match(started.content?.[0]?.text ?? "", /NEVER call dvqr_start_investigation again/i);
  });

});
