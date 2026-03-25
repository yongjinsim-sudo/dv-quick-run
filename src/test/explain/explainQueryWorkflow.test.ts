import * as assert from "assert";
import { runExplainQueryWorkflowWithDeps } from "../../commands/router/actions/explain/explainQueryWorkflow.js";
import type { ParsedDataverseQuery } from "../../commands/router/actions/explain/explainQueryTypes.js";

const parsed: ParsedDataverseQuery = {
  raw: "contacts?$select=fullname",
  normalized: "contacts?$select=fullname",
  pathPart: "contacts",
  queryPart: "$select=fullname",
  entitySetName: "contacts",
  isSingleRecord: false,
  isCollection: true,
  params: [],
  select: ["fullname"],
  orderBy: [],
  expand: [],
  unknownParams: []
};

suite("explainQueryWorkflow", () => {
  test("builds markdown, opens preview, and shows success message", async () => {
    const debug: string[] = [];
    const info: string[] = [];
    const messages: string[] = [];
    let previewMarkdown = "";

    await runExplainQueryWorkflowWithDeps({ output: {} } as any, {
      resolveText: () => "contacts?$select=fullname",
      detectKind: () => "odata",
      parseQuery: () => parsed,
      analyse: async () => ({ entity: { logicalName: "contact" } as any, validationIssues: [{ severity: "warning", message: "ok" }] as any }),
      buildMarkdown: (_parsed, entity, issues, _notes, diagnostics) => `entity=${entity?.logicalName};issues=${issues.length};diagnostics=${diagnostics.findings.length}`,
      resolveCapabilities: () => ({ queryDoctor: 1, investigationDepth: 1, traversalDepth: 0 }),
      buildFetchXmlMarkdown: async () => "",
      loadFieldsForEntity: async () => [],
      openPreview: async (markdown: string) => { previewMarkdown = markdown; },
      logDebugMessage: (_output: any, message: string) => { debug.push(message); },
      logInfoMessage: (_output: any, message: string) => { info.push(message); },
      showInformationMessage: async (message: string) => { messages.push(message); return undefined; }
    });

    assert.ok(debug[0].includes("entitySet=contacts"));
    assert.ok(info.some((message) => message.includes("contacts")));
    assert.strictEqual(previewMarkdown, "entity=contact;issues=1;diagnostics=1");
    assert.strictEqual(messages[0], "DV Quick Run: Query explained.");
  });

  test("throws when no query text is found", async () => {
    await assert.rejects(
      () => runExplainQueryWorkflowWithDeps({ output: {} } as any, {
        resolveText: () => undefined,
        detectKind: () => "odata",
        parseQuery: () => parsed,
        analyse: async () => ({ entity: undefined, validationIssues: [] }),
        buildMarkdown: () => "",
        resolveCapabilities: () => ({ queryDoctor: 1, investigationDepth: 1, traversalDepth: 0 }),
        buildFetchXmlMarkdown: async () => "",
        loadFieldsForEntity: async () => [],
        openPreview: async () => undefined,
        logDebugMessage: () => undefined,
        logInfoMessage: () => undefined,
        showInformationMessage: async () => undefined
      }),
      /No Dataverse query found/
    );
  });

  test("throws when entity set cannot be detected", async () => {
    await assert.rejects(
      () => runExplainQueryWorkflowWithDeps({ output: {} } as any, {
        resolveText: () => "???",
        detectKind: () => "odata",
        parseQuery: () => ({ ...parsed, entitySetName: undefined }),
        analyse: async () => ({ entity: undefined, validationIssues: [] }),
        buildMarkdown: () => "",
        resolveCapabilities: () => ({ queryDoctor: 1, investigationDepth: 1, traversalDepth: 0 }),
        buildFetchXmlMarkdown: async () => "",
        loadFieldsForEntity: async () => [],
        openPreview: async () => undefined,
        logDebugMessage: () => undefined,
        logInfoMessage: () => undefined,
        showInformationMessage: async () => undefined
      }),
      /Could not detect entity set/
    );
  });
  test("routes FetchXML queries through FetchXML explain pipeline", async () => {
    let previewMarkdown = "";

    await runExplainQueryWorkflowWithDeps({ output: {} } as any, {
      resolveText: () => `<fetch><entity name="contact" /></fetch>`,
      detectKind: () => "fetchxml",
      parseQuery: () => parsed,
      analyse: async () => ({ entity: undefined, validationIssues: [] }),
      buildMarkdown: () => "odata-markdown",
      resolveCapabilities: () => ({ queryDoctor: 1, investigationDepth: 1, traversalDepth: 0 }),
      buildFetchXmlMarkdown: async () => "fetchxml-markdown",
      loadFieldsForEntity: async () => [],
      openPreview: async (markdown: string) => { previewMarkdown = markdown; },
      logDebugMessage: () => undefined,
      logInfoMessage: () => undefined,
      showInformationMessage: async () => undefined
    });

    assert.strictEqual(previewMarkdown, "fetchxml-markdown");
  });

});
