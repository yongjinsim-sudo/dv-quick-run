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

    assert.ok(profile.summary.toLowerCase().includes("operational density"));
    assert.ok(!profile.summary.toLowerCase().includes("root cause:"));
    assert.ok(profile.dvqrScore);
    assert.strictEqual(profile.dvqrScore?.normalizationVersion, "dvqr-density-v1");
    assert.strictEqual(profile.dvqrScore?.explanationVersion, "v1");
    assert.strictEqual(profile.dvqrScore?.evidencePrinciple, "Observed evidence → bounded interpretation → guided investigation");
    assert.ok(profile.dvqrScore?.methodology.toLowerCase().includes("observable metadata"));
    assert.ok(profile.dvqrScore?.contributingFactors.every((factor) => factor.explanation.length > 0));
    assert.ok(profile.evidence.some((item) => item.label === "Plugin Registrations" && item.value === "8 synchronous steps"));
    assert.ok(profile.evidence.some((item) => item.label === "Power Automate / Flow" && item.value === "6 flows reference this entity"));
    assert.ok(profile.guidance.some((item) => item.title === "Advisory context only"));
    assert.ok(profile.investigationGuidance.some((item) => item.includes("entity-scoped investigation context")));
  });

  test("keeps bands explainable without opaque numeric complexity scores", () => {
    const profile = buildOperationalProfile({
      entityLogicalName: "account",
      relationshipCount: 2,
      attributeCount: 25
    });

    assert.strictEqual(profile.headlineBand, "low");
    assert.ok(!Object.prototype.hasOwnProperty.call(profile, "score"));
    assert.ok(profile.dvqrScore);
    assert.strictEqual(profile.dvqrScore?.summary.includes("operational density"), true);
    assert.strictEqual(profile.dvqrScore?.normalizationVersion, "dvqr-density-v1");
    assert.strictEqual(profile.dvqrScore?.explanationVersion, "v1");
    assert.ok(profile.dimensions.every((dimension) => typeof dimension.band === "string"));
    assert.ok(profile.dimensions.every((dimension) => typeof dimension.explanation === "string" && dimension.explanation.length > 0));
    assert.ok(profile.dimensions.every((dimension) => typeof dimension.whyItMatters === "string" && dimension.whyItMatters.length > 0));
    assert.ok(profile.dimensions.every((dimension) => typeof dimension.evidenceStateLabel === "string" && dimension.evidenceStateLabel.length > 0));
  });

  test("builds typed guidance without root-cause or blame wording", () => {
    const profile = buildOperationalProfile({
      entityLogicalName: "contact",
      synchronousPluginStepCount: 12,
      asyncOperationCount7d: 1500,
      relationshipCount: 80,
      attributeCount: 350
    });

    assert.ok(profile.guidance.length >= 4);
    assert.ok(profile.guidance.some((item) => item.category === "pluginRegistrationDensity" && item.priority === "moderate"));
    assert.ok(profile.guidance.some((item) => item.category === "asyncOperationActivity" && item.priority === "high"));
    assert.ok(profile.guidance.every((item) => item.evidenceDimensionIds.every((id) => typeof id === "string")));

    const guidanceText = profile.guidance.map((item) => `${item.title} ${item.message}`).join(" ").toLowerCase();
    assert.ok(!guidanceText.includes("root cause"));
    assert.ok(!guidanceText.includes("caused by"));
    assert.ok(!guidanceText.includes("broken"));
    assert.ok(!guidanceText.includes("definitely"));
  });

  test("deepens profiles with business rules, real-time workflows, and audit context", () => {
    const profile = buildOperationalProfile({
      entityLogicalName: "account",
      businessRuleCount: 4,
      realTimeWorkflowCount: 2,
      auditingEnabled: true
    });

    assert.ok(profile.evidence.some((item) => item.kind === "businessRule" && item.value === "4 business rules"));
    assert.ok(profile.evidence.some((item) => item.label === "Real-time Workflows" && item.value === "2 real-time workflows"));
    assert.ok(profile.evidence.some((item) => item.kind === "audit" && item.value === "Enabled"));

    assert.strictEqual(profile.dimensions.find((dimension) => dimension.id === "businessRules")?.band, "moderate");
    assert.strictEqual(profile.dimensions.find((dimension) => dimension.id === "realTimeWorkflows")?.band, "moderate");
    assert.strictEqual(profile.dimensions.find((dimension) => dimension.id === "auditing")?.stateKind, "context");

    assert.ok(profile.guidance.some((item) => item.category === "businessRuleParticipation"));
    assert.ok(profile.guidance.some((item) => item.category === "realtimeWorkflowParticipation"));
    assert.ok(profile.guidance.some((item) => item.category === "auditParticipation"));

    const guidanceText = profile.guidance.map((item) => `${item.title} ${item.message}`).join(" ").toLowerCase();
    assert.ok(!guidanceText.includes("root cause"));
    assert.ok(!guidanceText.includes("caused by"));
    assert.ok(!guidanceText.includes("broken"));
    assert.ok(!guidanceText.includes("failure"));
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



  test("calibrates synchronous plugin participation bands for enterprise Dataverse entities", () => {
    const build = (synchronousPluginStepCount: number) =>
      buildOperationalProfile({ entityLogicalName: "sample", synchronousPluginStepCount });

    assert.strictEqual(build(10).dimensions.find((dimension) => dimension.id === "automation")?.band, "low");
    assert.strictEqual(build(11).dimensions.find((dimension) => dimension.id === "automation")?.band, "moderate");
    assert.strictEqual(build(20).dimensions.find((dimension) => dimension.id === "automation")?.band, "moderate");
    assert.strictEqual(build(21).dimensions.find((dimension) => dimension.id === "automation")?.band, "high");
    assert.strictEqual(build(40).dimensions.find((dimension) => dimension.id === "automation")?.band, "high");
    assert.strictEqual(build(41).dimensions.find((dimension) => dimension.id === "automation")?.band, "veryHigh");
  });


  test("balances overall density across multiple operational dimensions", () => {
    const pluginOnly = buildOperationalProfile({
      entityLogicalName: "pluginonly",
      synchronousPluginStepCount: 53
    });

    assert.strictEqual(pluginOnly.dimensions.find((dimension) => dimension.id === "automation")?.band, "veryHigh");
    assert.strictEqual(pluginOnly.headlineBand, "moderate");

    const broadEnterpriseEntity = buildOperationalProfile({
      entityLogicalName: "contact",
      synchronousPluginStepCount: 53,
      relationshipCount: 586,
      attributeCount: 573,
      businessRuleCount: 8
    });

    assert.strictEqual(broadEnterpriseEntity.headlineBand, "high");

    const pluginHeavyWithLimitedSupportingSignals = buildOperationalProfile({
      entityLogicalName: "msemr_medicalidentifier",
      synchronousPluginStepCount: 40,
      asyncOperationCount7d: 11,
      businessRuleCount: 4,
      auditingEnabled: true
    });

    assert.strictEqual(pluginHeavyWithLimitedSupportingSignals.dimensions.find((dimension) => dimension.id === "automation")?.band, "high");
    assert.strictEqual(pluginHeavyWithLimitedSupportingSignals.headlineBand, "moderate");
  });


  test("builds bounded contextual investigation actions from evidence dimensions", () => {
    const profile = buildOperationalProfile({
      entityLogicalName: "contact",
      synchronousPluginStepCount: 53,
      relationshipCount: 586,
      asyncOperationCount7d: 15,
      businessRuleCount: 4,
      realTimeWorkflowCount: 2
    });

    assert.ok(profile.navigationActions.some((item) => item.actionId === "viewPluginSteps" && item.priority === "primary"));
    assert.ok(profile.navigationActions.some((item) => item.actionId === "viewRelationships"));
    assert.ok(profile.navigationActions.some((item) => item.actionId === "viewAsyncOperations"));
    assert.ok(profile.navigationActions.some((item) => item.actionId === "viewBusinessRules"));
    assert.ok(profile.navigationActions.every((item) => item.evidenceDimensionIds.length > 0));

    const actionText = profile.navigationActions.map((item) => `${item.label} ${item.description}`).join(" ").toLowerCase();
    assert.ok(!actionText.includes("root cause"));
    assert.ok(!actionText.includes("caused by"));
    assert.ok(!actionText.includes("broken"));
    assert.ok(!actionText.includes("detected the exact issue"));
  });

  test("does not generate contextual investigation actions without supporting evidence", () => {
    const profile = buildOperationalProfile({ entityLogicalName: "quietentity" });

    assert.deepStrictEqual(profile.navigationActions, []);
  });



  test("surfaces subtle free and pro roadmap investigation capabilities", () => {
    const profile = buildOperationalProfile({ entityLogicalName: "contact" });

    assert.strictEqual(profile.futureSurfaces.length, 5);
    assert.ok(profile.futureSurfaces.some((item) => item.id === "timelineInvestigation" && item.availability === "proRoadmap"));
    assert.ok(profile.futureSurfaces.some((item) => item.id === "auditInvestigation" && item.availability === "proRoadmap"));
    assert.ok(profile.futureSurfaces.some((item) => item.id === "runtimeCorrelationInvestigation" && item.availability === "proRoadmap"));
    assert.ok(profile.futureSurfaces.some((item) => item.id === "deploymentReadinessInvestigation" && item.availability === "proRoadmap"));
    assert.ok(profile.futureSurfaces.some((item) => item.id === "operationalBaselineInvestigation" && item.availability === "proRoadmap"));

    const futureText = profile.futureSurfaces.map((item) => `${item.label} ${item.description}`).join(" ").toLowerCase();
    assert.ok(futureText.includes("audit"));
    assert.ok(futureText.includes("drift"));
    assert.ok(!futureText.includes("root cause"));
    assert.ok(!futureText.includes("buy now"));
    assert.ok(!futureText.includes("upgrade now"));
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
