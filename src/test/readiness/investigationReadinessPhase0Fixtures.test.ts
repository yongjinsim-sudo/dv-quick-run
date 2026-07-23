import * as assert from "assert";
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";

type ReadinessPosture = "Ready" | "Conditional" | "Limited" | "NotAssessable";
type ContributorState = "Available" | "Partial" | "PermissionLimited" | "Missing" | "NotConsulted" | "Unsupported" | "Stale";
type ContributorRole = "Primary" | "Required" | "Recommended" | "Optional";
type GapCategory = "Coverage" | "Permission" | "Provenance" | "Freshness" | "Scope" | "Repeatability" | "Conflict" | "ContributorUnavailable";
type GapPriority = "High" | "Medium" | "Low";
type ConfidenceLevel = "High" | "Medium" | "Low" | "Unknown";
type ConfidenceEffect = "Preserve" | "Qualify" | "Dampen" | "Withhold";

interface Phase0Vocabulary {
  postures: ReadinessPosture[];
  contributorStates: ContributorState[];
  contributorRoles: ContributorRole[];
  qualityStates: string[];
  gapCategories: GapCategory[];
  gapPriorities: GapPriority[];
  confidenceEffects: ConfidenceEffect[];
  confidenceLevels: ConfidenceLevel[];
}

interface StateFixture {
  id: string;
  state: ContributorState;
  qualifyingEvidenceSupplied: boolean;
  semanticInvariant: string;
}

interface ProfileContributorFixture {
  id: string;
  role: ContributorRole;
  appliesWhen: string;
  absenceBehavior: string;
}

interface ProfileFixture {
  profileId: string;
  version: string;
  investigationKind: string;
  contributors: ProfileContributorFixture[];
}

interface GapRuleFixture {
  ruleId: string;
  category: GapCategory;
  priority: GapPriority;
  trigger: string;
  recommendationFamily: string;
  fixture: {
    role: ContributorRole;
    state: ContributorState;
    qualityState?: string;
    expectedPostureCeiling: ReadinessPosture;
  };
}

interface ConfidenceTransitionFixture {
  base: ConfidenceLevel;
  effect: ConfidenceEffect;
  effective: ConfidenceLevel;
  limitationStrength: "None" | "Explicit" | "Severe";
}

interface FreshnessPolicyFixture {
  evidenceFamily: string;
  thresholdOwner: "Provider" | "Profile" | "ProviderOrProfile";
  evaluation: string;
  withoutExplicitThreshold: "Unknown" | "NotApplicable";
}

interface Phase0Catalogue {
  fixtureContractVersion: string;
  releaseVersion: string;
  vocabulary: Phase0Vocabulary;
  stateFixtures: StateFixture[];
  profiles: ProfileFixture[];
  gapRules: GapRuleFixture[];
  confidenceTransitions: ConfidenceTransitionFixture[];
  freshnessPolicies: FreshnessPolicyFixture[];
}

interface GoldenContributor {
  id: string;
  role: ContributorRole;
  state: ContributorState;
}

interface GoldenGap {
  ruleId: string;
  category: GapCategory;
  priority: GapPriority;
  contributorIds: string[];
}

interface GoldenScenario {
  id: string;
  title: string;
  request: {
    contractVersion: string;
    investigationInput: {
      version: string;
      investigationId: string;
      kind: string;
      contributors: GoldenContributor[];
    };
    understandingBundle: {
      version: string;
      baseSynthesizedConfidence: ConfidenceLevel;
      dominanceResult: string;
    };
    profile: { profileId: string; version: string };
    assessmentUtc: string;
    generatedUtc: string;
    [key: string]: unknown;
  };
  expected: {
    contractVersion: string;
    posture: ReadinessPosture;
    confidenceEffect: ConfidenceEffect;
    baseSynthesizedConfidence: ConfidenceLevel;
    effectiveSynthesizedConfidence: ConfidenceLevel;
    inputFingerprint: string;
    gaps: GoldenGap[];
    recommendations: { ruleId: string; family: string }[];
    semanticAssertions: string[];
  };
}

interface GoldenFixtureSet {
  fixtureContractVersion: string;
  releaseVersion: string;
  canonicalization: {
    algorithm: string;
    excludedRequestFields: string[];
    fingerprintPrefix: string;
  };
  scenarios: GoldenScenario[];
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

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`).join(",")}}`;
}

function semanticRequest(request: GoldenScenario["request"], excludedFields: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(request).filter(([key]) => !excludedFields.includes(key))
  );
}

function fingerprint(request: GoldenScenario["request"], excludedFields: readonly string[]): string {
  const canonical = canonicalize(semanticRequest(request, excludedFields));
  return `sha256:${createHash("sha256").update(canonical, "utf8").digest("hex")}`;
}

const catalogue = readFixture<Phase0Catalogue>("readiness-phase0-catalogue.fixture.json");
const golden = readFixture<GoldenFixtureSet>("readiness-phase0-golden-scenarios.fixture.json");

suite("investigationReadinessPhase0Fixtures", () => {
  test("locks the v0.15.3 readiness vocabulary", () => {
    assert.strictEqual(catalogue.fixtureContractVersion, "investigation-readiness-phase0-fixtures-v1");
    assert.strictEqual(catalogue.releaseVersion, "0.15.3");
    assert.deepStrictEqual(catalogue.vocabulary.postures, ["Ready", "Conditional", "Limited", "NotAssessable"]);
    assert.deepStrictEqual(catalogue.vocabulary.contributorStates, ["Available", "Partial", "PermissionLimited", "Missing", "NotConsulted", "Unsupported", "Stale"]);
    assert.deepStrictEqual(catalogue.vocabulary.contributorRoles, ["Primary", "Required", "Recommended", "Optional"]);
    assert.deepStrictEqual(catalogue.vocabulary.qualityStates, ["Sufficient", "Limited", "Unknown", "NotApplicable"]);
    assert.deepStrictEqual(catalogue.vocabulary.gapCategories, ["Coverage", "Permission", "Provenance", "Freshness", "Scope", "Repeatability", "Conflict", "ContributorUnavailable"]);
    assert.deepStrictEqual(catalogue.vocabulary.gapPriorities, ["High", "Medium", "Low"]);
    assert.deepStrictEqual(catalogue.vocabulary.confidenceEffects, ["Preserve", "Qualify", "Dampen", "Withhold"]);
    assert.deepStrictEqual(catalogue.vocabulary.confidenceLevels, ["High", "Medium", "Low", "Unknown"]);
  });

  test("gives every contributor state an explicit semantic fixture", () => {
    assert.deepStrictEqual(catalogue.stateFixtures.map((item) => item.state), catalogue.vocabulary.contributorStates);
    assert.ok(catalogue.stateFixtures.every((item) => item.id === `state-${item.state.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()}`));
    assert.ok(catalogue.stateFixtures.every((item) => item.semanticInvariant.trim().length >= 40));
    assert.match(catalogue.stateFixtures.find((item) => item.state === "Partial")?.semanticInvariant ?? "", /not Missing/i);
    assert.match(catalogue.stateFixtures.find((item) => item.state === "NotConsulted")?.semanticInvariant ?? "", /not Missing/i);
    assert.match(catalogue.stateFixtures.find((item) => item.state === "PermissionLimited")?.semanticInvariant ?? "", /not proof/i);
  });

  test("locks the Timeline and Cross-Diff contributor matrices", () => {
    const timeline = catalogue.profiles.find((item) => item.profileId === "timeline-mini-rca-v1");
    const crossDiff = catalogue.profiles.find((item) => item.profileId === "cross-diff-mini-rca-v1");
    assert.ok(timeline);
    assert.ok(crossDiff);
    assert.deepStrictEqual(timeline.contributors.map((item) => [item.id, item.role]), [
      ["timeline.reconstruction", "Primary"],
      ["timeline.understanding", "Required"],
      ["timeline.trust", "Required"],
      ["audit.evidence", "Recommended"],
      ["identity.evidence", "Recommended"],
      ["relationship.evidence", "Recommended"],
      ["configuration.evidence", "Recommended"],
      ["crossDiff.evidence", "Recommended"],
      ["query.evidence", "Optional"],
      ["metadata.evidence", "Optional"]
    ]);
    assert.deepStrictEqual(crossDiff.contributors.map((item) => [item.id, item.role]), [
      ["crossDiff.comparison", "Primary"],
      ["crossDiff.sourceSnapshot", "Required"],
      ["crossDiff.targetSnapshot", "Required"],
      ["crossDiff.providerFindings", "Required"],
      ["relationship.evidence", "Recommended"],
      ["metadata.evidence", "Recommended"],
      ["configuration.evidence", "Recommended"],
      ["identity.evidence", "Recommended"],
      ["audit.evidence", "Recommended"],
      ["timeline.evidence", "Recommended"],
      ["query.evidence", "Optional"]
    ]);
    assert.ok(catalogue.profiles.every((profile) => profile.version === "1.0"));
    assert.ok(catalogue.profiles.flatMap((profile) => profile.contributors).every((item) => item.appliesWhen && item.absenceBehavior));
  });

  test("locks exactly 18 canonical gap rules with one fixture each", () => {
    const expectedRules: [string, GapCategory, GapPriority][] = [
      ["GAP-COVERAGE-001", "Coverage", "High"],
      ["GAP-COVERAGE-002", "Coverage", "High"],
      ["GAP-COVERAGE-003", "Coverage", "Medium"],
      ["GAP-COVERAGE-004", "Coverage", "Medium"],
      ["GAP-PERMISSION-001", "Permission", "High"],
      ["GAP-PERMISSION-002", "Permission", "Medium"],
      ["GAP-PROVENANCE-001", "Provenance", "High"],
      ["GAP-PROVENANCE-002", "Provenance", "Medium"],
      ["GAP-FRESHNESS-001", "Freshness", "High"],
      ["GAP-FRESHNESS-002", "Freshness", "Medium"],
      ["GAP-SCOPE-001", "Scope", "High"],
      ["GAP-SCOPE-002", "Scope", "Medium"],
      ["GAP-REPEATABILITY-001", "Repeatability", "Medium"],
      ["GAP-REPEATABILITY-002", "Repeatability", "Low"],
      ["GAP-CONFLICT-001", "Conflict", "High"],
      ["GAP-CONFLICT-002", "Conflict", "Medium"],
      ["GAP-CONTRIBUTOR-001", "ContributorUnavailable", "High"],
      ["GAP-CONTRIBUTOR-002", "ContributorUnavailable", "Low"]
    ];
    assert.strictEqual(catalogue.gapRules.length, 18);
    assert.deepStrictEqual(catalogue.gapRules.map((item) => [item.ruleId, item.category, item.priority]), expectedRules);
    assert.strictEqual(new Set(catalogue.gapRules.map((item) => item.ruleId)).size, 18);
    assert.deepStrictEqual(
      [...new Set(catalogue.gapRules.map((item) => item.category))].sort(),
      [...catalogue.vocabulary.gapCategories].sort()
    );
    assert.ok(catalogue.gapRules.every((item) => item.trigger && item.recommendationFamily && item.fixture));
    assert.ok(catalogue.gapRules.every((item) => catalogue.vocabulary.contributorStates.includes(item.fixture.state)));
  });

  test("locks all 16 confidence transitions and never raises confidence", () => {
    assert.strictEqual(catalogue.confidenceTransitions.length, 16);
    const keys = catalogue.confidenceTransitions.map((item) => `${item.base}:${item.effect}`);
    assert.strictEqual(new Set(keys).size, 16);
    for (const base of catalogue.vocabulary.confidenceLevels) {
      for (const effect of catalogue.vocabulary.confidenceEffects) {
        assert.ok(keys.includes(`${base}:${effect}`), `Missing confidence transition ${base}:${effect}`);
      }
    }

    const ranks: Record<ConfidenceLevel, number> = { High: 3, Medium: 2, Low: 1, Unknown: 0 };
    for (const transition of catalogue.confidenceTransitions) {
      assert.ok(ranks[transition.effective] <= ranks[transition.base] || transition.base === "Unknown");
      if (transition.effect === "Dampen" && transition.base !== "Unknown") {
        assert.ok(ranks[transition.base] - ranks[transition.effective] <= 1);
      }
      if (transition.base === "Unknown") {
        assert.strictEqual(transition.effective, "Unknown");
      }
      if (transition.effective === "Unknown" && transition.base !== "Unknown") {
        assert.strictEqual(transition.effect, "Withhold");
      }
    }
  });

  test("locks contextual freshness without a hidden global TTL", () => {
    assert.deepStrictEqual(catalogue.freshnessPolicies.map((item) => item.evidenceFamily), [
      "Timeline Reconstruction",
      "Timeline Understanding and Trust",
      "Cross-Diff source and target snapshots",
      "Provider findings",
      "Audit Evidence",
      "Runtime query result",
      "Metadata, configuration, identity and relationship evidence"
    ]);
    assert.ok(catalogue.freshnessPolicies.every((item) => ["Unknown", "NotApplicable"].includes(item.withoutExplicitThreshold)));
    assert.doesNotMatch(JSON.stringify(catalogue.freshnessPolicies), /\b(?:ttl|maxAge|defaultDays|defaultHours)\b/i);
    assert.match(catalogue.freshnessPolicies[0].evaluation, /Historical age alone never/i);
    assert.match(catalogue.freshnessPolicies.find((item) => item.evidenceFamily === "Audit Evidence")?.evaluation ?? "", /event age alone is not staleness/i);
  });

  test("provides golden inputs and expected results for every readiness posture", () => {
    assert.strictEqual(golden.fixtureContractVersion, "investigation-readiness-phase0-golden-v1");
    assert.strictEqual(golden.releaseVersion, "0.15.3");
    assert.deepStrictEqual(golden.scenarios.map((item) => item.expected.posture), catalogue.vocabulary.postures);
    assert.ok(golden.scenarios.every((item) => item.request.contractVersion === "investigation-readiness-request-v1"));
    assert.ok(golden.scenarios.every((item) => item.request.investigationInput.version === "investigation-input-v1"));
    assert.ok(golden.scenarios.every((item) => item.request.understandingBundle.version === "understanding-bundle-v2"));
    assert.ok(golden.scenarios.every((item) => item.expected.contractVersion === "investigation-readiness-v1"));
  });

  test("covers every contributor state across the golden scenarios", () => {
    const states = new Set(
      golden.scenarios.flatMap((scenario) => scenario.request.investigationInput.contributors.map((item) => item.state))
    );
    assert.deepStrictEqual([...states].sort(), [...catalogue.vocabulary.contributorStates].sort());
  });

  test("keeps golden gaps and recommendations aligned with the locked catalogue", () => {
    const rules = new Map(catalogue.gapRules.map((rule) => [rule.ruleId, rule]));
    const transitions = new Map(catalogue.confidenceTransitions.map((item) => [`${item.base}:${item.effect}`, item.effective]));
    for (const scenario of golden.scenarios) {
      for (const gap of scenario.expected.gaps) {
        const rule = rules.get(gap.ruleId);
        assert.ok(rule, `Golden scenario ${scenario.id} uses unknown rule ${gap.ruleId}`);
        assert.strictEqual(gap.category, rule.category);
        assert.strictEqual(gap.priority, rule.priority);
      }
      for (const recommendation of scenario.expected.recommendations) {
        assert.strictEqual(recommendation.family, rules.get(recommendation.ruleId)?.recommendationFamily);
      }
      assert.strictEqual(
        transitions.get(`${scenario.expected.baseSynthesizedConfidence}:${scenario.expected.confidenceEffect}`),
        scenario.expected.effectiveSynthesizedConfidence
      );
    }
  });

  test("locks deterministic fingerprints while excluding generatedUtc", () => {
    assert.strictEqual(golden.canonicalization.algorithm, "sha256-recursive-sorted-key-json-v1");
    assert.deepStrictEqual(golden.canonicalization.excludedRequestFields, ["generatedUtc"]);
    for (const scenario of golden.scenarios) {
      assert.strictEqual(
        fingerprint(scenario.request, golden.canonicalization.excludedRequestFields),
        scenario.expected.inputFingerprint,
        `Fingerprint drift for ${scenario.id}`
      );
      const regenerated = JSON.parse(JSON.stringify(scenario.request)) as GoldenScenario["request"];
      regenerated.generatedUtc = "2030-01-01T00:00:00.000Z";
      assert.strictEqual(
        fingerprint(regenerated, golden.canonicalization.excludedRequestFields),
        scenario.expected.inputFingerprint
      );
    }
  });

  test("contains no unresolved or customer-specific fixture language", () => {
    const fixtureText = `${JSON.stringify(catalogue)}\n${JSON.stringify(golden)}`;
    assert.doesNotMatch(fixtureText, /\b(?:TODO|TBD|FIXME|lorem ipsum|customer-specific)\b/i);
    assert.doesNotMatch(fixtureText, /\b(?:Bupa|Infosys)\b/i);
    assert.match(fixtureText, /Sample Work Item/);
  });
});
