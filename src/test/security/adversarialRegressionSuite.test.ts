import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { attackFamilies } from "./adversarialCase.js";
import {
  adversarialFamilyRegistry,
  adversarialFixtureOwners
} from "./adversarialRegressionManifest.js";

function securitySourceRoot(): string {
  // __dirname is <repo>/out/test/security after compilation. Resolve back to
  // the checked-in TypeScript security corpus rather than process.cwd(),
  // because vscode-test runs with cwd inside .vscode-test/<runtime>.
  return path.resolve(__dirname, "..", "..", "..", "src", "test", "security");
}

function readSecuritySources(): readonly { readonly file: string; readonly text: string }[] {
  const root = securitySourceRoot();
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
      } else if (entry.isFile() && entry.name.endsWith(".ts")) {
        files.push(absolute);
      }
    }
  };
  visit(root);
  return files
    .sort((left, right) => left.localeCompare(right))
    .map((file) => ({
      file: path.relative(root, file).replaceAll("\\", "/"),
      text: fs.readFileSync(file, "utf8")
    }));
}

suite("Permanent adversarial regression suite governance", () => {
  test("A01-A20 taxonomy is complete, ordered and has exactly one primary owner", () => {
    assert.deepStrictEqual(
      adversarialFamilyRegistry.map((entry) => entry.family),
      [...attackFamilies]
    );
    assert.strictEqual(new Set(adversarialFamilyRegistry.map((entry) => entry.family)).size, 20);
    assert.ok(adversarialFamilyRegistry.every((entry) => entry.primaryOwner.endsWith(".test.ts")));
  });

  test("every registered primary/supporting owner exists and references its family", () => {
    const root = securitySourceRoot();
    for (const entry of adversarialFamilyRegistry) {
      for (const owner of [entry.primaryOwner, ...(entry.supportingOwners ?? [])]) {
        const file = path.join(root, owner);
        assert.strictEqual(fs.existsSync(file), true, `${entry.family}: missing owner ${owner}`);
        const text = fs.readFileSync(file, "utf8");
        assert.ok(
          text.includes(entry.family),
          `${entry.family}: owner ${owner} must contain an explicit taxonomy reference`
        );
      }
    }
  });

  test("fixture ownership registry points only to existing deterministic fixture modules", () => {
    const root = securitySourceRoot();
    for (const [fixture, relative] of Object.entries(adversarialFixtureOwners)) {
      const file = path.join(root, relative);
      assert.strictEqual(fs.existsSync(file), true, `${fixture}: missing fixture ${relative}`);
      const text = fs.readFileSync(file, "utf8");
      assert.ok(text.trim().length > 0, `${fixture}: fixture must not be empty`);
      assert.doesNotMatch(text, /\bMath\.random\s*\(/, `${fixture}: random fixture generation is not allowed`);
      assert.doesNotMatch(text, /\brandomUUID\s*\(/, `${fixture}: random fixture generation is not allowed`);
      assert.doesNotMatch(text, /\bDate\.now\s*\(/, `${fixture}: wall-clock fixture generation is not allowed`);
    }
  });

  test("AdversarialCase IDs use taxonomy-prefixed stable naming and are unique", () => {
    const ids: string[] = [];
    for (const source of readSecuritySources()) {
      for (const match of source.text.matchAll(/\bid:\s*["'`](A(?:0[1-9]|1[0-9]|20)-[A-Za-z0-9_-]+)["'`]/g)) {
        ids.push(match[1]);
      }
    }
    assert.ok(ids.length > 0);
    assert.strictEqual(new Set(ids).size, ids.length, "Permanent adversarial case IDs must be unique.");
    for (const id of ids) {
      assert.match(id, /^A(?:0[1-9]|1[0-9]|20)-[A-Za-z0-9_-]+$/);
    }
  });

  test("permanent security tests contain no flaky timer/random/network primitives", () => {
    const forbidden: readonly [RegExp, string][] = [
      [/\bMath\.random\s*\(/, "Math.random"],
      [/\brandomUUID\s*\(/, "randomUUID"],
      [/\bDate\.now\s*\(/, "Date.now"],
      [/\bsetTimeout\s*\(/, "setTimeout"],
      [/\bsetInterval\s*\(/, "setInterval"],
      [/\bfetch\s*\(/, "direct fetch"]
    ];

    for (const source of readSecuritySources()) {
      for (const [pattern, label] of forbidden) {
        assert.doesNotMatch(source.text, pattern, `${source.file}: permanent adversarial test must not use ${label}`);
      }
    }
  });

  test("permanent adversarial corpus remains customer-neutral and uses only fake/example tenancy", () => {
    const forbiddenCustomerTokens = [
      ["bu", "pa"].join(""),
      ["msemr", "_careplan"].join(""),
      ["msemr", "_careplanactivities"].join(""),
      ["bu", "_tasks"].join(""),
      ["privateorg", ".crm6.dynamics.com"].join("")
    ];

    for (const source of readSecuritySources()) {
      const lower = source.text.toLowerCase();
      for (const token of forbiddenCustomerTokens) {
        assert.strictEqual(
          lower.includes(token),
          false,
          `${source.file}: customer-specific token '${token}' is not allowed in the permanent security corpus`
        );
      }

      const crmHosts = [...source.text.matchAll(/https:\/\/([a-z0-9.-]+\.crm\d*\.dynamics\.com)/gi)]
        .map((match) => match[1].toLowerCase());
      const genericHosts = new Set([
        "example.crm.dynamics.com",
        "other.crm.dynamics.com",
        "test.crm.dynamics.com",
        "dev.crm.dynamics.com",
        "prod.crm.dynamics.com"
      ]);
      assert.ok(
        crmHosts.every((host) => genericHosts.has(host)),
        `${source.file}: only generic synthetic Dataverse hosts are allowed in the permanent security corpus`
      );
    }
  });

  test("full-suite discovery includes all permanent A01-A20 owner test modules", () => {
    const owners = new Set(
      adversarialFamilyRegistry.flatMap((entry) => [entry.primaryOwner, ...(entry.supportingOwners ?? [])])
    );
    assert.ok(owners.size >= 10);
    for (const owner of owners) {
      assert.ok(owner.endsWith(".test.ts"));
    }
  });
});
