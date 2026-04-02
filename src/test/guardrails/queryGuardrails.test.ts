import * as assert from "assert";
import * as vscode from "vscode";
import {
  confirmGuardrailsIfNeeded,
  parseDvQueryForGuardrails
} from "../../commands/router/actions/shared/guardrails/queryGuardrails.js";
import type { QueryGuardrailResult } from "../../commands/router/actions/shared/guardrails/queryGuardrailTypes.js";

suite("queryGuardrails", () => {
  const originalShowWarningMessage = vscode.window.showWarningMessage;

  teardown(() => {
    (vscode.window as any).showWarningMessage = originalShowWarningMessage;
  });

  test("parseDvQueryForGuardrails detects duplicates and leading slash", () => {
    const parsed = parseDvQueryForGuardrails("/contacts?$top=10&$top=20&$select=fullname");

    assert.strictEqual(parsed.hadLeadingSlash, true);
    assert.strictEqual(parsed.entitySetName, "contacts");
    assert.strictEqual(parsed.isCollectionQuery, true);
    assert.strictEqual(parsed.duplicateOptionCounts.get("$top"), 2);
  });

  test("parseDvQueryForGuardrails detects single-record paths", () => {
    const parsed = parseDvQueryForGuardrails("contacts(00000000-0000-0000-0000-000000000000)?$select=fullname");

    assert.strictEqual(parsed.entitySetName, "contacts");
    assert.strictEqual(parsed.isSingleRecordPath, true);
    assert.strictEqual(parsed.isCollectionQuery, false);
  });

  test("confirmGuardrailsIfNeeded returns false when errors are present", async () => {
    const result: QueryGuardrailResult = {
      issues: [{ code: "missing-entity", severity: "error", message: "Missing entity path." }],
      hasWarnings: false,
      hasErrors: true
    };

    const confirmed = await confirmGuardrailsIfNeeded(result);
    assert.strictEqual(confirmed, false);
  });

  test("confirmGuardrailsIfNeeded skips prompt when no warnings exist", async () => {
    const result: QueryGuardrailResult = {
      issues: [],
      hasWarnings: false,
      hasErrors: false
    };

    const confirmed = await confirmGuardrailsIfNeeded(result);
    assert.strictEqual(confirmed, true);
  });

  test("confirmGuardrailsIfNeeded returns true only for explicit Run Anyway", async () => {
    const prompts: string[] = [];
    const result: QueryGuardrailResult = {
      issues: [{ code: "missing-top", severity: "warning", message: "Missing $top" }],
      hasWarnings: true,
      hasErrors: false
    };

    (vscode.window as any).showWarningMessage = async (message: string) => {
      prompts.push(message);
      return "Run Anyway";
    };

    const confirmed = await confirmGuardrailsIfNeeded(result);

    assert.strictEqual(confirmed, true);
    assert.strictEqual(prompts.length, 1);
    assert.ok(prompts[0].includes("Run anyway?"));
  });

  test("confirmGuardrailsIfNeeded returns false when warning prompt is dismissed", async () => {
    const result: QueryGuardrailResult = {
      issues: [{ code: "missing-select", severity: "warning", message: "Missing $select" }],
      hasWarnings: true,
      hasErrors: false
    };

    (vscode.window as any).showWarningMessage = async () => undefined;

    const confirmed = await confirmGuardrailsIfNeeded(result);
    assert.strictEqual(confirmed, false);
  });
  test("confirmGuardrailsIfNeeded offers preview actions for missing top", async () => {
    let items: string[] = [];
    const result: QueryGuardrailResult = {
      issues: [{ code: "missing-top", severity: "warning", message: "Missing $top" }],
      hasWarnings: true,
      hasErrors: false
    };

    (vscode.window as any).showWarningMessage = async (_message: string, _options: any, ...choices: string[]) => {
      items = choices;
      return undefined;
    };

    const confirmed = await confirmGuardrailsIfNeeded(result);
    assert.strictEqual(confirmed, false);
    assert.ok(items.includes("Preview add $top=10"));
    assert.ok(items.includes("Preview add $top=50"));
    assert.ok(items.includes("Run Anyway"));
  });

  test("confirmGuardrailsIfNeeded offers preview action for missing select", async () => {
    let items: string[] = [];
    const result: QueryGuardrailResult = {
      issues: [{ code: "missing-select", severity: "warning", message: "Missing $select" }],
      hasWarnings: true,
      hasErrors: false
    };

    (vscode.window as any).showWarningMessage = async (_message: string, _options: any, ...choices: string[]) => {
      items = choices;
      return undefined;
    };

    const confirmed = await confirmGuardrailsIfNeeded(result);
    assert.strictEqual(confirmed, false);
    assert.ok(items.includes("Preview add $select..."));
    assert.ok(items.includes("Run Anyway"));
  });

});
