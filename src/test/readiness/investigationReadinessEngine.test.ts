import * as assert from "assert";
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import {
  INVESTIGATION_READINESS_SCHEMA_V1,
  applyReadinessConfidenceEffect,
  assessInvestigationReadiness,
  canonicalizeReadinessJson,
  normalizeReadinessContributors,
  resolveReadinessProfile,
  validateReadinessResultInvariants,
  type ConfidenceLevel,
  type ContributorReadinessState,
  type InvestigationReadinessRequestV1,
  type InvestigationReadinessResponseV1,
  type InvestigationReadinessResultV1,
  type ReadonlyJsonObject
} from "../../core/readiness/index.js";
import { createJsonSchemaTestValidator } from "./jsonSchemaTestValidator.js";

interface GoldenScenario {
  id: string;
  request: InvestigationReadinessRequestV1;
  expected: {
    contractVersion: string;
    posture: string;
    confidenceEffect: string;
    baseSynthesizedConfidence: string;
    effectiveSynthesizedConfidence: string;
    inputFingerprint: string;
    gaps: { ruleId: string; category: string; priority: string; contributorIds: string[] }[];
    recommendations: { ruleId: string; family: string }[];
  };
}

interface GoldenFixtureSet {
  scenarios: GoldenScenario[];
}

interface ConfidenceTransitionFixture {
  base: ConfidenceLevel;
  effect: "Preserve" | "Qualify" | "Dampen" | "Withhold";
  effective: ConfidenceLevel;
}

interface Phase0Catalogue {
  confidenceTransitions: ConfidenceTransitionFixture[];
}

interface Phase2EngineSnapshots {
  fixtureContractVersion: string;
  releaseVersion: string;
  canonicalResults: Record<string, { sha256: string; bytes: number }>;
}

interface MutableInputView {
  contributors: Record<string, unknown>[];
  evidence: Record<string, unknown>[];
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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function requireResult(response: InvestigationReadinessResponseV1): InvestigationReadinessResultV1 {
  if (response.contractVersion !== "investigation-readiness-v1") {
    assert.fail(`${response.code}: ${response.message} ${response.limitations.join("; ")}`);
  }
  return response;
}

function scenario(id: string): GoldenScenario {
  const value = golden.scenarios.find((item) => item.id === id);
  assert.ok(value, `Golden scenario not found: ${id}`);
  return value;
}

function mutableInput(request: InvestigationReadinessRequestV1): MutableInputView {
  return request.investigationInput as unknown as MutableInputView;
}

function contributor(request: InvestigationReadinessRequestV1, id: string): Record<string, unknown> {
  const value = mutableInput(request).contributors.find((item) => item.id === id);
  assert.ok(value, `Contributor not found: ${id}`);
  return value;
}

const golden = readFixture<GoldenFixtureSet>("readiness-phase0-golden-scenarios.fixture.json");
const catalogue = readFixture<Phase0Catalogue>("readiness-phase0-catalogue.fixture.json");
const engineSnapshots = readFixture<Phase2EngineSnapshots>("readiness-phase2-engine-snapshots.fixture.json");

suite("investigationReadinessEngine", () => {
  test("produces every locked Phase 0 golden outcome and a schema-valid result", () => {
    const validateResult = createJsonSchemaTestValidator(INVESTIGATION_READINESS_SCHEMA_V1, "result");
    for (const fixture of golden.scenarios) {
      const result = requireResult(assessInvestigationReadiness(fixture.request));
      assert.strictEqual(result.contractVersion, fixture.expected.contractVersion, fixture.id);
      assert.strictEqual(result.posture, fixture.expected.posture, fixture.id);
      assert.strictEqual(result.confidenceEffect, fixture.expected.confidenceEffect, fixture.id);
      assert.strictEqual(result.baseSynthesizedConfidence, fixture.expected.baseSynthesizedConfidence, fixture.id);
      assert.strictEqual(result.effectiveSynthesizedConfidence, fixture.expected.effectiveSynthesizedConfidence, fixture.id);
      assert.strictEqual(result.inputFingerprint, fixture.expected.inputFingerprint, fixture.id);
      assert.deepStrictEqual(
        result.gaps.map((gap) => ({ ruleId: gap.ruleId, category: gap.category, priority: gap.priority, contributorIds: gap.contributorIds })),
        fixture.expected.gaps,
        fixture.id
      );
      assert.deepStrictEqual(
        result.recommendations.map((recommendation) => ({ ruleId: recommendation.ruleId, family: recommendation.action })),
        fixture.expected.recommendations,
        fixture.id
      );
      assert.deepStrictEqual(validateResult(result), [], fixture.id);
      assert.deepStrictEqual(validateReadinessResultInvariants(result), [], fixture.id);
    }
  });

  test("locks byte-equivalent canonical results for all four golden scenarios", () => {
    assert.strictEqual(engineSnapshots.fixtureContractVersion, "investigation-readiness-phase2-engine-snapshots-v1");
    assert.strictEqual(engineSnapshots.releaseVersion, "0.15.3");
    for (const fixture of golden.scenarios) {
      const result = requireResult(assessInvestigationReadiness(fixture.request));
      const canonical = canonicalizeReadinessJson(result);
      const expected = engineSnapshots.canonicalResults[fixture.id];
      assert.ok(expected, fixture.id);
      assert.strictEqual(Buffer.byteLength(canonical, "utf8"), expected.bytes, fixture.id);
      assert.strictEqual(createHash("sha256").update(canonical, "utf8").digest("hex"), expected.sha256, fixture.id);
    }
  });

  test("normalizes all seven states without collapsing trust distinctions", () => {
    const states = new Set<ContributorReadinessState>();
    for (const fixture of golden.scenarios) {
      const result = requireResult(assessInvestigationReadiness(fixture.request));
      result.contributorStates.forEach((item) => states.add(item.state));
    }
    assert.deepStrictEqual([...states].sort(), ["Available", "Missing", "NotConsulted", "Partial", "PermissionLimited", "Stale", "Unsupported"].sort());

    const conditional = requireResult(assessInvestigationReadiness(scenario("timeline-conditional").request));
    const permissionLimited = conditional.contributorStates.find((item) => item.contributorId === "audit.evidence");
    const notConsulted = conditional.contributorStates.find((item) => item.contributorId === "identity.evidence");
    assert.strictEqual(permissionLimited?.state, "PermissionLimited");
    assert.match(permissionLimited?.explanation ?? "", /access constraints/i);
    assert.strictEqual(notConsulted?.state, "NotConsulted");
    assert.doesNotMatch(notConsulted?.explanation ?? "", /missing/i);
  });

  test("uses structured profile applicability and ignores caller role escalation", () => {
    const request = clone(scenario("cross-diff-ready").request);
    contributor(request, "query.evidence").role = "Primary";
    const profile = resolveReadinessProfile(request.profile, request.investigationInput.kind);
    assert.strictEqual(profile.ok, true);
    if (!profile.ok) {return;}
    const normalized = normalizeReadinessContributors(request, profile.profile);
    const query = normalized.find((item) => item.contributorId === "query.evidence");
    assert.strictEqual(query?.role, "Optional");
    assert.strictEqual(query?.applicable, false);
    assert.strictEqual(requireResult(assessInvestigationReadiness(request)).posture, "Ready");
  });

  test("preserves unknown contributors without silently mapping a profile role", () => {
    const request = clone(scenario("cross-diff-ready").request);
    mutableInput(request).contributors.push({
      id: "future.provider",
      role: "Required",
      state: "Available",
      evidenceRefs: ["evidence:comparison:ready"]
    });
    const result = requireResult(assessInvestigationReadiness(request));
    const unknown = result.contributorStates.find((item) => item.contributorId === "future.provider");
    assert.strictEqual(unknown?.role, "Optional");
    assert.strictEqual(unknown?.applicable, false);
    assert.strictEqual(unknown?.state, "Unsupported");
    assert.match(unknown?.explanation ?? "", /unmapped/i);
    assert.ok(!result.gaps.some((gap) => gap.contributorIds.includes("future.provider")));
  });

  test("requires explicit freshness semantics and never invents a global TTL", () => {
    const request = clone(scenario("cross-diff-ready").request);
    const target = contributor(request, "crossDiff.targetSnapshot");
    target.state = "Stale";
    delete target.freshnessRuleId;
    const withoutRule = requireResult(assessInvestigationReadiness(request));
    assert.strictEqual(withoutRule.contributorStates.find((item) => item.contributorId === "crossDiff.targetSnapshot")?.state, "Available");
    assert.ok(!withoutRule.gaps.some((gap) => gap.category === "Freshness"));
    assert.strictEqual(withoutRule.qualityDimensions.find((item) => item.dimension === "Freshness")?.state, "Unknown");

    target.state = "Available";
    target.validUntilUtc = "2026-07-21T23:59:59.000Z";
    const expired = requireResult(assessInvestigationReadiness(request));
    assert.strictEqual(expired.contributorStates.find((item) => item.contributorId === "crossDiff.targetSnapshot")?.state, "Stale");
    assert.ok(expired.gaps.some((gap) => gap.ruleId === "GAP-FRESHNESS-001"));
  });

  test("treats input-identity mismatch as stale while historical event age remains valid", () => {
    const crossDiff = clone(scenario("cross-diff-ready").request);
    contributor(crossDiff, "crossDiff.providerFindings").sourceInputIdentity = "another-comparison";
    const mismatched = requireResult(assessInvestigationReadiness(crossDiff));
    assert.strictEqual(mismatched.contributorStates.find((item) => item.contributorId === "crossDiff.providerFindings")?.state, "Stale");
    assert.ok(mismatched.gaps.some((gap) => gap.ruleId === "GAP-FRESHNESS-001"));

    const timeline = clone(scenario("timeline-conditional").request);
    mutableInput(timeline).evidence[0].capturedUtc = "2000-01-01T00:00:00.000Z";
    const historical = requireResult(assessInvestigationReadiness(timeline));
    assert.strictEqual(historical.contributorStates.find((item) => item.contributorId === "timeline.reconstruction")?.state, "Available");
    assert.ok(!historical.gaps.some((gap) => gap.category === "Freshness"));
  });

  test("evaluates scope and attached-query repeatability through registered rules", () => {
    const scopeRequest = clone(scenario("cross-diff-ready").request);
    contributor(scopeRequest, "crossDiff.sourceSnapshot").scopeState = "Limited";
    const scoped = requireResult(assessInvestigationReadiness(scopeRequest));
    assert.ok(scoped.gaps.some((gap) => gap.ruleId === "GAP-SCOPE-001"));

    const repeatabilityRequest = clone(scenario("cross-diff-ready").request);
    (repeatabilityRequest.investigationInput.intent as Record<string, unknown>).runtimeConfirmationAttached = true;
    const query = contributor(repeatabilityRequest, "query.evidence");
    query.state = "Partial";
    query.evidenceRefs = ["evidence:comparison:ready"];
    query.repeatabilityState = "Limited";
    const repeatability = requireResult(assessInvestigationReadiness(repeatabilityRequest));
    assert.strictEqual(repeatability.posture, "Conditional");
    assert.ok(repeatability.gaps.some((gap) => gap.ruleId === "GAP-REPEATABILITY-001"));
  });

  test("applies specific gap precedence before generic coverage", () => {
    const conditional = requireResult(assessInvestigationReadiness(scenario("timeline-conditional").request));
    const auditGaps = conditional.gaps.filter((gap) => gap.contributorIds.includes("audit.evidence"));
    assert.deepStrictEqual(auditGaps.map((gap) => gap.ruleId), ["GAP-PERMISSION-002"]);

    const limited = requireResult(assessInvestigationReadiness(scenario("cross-diff-limited").request));
    const targetGaps = limited.gaps.filter((gap) => gap.contributorIds.includes("crossDiff.targetSnapshot"));
    assert.deepStrictEqual(targetGaps.map((gap) => gap.ruleId), ["GAP-FRESHNESS-001"]);
  });

  test("preserves conflicting sources and emits the canonical conflict rule", () => {
    const request = clone(scenario("cross-diff-ready").request);
    contributor(request, "crossDiff.providerFindings").consistencyState = "Limited";
    const result = requireResult(assessInvestigationReadiness(request));
    assert.strictEqual(result.posture, "Limited");
    assert.ok(result.gaps.some((gap) => gap.ruleId === "GAP-CONFLICT-001"));
    assert.strictEqual(result.evidenceRefs.some((reference) => reference.id === "evidence:comparison:ready"), true);
  });

  test("implements the complete confidence transition matrix without raising confidence", () => {
    assert.strictEqual(catalogue.confidenceTransitions.length, 16);
    for (const transition of catalogue.confidenceTransitions) {
      assert.strictEqual(
        applyReadinessConfidenceEffect(transition.base, transition.effect),
        transition.effective,
        `${transition.base} ${transition.effect}`
      );
    }
    const limited = requireResult(assessInvestigationReadiness(scenario("cross-diff-limited").request));
    assert.strictEqual(limited.gaps.filter((gap) => gap.priority === "High").length, 2);
    assert.strictEqual(limited.baseSynthesizedConfidence, "High");
    assert.strictEqual(limited.effectiveSynthesizedConfidence, "Medium");
  });

  test("builds linked evidence-only recommendations in canonical gap order", () => {
    for (const fixture of golden.scenarios) {
      const result = requireResult(assessInvestigationReadiness(fixture.request));
      assert.deepStrictEqual(result.recommendations.map((item) => item.ruleId), result.gaps.map((gap) => gap.ruleId));
      for (const recommendation of result.recommendations) {
        assert.doesNotMatch(recommendation.action, /\b(?:repair|deploy|approve|execute|apply|blame|certify)\b/i);
        assert.ok(recommendation.gapIds.every((gapId) => result.gaps.some((gap) => gap.id === gapId && gap.recommendationIds.includes(recommendation.id))));
      }
    }
  });

  test("is byte-deterministic for shuffled contributor input", () => {
    const originalRequest = clone(scenario("timeline-conditional").request);
    const shuffledRequest = clone(originalRequest);
    mutableInput(shuffledRequest).contributors.reverse();
    mutableInput(shuffledRequest).evidence.reverse();
    for (const item of mutableInput(shuffledRequest).contributors) {
      if (Array.isArray(item.evidenceRefs)) {item.evidenceRefs.reverse();}
    }
    const original = requireResult(assessInvestigationReadiness(originalRequest));
    const shuffled = requireResult(assessInvestigationReadiness(shuffledRequest));
    assert.strictEqual(canonicalizeReadinessJson(shuffled), canonicalizeReadinessJson(original));
  });

  test("does not mutate canonical input and excludes generatedUtc from semantic identity", () => {
    const request = clone(scenario("cross-diff-limited").request);
    const before = canonicalizeReadinessJson(request);
    const first = requireResult(assessInvestigationReadiness(request));
    assert.strictEqual(canonicalizeReadinessJson(request), before);
    const regenerated = { ...clone(request), generatedUtc: "2026-07-23T00:00:00.000Z" };
    const second = requireResult(assessInvestigationReadiness(regenerated));
    assert.strictEqual(second.inputFingerprint, first.inputFingerprint);
    assert.deepStrictEqual(second.gaps.map((gap) => gap.id), first.gaps.map((gap) => gap.id));
  });

  test("fails closed with structured version and input errors", () => {
    const inputVersion = clone(scenario("cross-diff-ready").request) as unknown as { investigationInput: { version: string } };
    inputVersion.investigationInput.version = "investigation-input-v2";
    const unsupportedInput = assessInvestigationReadiness(inputVersion as unknown as InvestigationReadinessRequestV1);
    assert.strictEqual(unsupportedInput.contractVersion, "investigation-readiness-error-v1");
    if (unsupportedInput.contractVersion === "investigation-readiness-error-v1") {
      assert.strictEqual(unsupportedInput.code, "UnsupportedInputVersion");
    }

    const profileVersion = clone(scenario("cross-diff-ready").request) as unknown as { profile: { version: string } };
    profileVersion.profile.version = "2.0";
    const unsupportedProfile = assessInvestigationReadiness(profileVersion as unknown as InvestigationReadinessRequestV1);
    assert.strictEqual(unsupportedProfile.contractVersion, "investigation-readiness-error-v1");
    if (unsupportedProfile.contractVersion === "investigation-readiness-error-v1") {
      assert.strictEqual(unsupportedProfile.code, "UnsupportedProfileVersion");
    }
  });

  test("the invariant validator rejects confidence increases and remediation actions", () => {
    const ready = requireResult(assessInvestigationReadiness(scenario("cross-diff-ready").request));
    const raised = { ...ready, baseSynthesizedConfidence: "Medium" as const, effectiveSynthesizedConfidence: "High" as const };
    assert.ok(validateReadinessResultInvariants(raised).some((error) => /confidence/i.test(error)));

    const limited = requireResult(assessInvestigationReadiness(scenario("cross-diff-limited").request));
    const invalidRecommendation = {
      ...limited,
      recommendations: limited.recommendations.map((item, index) => index === 0 ? { ...item, action: "Deploy a repair" } : item)
    };
    assert.ok(validateReadinessResultInvariants(invalidRecommendation).some((error) => /prohibited/i.test(error)));
  });

  test("keeps the Phase 2 service free of host and side-effect imports", () => {
    const candidates = [
      path.join(process.cwd(), "src", "core", "readiness", "investigationReadinessService.ts"),
      path.join(__dirname, "..", "..", "..", "src", "core", "readiness", "investigationReadinessService.ts")
    ];
    const servicePath = candidates.find((candidate) => fs.existsSync(candidate));
    assert.ok(servicePath);
    const source = fs.readFileSync(servicePath, "utf8");
    assert.doesNotMatch(source, /from\s+["'](?:vscode|fs|https?|net|child_process)["']/);
  });
});
