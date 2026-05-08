import * as assert from "assert";
import { buildOperationalProfile } from "../../product/operationalProfile/operationalProfileEngine.js";

suite("operationalProfileEngine", () => {
  test("builds an entity-scoped high-complexity profile from bounded evidence", () => {
    const profile = buildOperationalProfile({
      entityLogicalName: "contact",
      entityDisplayName: "Contact",
      synchronousPluginStepCount: 8,
      relationshipCount: 47,
      attributeCount: 347,
      asyncOperationCount7d: 1842,
      distinctAsyncOperationCount7d: 312,
      flowReferenceCount: 6,
      activeWorkflowCount: 4,
      isPartiallyManaged: true,
      managedDetail: "Marketing plugins locked"
    });

    assert.strictEqual(profile.kind, "entityOperationalProfile");
    assert.strictEqual(profile.entityLogicalName, "contact");
    assert.strictEqual(profile.entityDisplayName, "Contact");
    assert.strictEqual(profile.headlineBand, "high");
    assert.strictEqual(profile.invariants.entityScoped, true);
    assert.strictEqual(profile.invariants.explicitlyUserTriggered, true);
    assert.strictEqual(profile.invariants.advisoryOnly, true);
    assert.strictEqual(profile.invariants.evidenceBacked, true);

    assert.ok(profile.summary.includes("high operational density"));
    assert.ok(!profile.summary.toLowerCase().includes("root cause"));
    assert.ok(profile.evidence.some((item) => item.label === "Plugin Registrations" && item.value === "8 synchronous steps"));
    assert.ok(profile.evidence.some((item) => item.label === "Power Automate / Flow" && item.value === "6 flows reference this entity"));
    assert.ok(profile.investigationGuidance.some((item) => item.includes("advisory context")));
  });

  test("keeps bands explainable without opaque numeric complexity scores", () => {
    const profile = buildOperationalProfile({
      entityLogicalName: "account",
      relationshipCount: 2,
      attributeCount: 25
    });

    assert.strictEqual(profile.headlineBand, "low");
    assert.ok(!Object.prototype.hasOwnProperty.call(profile, "score"));
    assert.ok(profile.dimensions.every((dimension) => typeof dimension.band === "string"));
    assert.ok(profile.dimensions.every((dimension) => typeof dimension.explanation === "string" && dimension.explanation.length > 0));
    assert.ok(profile.dimensions.every((dimension) => typeof dimension.whyItMatters === "string" && dimension.whyItMatters.length > 0));
    assert.ok(profile.dimensions.every((dimension) => typeof dimension.evidenceStateLabel === "string" && dimension.evidenceStateLabel.length > 0));
  });

  test("does not invent evidence when inputs are absent", () => {
    const profile = buildOperationalProfile({ entityLogicalName: "task" });

    assert.strictEqual(profile.headlineBand, "none");
    assert.strictEqual(profile.evidence.length, 0);
    assert.ok(profile.summary.includes("No strong operational density signals"));
  });

  test("calibrates relationship fanout bands for Dataverse entities", () => {
    const build = (relationshipCount: number) => buildOperationalProfile({ entityLogicalName: "sample", relationshipCount });

    assert.strictEqual(build(49).dimensions.find((dimension) => dimension.id === "relationships")?.band, "low");
    assert.strictEqual(build(50).dimensions.find((dimension) => dimension.id === "relationships")?.band, "moderate");
    assert.strictEqual(build(70).dimensions.find((dimension) => dimension.id === "relationships")?.band, "moderate");
    assert.strictEqual(build(71).dimensions.find((dimension) => dimension.id === "relationships")?.band, "high");
    assert.strictEqual(build(120).dimensions.find((dimension) => dimension.id === "relationships")?.band, "high");
    assert.strictEqual(build(121).dimensions.find((dimension) => dimension.id === "relationships")?.band, "veryHigh");
  });


  test("reports managed state as state context rather than density severity", () => {
    const profile = buildOperationalProfile({
      entityLogicalName: "contact",
      isManaged: true
    });

    const managed = profile.dimensions.find((dimension) => dimension.id === "managed");

    assert.strictEqual(profile.headlineBand, "none");
    assert.strictEqual(managed?.stateKind, "managed");
    assert.strictEqual(managed?.evidenceStateLabel, "Managed");
    assert.strictEqual(managed?.valueLabel, "Managed");
  });

});
