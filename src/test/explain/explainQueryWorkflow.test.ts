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
      parseQuery: () => parsed,
      analyse: async () => ({ entity: { logicalName: "contact" } as any, validationIssues: [{ severity: "warning", message: "ok" }] as any }),
      buildMarkdown: (_parsed, entity, issues) => `entity=${entity?.logicalName};issues=${issues.length}`,
      openPreview: async (markdown: string) => { previewMarkdown = markdown; },
      logDebugMessage: (_output: any, message: string) => { debug.push(message); },
      logInfoMessage: (_output: any, message: string) => { info.push(message); },
      showInformationMessage: async (message: string) => { messages.push(message); return undefined; }
    });

    assert.ok(debug[0].includes("entitySet=contacts"));
    assert.ok(info[0].includes("contacts"));
    assert.strictEqual(previewMarkdown, "entity=contact;issues=1");
    assert.strictEqual(messages[0], "DV Quick Run: Query explained.");
  });

  test("throws when no query text is found", async () => {
    await assert.rejects(
      () => runExplainQueryWorkflowWithDeps({ output: {} } as any, {
        resolveText: () => undefined,
        parseQuery: () => parsed,
        analyse: async () => ({ entity: undefined, validationIssues: [] }),
        buildMarkdown: () => "",
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
        parseQuery: () => ({ ...parsed, entitySetName: undefined }),
        analyse: async () => ({ entity: undefined, validationIssues: [] }),
        buildMarkdown: () => "",
        openPreview: async () => undefined,
        logDebugMessage: () => undefined,
        logInfoMessage: () => undefined,
        showInformationMessage: async () => undefined
      }),
      /Could not detect entity set/
    );
  });
});
