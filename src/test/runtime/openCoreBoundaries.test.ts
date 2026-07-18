import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { describeOpenCoreBoundary, openCoreBoundaryRules } from "../../core/openCore/index.js";

suite("open-core boundaries", function () {
  // Repository-wide boundary checks perform synchronous filesystem scans.
  // Keep the assertions strict while allowing slower Windows/VS Code test hosts
  // enough time to complete the scan.
  this.timeout(10_000);
  test("canonical open-core boundary wording remains stable", () => {
    assert.strictEqual(
      describeOpenCoreBoundary(),
      "Core owns understanding. Pro owns acceleration. Internal tooling never ships."
    );

    assert.deepStrictEqual(openCoreBoundaryRules.find((rule) => rule.sourceLayer === "core")?.forbiddenImports, [
      "pro",
      "team",
      "enterprise",
      "internal"
    ]);
  });

  test("core modules do not import proprietary or private implementation layers", () => {
    assertNoForbiddenLayerImports("src/core", ["pro", "team", "enterprise", "internal"]);
  });

  test("product modules remain independent from proprietary implementation layers", () => {
    assertNoForbiddenLayerImports("src/product", ["pro", "team", "enterprise", "internal"]);
  });

  test("runtime modules do not import future team, enterprise, or private internal layers", () => {
    assertNoForbiddenLayerImports("src/runtime", ["team", "enterprise", "internal"]);
  });

  test("private internal tooling does not leak into runtime source", () => {
    const runtimeRoots = ["src/core", "src/product", "src/commands", "src/providers", "src/runtime", "src/services", "src/webview"];
    const offenders = runtimeRoots.flatMap((root) => findForbiddenLayerImports(root, ["internal"]));

    assert.deepStrictEqual(offenders, []);
  });

  test("gitignore protects proprietary and private implementation boundaries", () => {
    const gitignore = fs.readFileSync(path.join(repoRoot(), ".gitignore"), "utf8");

    assert.ok(gitignore.includes("/src/pro/**"));
    assert.ok(gitignore.includes("!/src/pro/.gitkeep"));
    assert.ok(gitignore.includes("/src/team/**"));
    assert.ok(gitignore.includes("!/src/team/.gitkeep"));
    assert.ok(gitignore.includes("/src/enterprise/**"));
    assert.ok(gitignore.includes("!/src/enterprise/.gitkeep"));
    assert.ok(gitignore.includes("/src/internal/**"));
    assert.ok(gitignore.includes("!/src/internal/.gitkeep"));
    assert.ok(gitignore.includes("/tools/license-generator/**"));
  });
});

function assertNoForbiddenLayerImports(sourceRoot: string, forbiddenLayers: readonly string[]): void {
  assert.deepStrictEqual(findForbiddenLayerImports(sourceRoot, forbiddenLayers), []);
}

const importSpecifierCache = new Map<string, readonly string[]>();

function findForbiddenLayerImports(sourceRoot: string, forbiddenLayers: readonly string[]): readonly string[] {
  const absoluteRoot = path.join(repoRoot(), sourceRoot);
  const offenders: string[] = [];

  for (const file of walkTypeScriptFiles(absoluteRoot)) {
    const imports = getImportSpecifiers(file);
    const relativeFile = path.relative(repoRoot(), file);

    for (const specifier of imports) {
      const resolvedImport = resolveImportPath(path.dirname(file), specifier);
      if (!resolvedImport) {
        continue;
      }

      const relativeImport = normalizePath(path.relative(repoRoot(), resolvedImport));
      const forbiddenLayer = forbiddenLayers.find((layer) => relativeImport === `src/${layer}` || relativeImport.startsWith(`src/${layer}/`));
      if (forbiddenLayer) {
        offenders.push(`${normalizePath(relativeFile)} -> ${specifier} (${forbiddenLayer})`);
      }
    }
  }

  return offenders.sort();
}

function extractImportSpecifiers(content: string): readonly string[] {
  const specifiers: string[] = [];
  const importRegex = /(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;
  const dynamicImportRegex = /import\(\s*["']([^"']+)["']\s*\)/g;

  for (const match of content.matchAll(importRegex)) {
    specifiers.push(match[1]);
  }

  for (const match of content.matchAll(dynamicImportRegex)) {
    specifiers.push(match[1]);
  }

  return specifiers;
}

function resolveImportPath(fromDir: string, specifier: string): string | undefined {
  if (!specifier.startsWith(".")) {
    return undefined;
  }

  const withoutJsExtension = specifier.endsWith(".js") ? specifier.slice(0, -3) : specifier;
  return path.resolve(fromDir, withoutJsExtension);
}

function getImportSpecifiers(file: string): readonly string[] {
  const cached = importSpecifierCache.get(file);
  if (cached) {
    return cached;
  }

  const specifiers = extractImportSpecifiers(fs.readFileSync(file, "utf8"));
  importSpecifierCache.set(file, specifiers);
  return specifiers;
}

function walkTypeScriptFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files: string[] = [];
  const pending = [dir];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) {
      continue;
    }

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const resolved = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(resolved);
      } else if (entry.isFile() && entry.name.endsWith(".ts")) {
        files.push(resolved);
      }
    }
  }

  return files;
}

function repoRoot(): string {
  return path.join(__dirname, "..", "..", "..");
}

function normalizePath(value: string): string {
  return value.split(path.sep).join("/");
}
