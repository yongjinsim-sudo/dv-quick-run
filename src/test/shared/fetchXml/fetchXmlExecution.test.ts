import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  extractFetchXmlRootEntityName,
  prepareFetchXmlQuery
} from "../../../shared/fetchXml/fetchXmlExecution.js";

type FakeMemento = {
  values: Record<string, unknown>;
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): Promise<void>;
};

function makeMemento(seed: Record<string, unknown> = {}): FakeMemento {
  return {
    values: { ...seed },
    get<T>(key: string): T | undefined {
      return this.values[key] as T | undefined;
    },
    async update(key: string, value: unknown): Promise<void> {
      if (typeof value === "undefined") {
        delete this.values[key];
        return;
      }

      this.values[key] = value;
    }
  };
}

function makeExtensionContext() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-fetchxml-test-"));

  return {
    globalState: makeMemento(),
    workspaceState: makeMemento(),
    globalStorageUri: { fsPath: path.join(root, "global") },
    storageUri: { fsPath: path.join(root, "workspace") }
  } as any;
}

function removeTestStorage(ctx: any) {
  const roots = [ctx.globalStorageUri?.fsPath, ctx.storageUri?.fsPath].filter(Boolean);
  for (const root of roots) {
    fs.rmSync(path.dirname(root), { recursive: true, force: true });
  }
}

suite("fetchXmlExecution", () => {
  test("extracts root entity name with double quotes", () => {
    const xml = `
<fetch top="5">
  <entity name="contact">
    <attribute name="fullname" />
  </entity>
</fetch>`;

    assert.strictEqual(extractFetchXmlRootEntityName(xml), "contact");
  });

  test("extracts root entity name with single quotes", () => {
    const xml = `
<fetch top='5'>
  <entity name='account'>
    <attribute name='name' />
  </entity>
</fetch>`;

    assert.strictEqual(extractFetchXmlRootEntityName(xml), "account");
  });

  test("returns undefined when root entity name is missing", () => {
    const xml = `
<fetch>
  <entity>
    <attribute name="fullname" />
  </entity>
</fetch>`;

    assert.strictEqual(extractFetchXmlRootEntityName(xml), undefined);
  });

  test("prepareFetchXmlQuery throws when root entity name is missing", async () => {
    const xml = `
<fetch>
  <entity>
    <attribute name="fullname" />
  </entity>
</fetch>`;

    const fakeCtx = {} as any;

    await assert.rejects(
      () => prepareFetchXmlQuery(xml, fakeCtx),
      /Could not determine FetchXML root entity name/i
    );
  });

  test("prepareFetchXmlQuery resolves entity set and builds request path", async () => {
    const xml = `
<fetch top="5">
  <entity name="contact">
    <attribute name="fullname" />
  </entity>
</fetch>`;

    const ext = makeExtensionContext();

    const fakeClient = {
      async get(path: string, _token: string) {
        if (path.startsWith("/EntityDefinitions")) {
          return {
            value: [
              {
                EntitySetName: "contacts",
                LogicalName: "contact"
              }
            ]
          };
        }

        throw new Error(`Unexpected path: ${path}`);
      }
    };

    const fakeCtx = {
      ext,
      output: { appendLine: (_msg: string) => undefined },
      envContext: {
        getEnvironmentName: () => "DEV"
      },
      getScope: () => "scope",
      getToken: async (_scope: string) => "token",
      getClient: () => fakeClient
    } as any;

    try {
      const prepared = await prepareFetchXmlQuery(xml, fakeCtx);

      assert.strictEqual(prepared.logicalEntityName, "contact");
      assert.strictEqual(prepared.entitySetName, "contacts");
      assert.ok(prepared.requestPath.startsWith("/contacts?fetchXml="));
      assert.ok(prepared.requestPath.includes("%3Cfetch"));
      assert.ok(prepared.requestPath.includes("%22"));
    } finally {
      removeTestStorage(ext);
    }
  });

  test("request path always starts with slash", async () => {
    const xml = `
<fetch>
  <entity name="contact">
    <attribute name="fullname" />
  </entity>
</fetch>`;

    const ext = makeExtensionContext();

    const fakeClient = {
      async get(path: string, _token: string) {
        if (path.startsWith("/EntityDefinitions")) {
          return {
            value: [
              {
                EntitySetName: "contacts",
                LogicalName: "contact"
              }
            ]
          };
        }

        throw new Error(`Unexpected path: ${path}`);
      }
    };

    const fakeCtx = {
      ext,
      output: { appendLine: (_msg: string) => undefined },
      envContext: {
        getEnvironmentName: () => "DEV"
      },
      getScope: () => "scope",
      getToken: async (_scope: string) => "token",
      getClient: () => fakeClient
    } as any;

    try {
      const prepared = await prepareFetchXmlQuery(xml, fakeCtx);
      assert.ok(prepared.requestPath.startsWith("/"));
    } finally {
      removeTestStorage(ext);
    }
  });

  test("prepareFetchXmlQuery throws when entity set cannot be resolved", async () => {
    const xml = `
<fetch>
  <entity name="missingentity">
    <attribute name="fullname" />
  </entity>
</fetch>`;

    const ext = makeExtensionContext();

    const fakeClient = {
      async get(path: string, _token: string) {
        if (path.startsWith("/EntityDefinitions")) {
          return {
            value: [
              {
                EntitySetName: "contacts",
                LogicalName: "contact"
              }
            ]
          };
        }

        throw new Error(`Unexpected path: ${path}`);
      }
    };

    const fakeCtx = {
      ext,
      output: { appendLine: (_msg: string) => undefined },
      envContext: {
        getEnvironmentName: () => "DEV"
      },
      getScope: () => "scope",
      getToken: async (_scope: string) => "token",
      getClient: () => fakeClient
    } as any;

    try {
      await assert.rejects(
        () => prepareFetchXmlQuery(xml, fakeCtx),
        /Could not resolve entity set name/i
      );
    } finally {
      removeTestStorage(ext);
    }
  });
});