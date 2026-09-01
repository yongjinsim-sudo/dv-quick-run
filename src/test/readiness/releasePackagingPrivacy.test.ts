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

  test("does not hard-code stale MCP release identities", () => {
    const root = workspaceRoot();
    const payload = fs.readFileSync(path.join(root, "src", "mcp", "mcpCapabilityPayload.ts"), "utf8");
    const manifest = fs.readFileSync(path.join(root, "src", "mcp", "mcpCapabilityManifest.ts"), "utf8");
    const server = fs.readFileSync(path.join(root, "src", "mcp", "dvqrMcpStdioServer.ts"), "utf8");
    for (const source of [payload, manifest, server]) {
      assert.match(source, /getDvqrReleaseVersion/);
      assert.doesNotMatch(source, /releaseVersion:\s*["']0\.15\./);
      assert.doesNotMatch(source, /MCP_SERVER_VERSION[^\n]+\|\|\s*["']0\.15\./);
    }
  });

  test("keeps tests, source maps, agent residue, secrets, and stale trees out of the VSIX", () => {
    const ignore = fs.readFileSync(path.join(workspaceRoot(), ".vscodeignore"), "utf8");
    const requiredPatterns = [
      ".vscode-test/**",
      "vscode/**",
      ".dvforgelab/**",
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
      "*.dvqr-license.json",
      "docs/**/*.md",
      "docs/**/*.txt",
      "docs/**/*.json",
      "docs/**/*.log",
      "docs/security/**"
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
      /\bcustomername\b/i,
      /\bconsultingpartner\b/i,
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

  test("keeps v1.0.0 package identity and v1 public release surfaces customer-neutral", () => {
    const root = workspaceRoot();
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as { version: string };
    assert.strictEqual(packageJson.version, "1.0.0");

    const surfaces = [
      fs.readFileSync(path.join(root, "README.md"), "utf8"),
      fs.readFileSync(path.join(root, "src", "mcp", "mcpLiveToolCatalogue.ts"), "utf8"),
      fs.readFileSync(path.join(root, "src", "commands", "hub", "dvQuickRunHubContent.ts"), "utf8"),
      fs.readFileSync(path.join(root, "src", "runtime", "proWelcomeLifecycle.ts"), "utf8"),
      fs.readFileSync(path.join(root, "src", "webview", "hub", "markup.ts"), "utf8")
    ].join("\n");

    assert.doesNotMatch(surfaces, /MCP Security Hardening II/);
    assert.doesNotMatch(surfaces, /v1\.0\.0 (?:is the )?(?:starting )?baseline/i);
    assert.doesNotMatch(surfaces, /Pass 10\.[0-9]/);
    for (const pattern of [
      /\bcustomername\b/i,
      /privateorg\.crm\d*\.dynamics\.com/i,
      /\bmsemr_/i,
      /\bsample_task\b/i,
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i
    ]) {
      assert.doesNotMatch(surfaces, pattern, "v1.0.0 public release surface contains customer-specific material.");
    }
  });

  test("keeps v1 public messaging bounded and non-authoritative", () => {
    const root = workspaceRoot();
    const surfaces = [
      fs.readFileSync(path.join(root, "README.md"), "utf8"),
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
    assert.match(surfaces, /not a security certification/i);
    assert.match(surfaces, /Participation is not causality/i);
    assert.match(surfaces, /Humans retain operational authority/i);
    assert.match(surfaces, /local MCP|MCP server|stdio/i);
  });
});
