import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { DvqrMcpLiveToolDispatcher } from "../../mcp/mcpLiveToolDispatcher.js";
import { formatDvqrMcpToolResponse } from "../../mcp/mcpToolResponseFormatter.js";
import { mapStructuredExecutionError } from "../../mcp/mcpStructuredErrors.js";
import { redactMcpOutput } from "../../mcp/mcpOutputRedaction.js";
import { containsSensitiveData, redactSensitiveText } from "../../utils/sensitiveData.js";
import { InvestigationApplicationService } from "../../pro/investigations/investigationApplicationService.js";
import { WorkspaceInvestigationRepository } from "../../pro/investigations/investigationRepository.js";
import { WorkspaceInvestigationEvidenceRepository } from "../../pro/investigations/investigationEvidenceRepository.js";
import { WorkspaceInvestigationJournalRepository } from "../../pro/investigations/investigationJournal.js";
import { fakeSecrets, providerErrorFixtures } from "./fixtures/providerErrors.js";
import type { DvqrMcpRuntimeConfiguration } from "../../mcp/mcpRuntimeConfiguration.js";

const config: DvqrMcpRuntimeConfiguration = {
  environmentUrl: "https://example.crm.dynamics.com",
  proEnabled: false,
  requestTimeoutMs: 1000,
  emitTextMirror: true,
  textMirrorMaxCharacters: 32768
};

suite("Security adversarial secret and diagnostic exfiltration", () => {
  let previous: Record<string, string | undefined>;
  let root: string;

  setup(() => {
    previous = {
      DVQR_TEST_BEARER_SECRET: process.env.DVQR_TEST_BEARER_SECRET,
      DVQR_TEST_CLIENT_SECRET: process.env.DVQR_TEST_CLIENT_SECRET,
      DVQR_TEST_CONNECTION_STRING: process.env.DVQR_TEST_CONNECTION_STRING,
      DVQR_TEST_API_KEY: process.env.DVQR_TEST_API_KEY
    };
    process.env.DVQR_TEST_BEARER_SECRET = fakeSecrets.bearer;
    process.env.DVQR_TEST_CLIENT_SECRET = fakeSecrets.clientSecret;
    process.env.DVQR_TEST_CONNECTION_STRING = fakeSecrets.connectionString;
    process.env.DVQR_TEST_API_KEY = fakeSecrets.apiKey;
    root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-secret-exfiltration-"));
  });

  teardown(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("A13 redacts deterministic environment-held secret values even when diagnostics omit the key name", () => {
    const raw = [
      `nested failure: ${fakeSecrets.bearer}`,
      `stderr=${fakeSecrets.clientSecret}`,
      `provider detail ${fakeSecrets.connectionString}`,
      `stack-like text at execute (${fakeSecrets.apiKey})`
    ].join(" | ");
    const redacted = redactSensitiveText(raw);
    for (const secret of Object.values(fakeSecrets)) {
      assert.strictEqual(redacted.includes(String(secret)), false);
    }
    assert.match(redacted, /\[REDACTED\]/);
    assert.strictEqual(containsSensitiveData(raw), true);
  });

  test("A13 structured Dataverse/provider diagnostics are safe at the model-facing formatter boundary", () => {
    for (const fixture of providerErrorFixtures) {
      const error = fixture instanceof Error
        ? fixture
        : new Error(`${fixture.message}; ${fixture.nested.stderr}`);
      const mapped = mapStructuredExecutionError(error, `contacts?$filter=fullname eq '${fakeSecrets.apiKey}'&$top=1`, "contacts");
      const mappedSerialized = JSON.stringify(mapped);
      for (const secret of Object.values(fakeSecrets)) {
        assert.strictEqual(mappedSerialized.includes(String(secret)), false, `structured error leaked ${secret}`);
      }
      assert.ok(mapped.diagnostics?.rawMessage.includes("[REDACTED]") || mapped.dataverse?.message?.includes("[REDACTED]"));
      const response = formatDvqrMcpToolResponse(
        mapped.summary,
        mapped,
        { enabled: true, maxCharacters: 32768 },
        true
      );
      const serialized = JSON.stringify(response);
      for (const secret of Object.values(fakeSecrets)) {
        assert.strictEqual(serialized.includes(String(secret)), false, error.message);
      }
      assert.strictEqual(response.isError, true);
      assert.strictEqual((response.structuredContent as any).contractVersion, "dvqr-mcp-structured-execution-error-v1");
    }
  });

  test("A13 dispatcher redacts nested errors, secret-like keys, text mirror and stack-shaped diagnostics", async () => {
    const freeAdapter = {
      executeOData: async () => ({
        ok: false,
        code: "ExecutionFailed",
        message: `provider failed ${fakeSecrets.apiKey}`,
        structuredError: {
          contractVersion: "dvqr-mcp-structured-execution-error-v1",
          code: "ExecutionFailed",
          summary: `Authorization: Bearer ${fakeSecrets.bearer}`,
          transport: {
            primary: {
              kind: "node-fetch",
              outcome: "failed",
              message: `TLS failure ${fakeSecrets.clientSecret}`
            }
          },
          dataverse: {
            message: `ConnectionString=${fakeSecrets.connectionString}`,
            category: "DataverseRequestFailed"
          },
          diagnostics: {
            rawMessage: `Error: failed\n    at provider (${fakeSecrets.apiKey})`
          },
          suggestedNextActions: []
        }
      })
    };
    const dispatcher = new DvqrMcpLiveToolDispatcher(config, freeAdapter as any);
    const response = await dispatcher.dispatch({
      name: "dvqr_execute_odata",
      arguments: { query: "contacts?$top=1" }
    });

    assert.strictEqual(response.isError, true);
    const serialized = JSON.stringify(response);
    for (const secret of Object.values(fakeSecrets)) {
      assert.strictEqual(serialized.includes(String(secret)), false);
    }
    assert.ok(response.content.some((item) => item.text.includes("[REDACTED]")));
  });

  test("A13 redacts credential assignments, SAS signatures and connection-string fragments", () => {
    const raw = [
      `Authorization: Bearer ${fakeSecrets.bearer}`,
      `ClientSecret=${fakeSecrets.clientSecret}`,
      `ApiKey=${fakeSecrets.apiKey}`,
      `ConnectionString=${fakeSecrets.connectionString}`,
      "Endpoint=sb://example/;SharedAccessKey=abc123;SharedAccessSignature=xyz987",
      "https://example.invalid/resource?sig=signature-value"
    ].join(" | ");
    const redacted = String(redactMcpOutput(raw));
    assert.doesNotMatch(redacted, /abc123|xyz987|signature-value/);
    for (const secret of Object.values(fakeSecrets)) {
      assert.strictEqual(redacted.includes(String(secret)), false);
    }
  });

  test("A13 bare environment secret cannot be persisted in an investigation", () => {
    const repository = new WorkspaceInvestigationRepository(root);
    const service = new InvestigationApplicationService(repository, "https://example.crm.dynamics.com");
    assert.throws(
      () => service.start({
        question: `Investigate provider output ${fakeSecrets.clientSecret}`,
        subject: { kind: "General" }
      }),
      /secret-like/i
    );
    assert.strictEqual(fs.existsSync(path.join(root, ".dvforgelab", "dvqr", "investigations", "index.json")), false);
  });

  test("A13 bare environment secret cannot be persisted as investigation evidence", () => {
    const repository = new WorkspaceInvestigationEvidenceRepository(root);
    assert.throws(
      () => repository.save({
        investigationId: "inv-00000000-0000-0000-0000-000000000001",
        evidenceId: "ev-00000000-0000-0000-0000-000000000001",
        fingerprint: "test",
        evidenceType: "Metadata",
        providerId: "test",
        status: "Acquired",
        summary: `provider detail ${fakeSecrets.connectionString}`,
        payload: {},
        provenance: { acquiredAt: "2026-08-27T00:00:00.000Z" },
        limitations: [],
        recommendations: []
      } as any),
      /secret-like/i
    );
  });

  test("A13 bare environment secret cannot be persisted in investigation journal text", () => {
    const journal = new WorkspaceInvestigationJournalRepository(root);
    assert.throws(
      () => journal.append({
        investigationId: "inv-00000000-0000-0000-0000-000000000001",
        occurredAt: "2026-08-27T00:00:00.000Z",
        kind: "EvidenceFailed",
        summary: `file/provider failure ${fakeSecrets.apiKey}`,
        providerId: "test",
        outcome: "Failed"
      }),
      /secret-like/i
    );
    const journalRoot = path.join(root, ".dvforgelab", "dvqr", "investigations", "journal");
    assert.strictEqual(fs.existsSync(journalRoot), false);
  });
});
