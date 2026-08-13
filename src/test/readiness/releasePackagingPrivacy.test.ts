import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";

function workspaceRoot(): string {
  const candidates = [
    process.cwd(),
    path.join(__dirname, "..", "..", "..")
  ];
  const resolved = candidates.find((candidate) => fs.existsSync(path.join(candidate, "package.json")));
  assert.ok(resolved, "Workspace root was not found.");
  return resolved;
}

function filesUnder(directory: string, predicate: (file: string) => boolean): string[] {
  if (!fs.existsSync(directory)) {
    return [];
  }
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return filesUnder(item, predicate);
    }
    return entry.isFile() && predicate(item) ? [item] : [];
  });
}

suite("releasePackagingPrivacy", () => {
  test("locks one consistent version identity across package metadata", () => {
    const root = workspaceRoot();
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as { version: string };
    const packageLock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8")) as {
      version: string;
      packages: Record<string, { version?: string }>;
    };
    assert.match(packageJson.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, "package.json version must be a valid semver-like release identity");
    assert.strictEqual(packageLock.version, packageJson.version);
    assert.strictEqual(packageLock.packages[""].version, packageJson.version);
  });

  test("keeps tests, source maps, agent residue, secrets, and stale trees out of the VSIX", () => {
    const ignore = fs.readFileSync(path.join(workspaceRoot(), ".vscodeignore"), "utf8");
    const requiredPatterns = [
      ".vscode-test/**",
      ".agents/**",
      ".codex/**",
      ".git/**",
      "src/**",
      "**/*.map",
      "out/test/**",
      "AGENTS.md",
      "GLOBAL-AGENTS.template.md",
      "*.zip",
      "*.vsix",
      ".env.*",
      "*.pem",
      "*.key",
      "*.secret",
      "*.dvqr-license.json"
    ];
    for (const pattern of requiredPatterns) {
      assert.ok(ignore.includes(pattern), `Missing VSIX exclusion: ${pattern}`);
    }
  });

  test("packages the local read-only MCP runtime without network or mutation authority", () => {
    const root = workspaceRoot();
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      bin?: Record<string, string>;
    };
    assert.ok(packageJson.dependencies?.["@modelcontextprotocol/sdk"]);
    assert.strictEqual(packageJson.bin?.["dvqr-mcp"], "./out/mcp/dvqrMcpStdioServer.js");
    assert.strictEqual(fs.existsSync(path.join(root, "src", "mcp", "dvqrMcpStdioServer.ts")), true);

    const mcpFiles = filesUnder(path.join(root, "src", "mcp"), (file) => file.endsWith(".ts"));
    const mcpSource = mcpFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
    assert.doesNotMatch(mcpSource, /createServer|listen\s*\(|websocket|http\.createServer/i);
    assert.doesNotMatch(mcpSource, /\b(?:patch|delete)WithMetadata\b/i);
  });

  test("keeps public readiness fixtures and v0.15.3 documentation customer-neutral", () => {
    const root = workspaceRoot();
    const files = [
      ...filesUnder(path.join(root, "src", "test", "fixtures", "readiness"), (file) => file.endsWith(".json")),
      ...filesUnder(path.join(root, "docs"), (file) => /DV-Quick-Run-v0\.15\.3.*\.md$/.test(file)),
      path.join(root, "README.md"),
      path.join(root, "CHANGELOG.md"),
      path.join(root, "package.json")
    ];
    const forbidden = [
      /\bbupa\b/i,
      /\binfosys\b/i,
      /\bmsemr_/i,
      /\bbu_[a-z0-9_]+/i,
      /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i,
      /\b(?:client[_-]?secret|access[_-]?token|refresh[_-]?token|private[_-]?key)\b\s*[:=]/i,
      /\bBearer\s+[A-Za-z0-9._~+/-]+=*/i
    ];
    assert.ok(files.length >= 8);
    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      for (const pattern of forbidden) {
        assert.doesNotMatch(content, pattern, `${path.relative(root, file)} contains non-public fixture wording.`);
      }
    }
  });

  test("keeps public v0.15.3 messaging bounded and non-authoritative", () => {
    const root = workspaceRoot();
    const surfaces = [
      fs.readFileSync(path.join(root, "README.md"), "utf8"),
      fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8"),
      fs.readFileSync(path.join(root, "src", "commands", "hub", "dvQuickRunHubContent.ts"), "utf8"),
      fs.readFileSync(path.join(root, "src", "runtime", "proWelcomeLifecycle.ts"), "utf8")
    ].join("\n");
    for (const phrase of [
      "Complete evidence guaranteed",
      "Root cause readiness score",
      "Certified investigation",
      "AI-verified conclusion",
      "Automatic RCA"
    ]) {
      assert.strictEqual(surfaces.includes(phrase), false, `Prohibited public claim: ${phrase}`);
    }
    assert.match(surfaces, /does not certify|never certifies/i);
    assert.match(surfaces, /local MCP|MCP server|stdio/i);
  });
});
