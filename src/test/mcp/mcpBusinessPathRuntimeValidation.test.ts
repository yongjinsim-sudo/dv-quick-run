import * as assert from "node:assert";
import {
  failedBusinessPathResult,
  notTestedBusinessPathResult,
  rankValidatedBusinessPaths,
  validateBusinessPathResult
} from "../../mcp/mcpBusinessPathRuntimeValidation.js";

const candidate = (id: string, score: number, tables: string[]) => ({
  pathId: id,
  tables,
  bridgeTables: tables.slice(1, -1),
  hops: tables.slice(0, -1).map((fromTable, index) => ({
    fromTable,
    toTable: tables[index + 1],
    navigationProperty: `${fromTable}_${tables[index + 1]}`,
    relationshipType: "OneToMany" as const,
    direction: "oneToMany" as const,
    collectionValued: true,
    polymorphicTargetQualified: true
  })),
  metadataTraversalScore: 90,
  businessPathScore: score,
  assessment: "StrongCandidate" as const,
  evidenceState: { metadataValid: true as const, runtimeViable: "Unknown" as const, businessPreferred: "CandidateOnly" as const },
  signals: [],
  limitations: []
});

const probe = (pathId: string, reachedTarget: boolean, continuation: number[], runtimeEvidenceScore: number) => ({
  observation: {
    pathId,
    tables: [],
    targetTable: "target",
    family: "test",
    metadataScore: 90,
    status: reachedTarget ? "TargetObserved" as const : "NoContinuationObserved" as const,
    reachedTarget,
    completedHops: continuation.length,
    totalHops: continuation.length,
    intermediateRowsObserved: continuation.slice(0, -1).reduce((a, b) => a + b, 0),
    finalTargetRecordCount: reachedTarget ? continuation[continuation.length - 1] ?? 0 : 0,
    runtimeEvidenceScore,
    investigationScore: 90 + runtimeEvidenceScore,
    reasons: []
  },
  reachedTarget,
  finalTargetRecordIds: reachedTarget ? ["id"] : [],
  probeRequestsUsed: continuation.length,
  steps: continuation.map((count, index) => ({ index: index + 1, continuationRecordCount: count, status: count ? "DataObserved" : "NoMatchingDataObserved" }))
});

suite("mcpBusinessPathRuntimeValidation", () => {
  test("records the exact hop where a business path becomes empty", () => {
    const c = candidate("via-plan", 100, ["contact", "msemr_careplan", "msemr_careplanactivity"]);
    const result = validateBusinessPathResult(c, probe(c.pathId, false, [1, 0], -5) as any, 3);
    assert.strictEqual(result.runtimeStatus, "NoContinuationObserved");
    assert.strictEqual(result.breakHop, 2);
    assert.strictEqual(result.breakFromTable, "msemr_careplan");
    assert.strictEqual(result.breakToTable, "msemr_careplanactivity");
    assert.strictEqual(result.lastSuccessfulTable, "msemr_careplan");
    assert.strictEqual(result.lastSuccessfulRowCount, 1);
    assert.strictEqual(result.businessPreferred, "NotRuntimeViable");
    assert.strictEqual(result.routeSemantics, "MultiHopBusinessTraversalCandidate");
  });

  test("promotes a fully observed multi-hop path above a higher metadata-only empty path", () => {
    const direct = candidate("direct", 100, ["contact", "msemr_careplanactivity"]);
    const viaPlan = candidate("via-plan", 95, ["contact", "msemr_careplan", "msemr_careplanactivity"]);
    const validated = [
      validateBusinessPathResult(direct, probe(direct.pathId, false, [0], -10) as any, 3),
      validateBusinessPathResult(viaPlan, probe(viaPlan.pathId, true, [1, 3], 40) as any, 3)
    ];
    const ranked = rankValidatedBusinessPaths(validated);
    assert.strictEqual(ranked[0].pathId, "via-plan");
    assert.strictEqual(ranked[0].businessPreferred, "RuntimePreferred");
    assert.strictEqual(ranked[0].routeSemantics, "MultiHopBusinessTraversalCandidate");
    assert.strictEqual(ranked[0].finalTargetRecordCount, 3);
    assert.strictEqual(ranked[1].businessPreferred, "NotRuntimeViable");
  });


  test("classifies a one-hop winner as direct runtime reachability rather than business traversal semantics", () => {
    const direct = candidate("direct-observed", 110, ["contact", "sample_task"]);
    const result = validateBusinessPathResult(direct, probe(direct.pathId, true, [2], 40) as any, 3);
    assert.strictEqual(result.runtimeStatus, "RuntimeViable");
    assert.strictEqual(result.routeSemantics, "DirectRuntimeReachability");
    const ranked = rankValidatedBusinessPaths([result]);
    assert.strictEqual(ranked[0].businessPreferred, "RuntimePreferred");
    assert.strictEqual(ranked[0].routeSemantics, "DirectRuntimeReachability");
    assert.strictEqual(ranked[0].businessAuthority, "RuntimeShortcut");
  });

  test("preserves an investigator-asserted multi-hop traversal as business authority independently of runtime ranking", () => {
    const asserted = candidate("asserted-care-chain", 80, ["contact", "msemr_careplan", "msemr_careplanactivity", "sample_task"]);
    const shortcut = candidate("direct-shortcut", 120, ["contact", "sample_task"]);
    const assertedResult = validateBusinessPathResult(asserted, probe(asserted.pathId, true, [1, 1, 2], 20) as any, 3, true);
    const shortcutResult = validateBusinessPathResult(shortcut, probe(shortcut.pathId, true, [3], 50) as any, 3);
    const ranked = rankValidatedBusinessPaths([assertedResult, shortcutResult]);

    assert.strictEqual(ranked[0].pathId, "direct-shortcut");
    assert.strictEqual(ranked[0].businessPreferred, "RuntimePreferred");
    assert.strictEqual(ranked[0].businessAuthority, "RuntimeShortcut");
    const assertedRanked = ranked.find((item) => item.pathId === "asserted-care-chain");
    assert.strictEqual(assertedRanked?.runtimeStatus, "RuntimeViable");
    assert.strictEqual(assertedRanked?.businessAuthority, "AssertedBusinessTraversal");
    assert.strictEqual(assertedRanked?.routeSemantics, "MultiHopBusinessTraversalCandidate");
  });

  test("marks target counts at the probe limit as bounded lower-bound observations", () => {
    const c = candidate("bounded", 90, ["contact", "msemr_careplan", "msemr_careplanactivity"]);
    const result = validateBusinessPathResult(c, probe(c.pathId, true, [1, 3], 30) as any, 3);
    assert.strictEqual(result.observedTargetRecordCount, 3);
    assert.strictEqual(result.targetObservationBound, 3);
    assert.strictEqual(result.targetCountBoundary, "AtLimit");
  });

  test("marks target counts below the probe limit as below-limit observations", () => {
    const c = candidate("below-limit", 90, ["contact", "msemr_careplan", "msemr_careplanactivity"]);
    const result = validateBusinessPathResult(c, probe(c.pathId, true, [1, 2], 30) as any, 3);
    assert.strictEqual(result.observedTargetRecordCount, 2);
    assert.strictEqual(result.targetObservationBound, 3);
    assert.strictEqual(result.targetCountBoundary, "BelowLimit");
  });

  test("keeps access-denied candidates indeterminate instead of treating them as empty", () => {
    const c = candidate("restricted", 97, ["contact", "restricted", "target"]);
    const result = failedBusinessPathResult(c as any, {
      contractVersion: "dvqr-mcp-structured-execution-error-v1",
      code: "ExecutionFailed",
      summary: "Dataverse request failed with HTTP 403.",
      http: { status: 403 },
      dataverse: { category: "AccessDenied", message: "Access denied" },
      suggestedNextActions: []
    } as any);
    assert.strictEqual(result.runtimeStatus, "AccessLimited");
    assert.strictEqual(result.businessPreferred, "Indeterminate");
    assert.strictEqual(result.breakHop, 1);
  });

  test("marks candidates not attempted after budget exhaustion as NotTested", () => {
    const c = candidate("not-tested", 80, ["contact", "bridge", "target"]);
    const result = notTestedBusinessPathResult(c as any);
    assert.strictEqual(result.runtimeStatus, "NotTested");
    assert.strictEqual(result.businessPreferred, "NotTested");
    assert.strictEqual(result.completedHops, 0);
  });

  test("ranks runtime viable above access-limited and empty candidates", () => {
    const viable = validateBusinessPathResult(
      candidate("viable", 70, ["contact", "bridge", "target"]),
      probe("viable", true, [1, 2], 30) as any,
      3
    );
    const restricted = failedBusinessPathResult(candidate("restricted", 100, ["contact", "restricted", "target"]) as any, {
      contractVersion: "dvqr-mcp-structured-execution-error-v1",
      code: "ExecutionFailed",
      summary: "HTTP 403",
      http: { status: 403 },
      dataverse: { category: "AccessDenied", message: "Access denied" },
      suggestedNextActions: []
    } as any);
    const empty = validateBusinessPathResult(
      candidate("empty", 95, ["contact", "emptybridge", "target"]),
      probe("empty", false, [0], -5) as any,
      3
    );
    const ranked = rankValidatedBusinessPaths([restricted, empty, viable]);
    assert.strictEqual(ranked[0].pathId, "viable");
    assert.strictEqual(ranked[0].businessPreferred, "RuntimePreferred");
    assert.strictEqual(ranked[1].runtimeStatus, "AccessLimited");
  });
});
