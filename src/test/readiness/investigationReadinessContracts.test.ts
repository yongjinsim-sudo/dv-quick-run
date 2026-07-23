import * as assert from "assert";
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import {
  CROSS_DIFF_READINESS_PROFILE_V1,
  INVESTIGATION_READINESS_SCHEMA_V1,
  READINESS_FRESHNESS_RULES_V1,
  READINESS_GAP_RULES_V1,
  TIMELINE_READINESS_PROFILE_V1,
  canonicalizeReadinessJson,
  fingerprintReadinessRequest,
  resolveReadinessProfile,
  serializeReadinessError,
  serializeReadinessRequest,
  serializeReadinessResult,
  type InvestigationReadinessErrorV1,
  type InvestigationReadinessRequestV1,
  type InvestigationReadinessResultV1
} from "../../core/readiness/index.js";
import { createJsonSchemaTestValidator, type JsonSchemaTestValidator } from "./jsonSchemaTestValidator.js";

interface CatalogueProfile {
  profileId: string;
  version: string;
  investigationKind: string;
  contributors: { id: string; role: string; appliesWhen: string; absenceBehavior: string }[];
}

interface CatalogueGapRule {
  ruleId: string;
  category: string;
  priority: string;
  trigger: string;
  recommendationFamily: string;
  fixture: { role: string; state: string; expectedPostureCeiling: string };
}

interface Phase0Catalogue {
  profiles: CatalogueProfile[];
  gapRules: CatalogueGapRule[];
  freshnessPolicies: {
    evidenceFamily: string;
    thresholdOwner: string;
    evaluation: string;
    withoutExplicitThreshold: string;
  }[];
}

interface GoldenFixtureSet {
  canonicalization: { excludedRequestFields: string[] };
  scenarios: {
    id: string;
    request: unknown;
    expected: { inputFingerprint: string };
  }[];
}

interface Phase1Snapshots {
  fixtureContractVersion: string;
  releaseVersion: string;
  requestScenarioId: string;
  profileCanonicalSha256: Record<string, string>;
  gapRegistryCanonicalSha256: string;
  result: InvestigationReadinessResultV1;
  errors: InvestigationReadinessErrorV1[];
}

function fixturePath(fileName: string): string {
  const candidates = [
    path.join(process.cwd(), "src", "test", "fixtures", "readiness", fileName),
    path.join(__dirname, "..", "fixtures", "readiness", fileName),
    path.join(__dirname, "..", "..", "..", "src", "test", "fixtures", "readiness", fileName)
  ];
  const resolved = candidates.find((candidate) => fs.existsSync(candidate));
  assert.ok(resolved, `Readiness fixture not found: ${fileName}`);
  return resolved;
}

function readFixture<T>(fileName: string): T {
  return JSON.parse(fs.readFileSync(fixturePath(fileName), "utf8")) as T;
}

function validator(fragment?: string): JsonSchemaTestValidator {
  return createJsonSchemaTestValidator(INVESTIGATION_READINESS_SCHEMA_V1, fragment);
}

function assertValid(validate: JsonSchemaTestValidator, value: unknown, label: string): void {
  const errors = validate(value);
  assert.deepStrictEqual(errors, [], `${label}: ${JSON.stringify(errors)}`);
}

function canonicalSha256(value: unknown): string {
  return createHash("sha256").update(canonicalizeReadinessJson(value), "utf8").digest("hex");
}

function readinessSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const itemPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return readinessSourceFiles(itemPath);
    }
    return entry.isFile() && entry.name.endsWith(".ts") ? [itemPath] : [];
  });
}

function readinessSourceRoot(): string {
  const candidates = [
    path.join(process.cwd(), "src", "core", "readiness"),
    path.join(__dirname, "..", "..", "..", "src", "core", "readiness")
  ];
  const resolved = candidates.find((candidate) => fs.existsSync(candidate));
  assert.ok(resolved, "Readiness source root was not found from the workspace or compiled test location.");
  return resolved;
}

const catalogue = readFixture<Phase0Catalogue>("readiness-phase0-catalogue.fixture.json");
const golden = readFixture<GoldenFixtureSet>("readiness-phase0-golden-scenarios.fixture.json");
const snapshots = readFixture<Phase1Snapshots>("readiness-phase1-contract-snapshots.fixture.json");

suite("investigationReadinessContracts", () => {
  test("validates every Phase 0 request against the Draft 2020-12 request schema", () => {
    assert.strictEqual(INVESTIGATION_READINESS_SCHEMA_V1.$comment, "schema: dvqr.investigation-readiness; version: 1.0");
    const validateRequest = validator("request");
    for (const scenario of golden.scenarios) {
      assertValid(validateRequest, scenario.request, scenario.id);
    }

    const invalid = { ...(golden.scenarios[0].request as Record<string, unknown>), unexpected: true };
    assert.ok(validateRequest(invalid).length > 0, "The application boundary must reject unknown top-level request fields.");
  });

  test("validates result and error contract snapshots", () => {
    assert.strictEqual(snapshots.fixtureContractVersion, "investigation-readiness-phase1-contract-snapshots-v1");
    assert.strictEqual(snapshots.releaseVersion, "0.15.3");
    assertValid(validator("result"), snapshots.result, "result snapshot");
    for (const error of snapshots.errors) {
      assertValid(validator("error"), error, `error snapshot ${error.code}`);
    }

    const validateRoot = validator();
    assertValid(validateRoot, snapshots.result, "root result union");
    assertValid(validateRoot, snapshots.errors[0], "root error union");
  });

  test("locks versioned profile matrices to the Phase 0 authority", () => {
    const profiles = [TIMELINE_READINESS_PROFILE_V1, CROSS_DIFF_READINESS_PROFILE_V1];
    const validateProfile = validator("profile");
    for (const profile of profiles) {
      assertValid(validateProfile, profile, profile.profileId);
      const expected = catalogue.profiles.find((item) => item.profileId === profile.profileId);
      assert.ok(expected);
      assert.strictEqual(profile.version, expected.version);
      assert.strictEqual(profile.investigationKind, expected.investigationKind);
      assert.deepStrictEqual(
        profile.contributorRules.map((item) => [item.contributorId, item.role, item.absenceBehavior]),
        expected.contributors.map((item) => [item.id, item.role, item.absenceBehavior])
      );
      assert.ok(profile.contributorRules.every((item) => typeof item.appliesWhen === "object"));
      assert.deepStrictEqual(profile.gapRuleIds, READINESS_GAP_RULES_V1.map((item) => item.ruleId));
      assert.strictEqual(canonicalSha256(profile), snapshots.profileCanonicalSha256[profile.profileId]);
    }
  });

  test("locks all seven explicit freshness policies without hidden TTL defaults", () => {
    assert.strictEqual(READINESS_FRESHNESS_RULES_V1.length, 7);
    assert.deepStrictEqual(
      READINESS_FRESHNESS_RULES_V1.map((rule) => [rule.evidenceFamily, rule.owner, rule.evaluation, rule.withoutExplicitThreshold]),
      catalogue.freshnessPolicies.map((rule) => [rule.evidenceFamily, rule.thresholdOwner, rule.evaluation, rule.withoutExplicitThreshold])
    );
    assert.ok(READINESS_FRESHNESS_RULES_V1.every((rule) => !/\b\d+\s*(minute|hour|day)s?\b/i.test(rule.evaluation)));
  });

  test("locks exactly 18 schema-valid gap rule descriptors", () => {
    const validateRule = validator("gapRuleDescriptor");
    assert.strictEqual(READINESS_GAP_RULES_V1.length, 18);
    assert.strictEqual(new Set(READINESS_GAP_RULES_V1.map((item) => item.ruleId)).size, 18);
    for (const rule of READINESS_GAP_RULES_V1) {
      assertValid(validateRule, rule, rule.ruleId);
    }
    assert.deepStrictEqual(
      READINESS_GAP_RULES_V1.map((rule) => [rule.ruleId, rule.category, rule.priority, rule.trigger, rule.recommendationFamily, rule.expectedPostureCeiling]),
      catalogue.gapRules.map((rule) => [rule.ruleId, rule.category, rule.priority, rule.trigger, rule.recommendationFamily, rule.fixture.expectedPostureCeiling])
    );
    assert.strictEqual(canonicalSha256(READINESS_GAP_RULES_V1), snapshots.gapRegistryCanonicalSha256);
  });

  test("resolves profiles deterministically and returns structured errors", () => {
    const resolved = resolveReadinessProfile(
      { profileId: "cross-diff-mini-rca-v1", version: "1.0" },
      "cross-environment-diff"
    );
    assert.strictEqual(resolved.ok, true);
    if (resolved.ok) {
      assert.strictEqual(resolved.profile, CROSS_DIFF_READINESS_PROFILE_V1);
    }

    const unsupported = resolveReadinessProfile(
      { profileId: "timeline-mini-rca-v1", version: "2.0" as "1.0" },
      "timeline"
    );
    assert.strictEqual(unsupported.ok, false);
    if (!unsupported.ok) {
      assert.strictEqual(unsupported.error.code, "UnsupportedProfileVersion");
      assertValid(validator("error"), unsupported.error, "unsupported profile error");
    }

    const mismatch = resolveReadinessProfile(
      { profileId: "timeline-mini-rca-v1", version: "1.0" },
      "cross-environment-diff"
    );
    assert.strictEqual(mismatch.ok, false);
    if (!mismatch.ok) {
      assert.strictEqual(mismatch.error.code, "InvalidInput");
    }
  });

  test("serializes canonically and reproduces every locked Phase 0 fingerprint", () => {
    for (const scenario of golden.scenarios) {
      const request = scenario.request as InvestigationReadinessRequestV1;
      assert.strictEqual(fingerprintReadinessRequest(request), scenario.expected.inputFingerprint, scenario.id);
      assert.deepStrictEqual(JSON.parse(serializeReadinessRequest(request)), request);

      const changedGeneratedUtc = { ...request, generatedUtc: "2099-01-01T00:00:00.000Z" };
      assert.strictEqual(fingerprintReadinessRequest(changedGeneratedUtc), scenario.expected.inputFingerprint);
    }

    assert.deepStrictEqual(JSON.parse(serializeReadinessResult(snapshots.result)), snapshots.result);
    assert.deepStrictEqual(JSON.parse(serializeReadinessError(snapshots.errors[0])), snapshots.errors[0]);
    assert.strictEqual(
      canonicalizeReadinessJson({ z: 1, nested: { b: true, a: false }, a: 2 }),
      "{\"a\":2,\"nested\":{\"a\":false,\"b\":true},\"z\":1}"
    );
    assert.throws(() => canonicalizeReadinessJson(Number.NaN), /non-finite/);
    assert.throws(() => canonicalizeReadinessJson(new Date("2026-07-22T00:00:00.000Z")), /plain objects/);
    assert.throws(() => canonicalizeReadinessJson(new Array(1)), /undefined/);
  });

  test("keeps the application contract host-independent", () => {
    const sourceRoot = readinessSourceRoot();
    const files = readinessSourceFiles(sourceRoot);
    assert.ok(files.length >= 9);
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      assert.doesNotMatch(source, /from\s+["']vscode["']/, path.relative(process.cwd(), file));
      assert.doesNotMatch(source, /from\s+["'][^"']*(?:\/pro\/|\/ui\/|\/extension)[^"']*["']/, path.relative(process.cwd(), file));
    }
  });
});
