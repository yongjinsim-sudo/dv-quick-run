import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";

suite("open-core boundaries", () => {
  test("core modules do not import pro, team, enterprise, or premium modules", () => {
    const coreRoot = path.join(__dirname, "..", "..", "core");
    const offenders: string[] = [];

    for (const file of walk(coreRoot)) {
      if (!file.endsWith(".js")) {
        continue;
      }

      const content = fs.readFileSync(file, "utf8");
      if (/from ["'].*\/(pro|team|enterprise|premium)\//.test(content) || /from ["']\.\.\/(pro|team|enterprise|premium)\//.test(content)) {
        offenders.push(path.relative(coreRoot, file));
      }
    }

    assert.deepStrictEqual(offenders, []);
  });

  test("public compatibility shims do not import ignored Pro implementation modules", () => {
    const premiumRoot = path.join(__dirname, "..", "..", "premium");
    const offenders: string[] = [];

    for (const file of walk(premiumRoot)) {
      if (!file.endsWith(".js")) {
        continue;
      }

      const content = fs.readFileSync(file, "utf8");
      if (/from ["'].*\/(pro|team|enterprise)\//.test(content) || /from ["']\.\.\/(pro|team|enterprise)\//.test(content)) {
        offenders.push(path.relative(premiumRoot, file));
      }
    }

    assert.deepStrictEqual(offenders, []);
  });

  test("gitignore protects future proprietary implementation boundaries", () => {
    const gitignore = fs.readFileSync(path.join(__dirname, "..", "..", "..", ".gitignore"), "utf8");

    assert.ok(gitignore.includes("/src/pro/**"));
    assert.ok(gitignore.includes("!/src/pro/.gitkeep"));
    assert.ok(gitignore.includes("/src/team/**"));
    assert.ok(gitignore.includes("!/src/team/.gitkeep"));
    assert.ok(gitignore.includes("/src/enterprise/**"));
    assert.ok(gitignore.includes("!/src/enterprise/.gitkeep"));
  });

  test("public repository keeps proprietary folders limited to approved scaffolding", () => {
      const repoRoot = path.join(__dirname, "..", "..", "..");

      const allowedFilesByFolder: Record<string, string[]> = {
          pro: ["index.ts", "providers"],
          team: ["index.ts"],
          enterprise: ["index.ts"]
      };

      for (const folder of ["pro", "team", "enterprise"]) {
          const folderPath = path.join(repoRoot, "src", folder);

          const visibleFiles = fs.existsSync(folderPath)
              ? fs.readdirSync(folderPath).filter((entry) => entry !== ".gitkeep")
              : [];

          assert.deepStrictEqual(
              visibleFiles.sort(),
              allowedFilesByFolder[folder].sort()
          );
      }
  });
});

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const resolved = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(resolved) : [resolved];
  });
}
