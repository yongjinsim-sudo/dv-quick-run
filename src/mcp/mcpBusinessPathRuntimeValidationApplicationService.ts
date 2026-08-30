import { mapStructuredExecutionError } from "./mcpStructuredErrors.js";
import { stringArg } from "./mcpRequestArguments.js";
import type { DvqrMcpFreeToolResult } from "./mcpToolResults.js";
import { McpRelationshipMetadataRepository } from "./mcpRelationshipMetadataRepository.js";
import { McpRelationshipProbeService } from "./mcpRelationshipProbeService.js";
import { rankBusinessPathCandidates } from "./mcpBusinessPathDiscovery.js";
import { candidateMatchesPreferredBusinessPath } from "./mcpBusinessPathRuntimeReuse.js";
import { businessPathEnvironmentIdentity } from "./mcpBusinessPathMetadataProvider.js";
import { businessPathPromotionAuthorizations, suggestedBusinessPathName } from "./mcpBusinessPathPromotionAuthorizationStore.js";
import type { BusinessPathHop } from "../core/businessPaths/index.js";
import {
  failedBusinessPathResult,
  notTestedBusinessPathResult,
  rankValidatedBusinessPaths,
  validateBusinessPathResult
} from "./mcpBusinessPathRuntimeValidation.js";

function promotionHopFromCandidate(
  hop: {
    readonly fromTable: string;
    readonly toTable: string;
    readonly relationshipSchemaName?: string;
    readonly relationshipType: "ManyToOne" | "OneToMany" | "ManyToMany";
    readonly navigationProperty: string;
    readonly referencingAttribute?: string;
  },
  ordinal: number
): BusinessPathHop | undefined {
  const relationshipSchemaName = hop.relationshipSchemaName?.trim();
  if (!relationshipSchemaName) {
    return undefined;
  }
  return {
    ordinal,
    fromTable: hop.fromTable,
    toTable: hop.toTable,
    relationshipSchemaName,
    relationshipType: hop.relationshipType,
    direction: "forward",
    ...(hop.navigationProperty ? { navigationProperty: hop.navigationProperty } : {}),
    ...(hop.referencingAttribute ? { lookupAttribute: hop.referencingAttribute } : {})
  };
}

interface CachedBusinessPathMetadata {
  readonly discovered: Awaited<ReturnType<McpRelationshipMetadataRepository["discoverDepthDiverseBusinessPaths"]>>;
  readonly catalogue: Awaited<ReturnType<McpRelationshipMetadataRepository["fetchEntityCatalogue"]>>;
}

export class McpBusinessPathRuntimeValidationApplicationService {
  private readonly metadataCache = new Map<string, CachedBusinessPathMetadata>();

  public constructor(
    private readonly metadata: McpRelationshipMetadataRepository,
    private readonly probes: McpRelationshipProbeService
  ) {}

  public async validateBusinessPaths(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const sourceTable = stringArg(args, "sourceTable");
    const targetTable = stringArg(args, "targetTable");
    const sourceRecordId = stringArg(args, "sourceRecordId");
    if (!sourceTable || !targetTable || !sourceRecordId) {
      return { ok: false, code: "InvalidArguments", message: "sourceTable, targetTable and sourceRecordId are required." };
    }

    try {
      const context = await this.metadata.metadataContext(args);
      if ("ok" in context) {
        return context;
      }

      const maxDepth = Math.max(2, Math.min(6, Number(args.maxDepth ?? 5)));
      const maxCandidates = Math.max(1, Math.min(8, Number(args.maxCandidates ?? 5)));
      const maxRecordsPerStep = Math.max(1, Math.min(10, Number(args.maxRecordsPerStep ?? 3)));
      const maxProbeRequests = Math.max(1, Math.min(30, Number(args.maxProbeRequests ?? 16)));
      const discoveryPoolSize = Math.max(maxCandidates * 6, 30);
      const assertedBusinessPathTables = Array.isArray(args.assertedBusinessPathTables)
        ? args.assertedBusinessPathTables.filter((value): value is string => typeof value === "string" && Boolean(value.trim())).map((value) => value.trim())
        : [];
      const assertedBusinessPathRelationshipSchemaNames = Array.isArray(args.assertedBusinessPathRelationshipSchemaNames)
        ? args.assertedBusinessPathRelationshipSchemaNames
            .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
            .map((value) => value.trim())
        : [];
      if (
        assertedBusinessPathRelationshipSchemaNames.length > 0
        && assertedBusinessPathTables.length < 2
      ) {
        return {
          ok: false,
          code: "InvalidArguments",
          message: "assertedBusinessPathRelationshipSchemaNames requires assertedBusinessPathTables."
        };
      }
      if (
        assertedBusinessPathRelationshipSchemaNames.length > 0
        && assertedBusinessPathRelationshipSchemaNames.length !== assertedBusinessPathTables.length - 1
      ) {
        return {
          ok: false,
          code: "InvalidArguments",
          message: "assertedBusinessPathRelationshipSchemaNames must contain exactly one relationship schema name per asserted hop."
        };
      }
      if (
        assertedBusinessPathTables.length >= 2
        && (
          assertedBusinessPathTables[0].toLowerCase() !== sourceTable.toLowerCase()
          || assertedBusinessPathTables[assertedBusinessPathTables.length - 1].toLowerCase() !== targetTable.toLowerCase()
        )
      ) {
        return {
          ok: false,
          code: "InvalidArguments",
          message: "assertedBusinessPathTables must begin with sourceTable and end with targetTable."
        };
      }

      const preferredBusinessPathId = stringArg(args, "preferredBusinessPathId");
      const normalizedAssertedBusinessPath = assertedBusinessPathTables.map((value) => value.toLowerCase());
      const assertedCacheSuffix = [
        normalizedAssertedBusinessPath.join(">"),
        assertedBusinessPathRelationshipSchemaNames.map((value) => value.toLowerCase()).join(">")
      ].join("|");
      const cacheKey = `${context.baseEnvironmentUrl.toLowerCase()}|${sourceTable.toLowerCase()}|${targetTable.toLowerCase()}|${maxDepth}|${assertedCacheSuffix}`;

      let metadataSource: "Fresh" | "Cached" = "Fresh";
      let metadataFallbackError: ReturnType<typeof mapStructuredExecutionError> | undefined;
      let metadataBundle: CachedBusinessPathMetadata;
      try {
        const discovered = await this.metadata.discoverDepthDiverseBusinessPaths(
          context,
          sourceTable,
          targetTable,
          maxDepth,
          discoveryPoolSize,
          assertedBusinessPathTables
        );
        const catalogue = await this.metadata.fetchEntityCatalogue(context.baseEnvironmentUrl, context.token);
        metadataBundle = { discovered, catalogue };
        this.metadataCache.set(cacheKey, metadataBundle);
      } catch (error) {
        const localCached = this.metadataCache.get(cacheKey);
        const repositoryDiscovery = this.metadata.getCachedDepthDiverseBusinessPaths(
          context.baseEnvironmentUrl,
          sourceTable,
          targetTable,
          maxDepth
        );
        const repositoryCatalogue = this.metadata.getCachedEntityCatalogue(context.baseEnvironmentUrl);
        const cached = localCached ?? (repositoryDiscovery && repositoryCatalogue
          ? { discovered: repositoryDiscovery, catalogue: [...repositoryCatalogue] }
          : undefined);
        if (!cached) {
          throw error;
        }
        metadataSource = "Cached";
        metadataFallbackError = mapStructuredExecutionError(error);
        metadataBundle = cached;
      }

      const { discovered, catalogue } = metadataBundle;
      const allBusinessCandidates = rankBusinessPathCandidates(discovered.ranked, catalogue);
      const assertedCandidates = normalizedAssertedBusinessPath.length >= 2
        ? allBusinessCandidates.filter((candidate) =>
            candidateMatchesPreferredBusinessPath(
              candidate,
              assertedBusinessPathTables,
              assertedBusinessPathRelationshipSchemaNames
            )
          )
        : [];
      const assertedCandidateIds = new Set(assertedCandidates.map((candidate) => candidate.pathId));
      const directBaselines = allBusinessCandidates
        .filter((candidate) => candidate.hops.length === 1)
        .slice(0, 2);

      // Runtime validation intentionally selects from a broader discovery pool for ordinary
      // discovery/validation calls. Saved Preferred-path execution is different: its route has
      // already been selected by exact table + relationship identity, so no alternative candidate,
      // direct baseline or shortcut is allowed to consume runtime budget in that operation.
      let businessCandidates: typeof allBusinessCandidates;
      if (preferredBusinessPathId) {
        if (!assertedCandidates.length) {
          return {
            ok: false,
            code: "InvalidArguments",
            message: `Saved Business Path ${preferredBusinessPathId} could not be resolved to its exact current metadata route. No alternative route was executed.`
          };
        }
        businessCandidates = [assertedCandidates[0]];
      } else {
        const primaryRuntimeCandidates = allBusinessCandidates.slice(0, maxCandidates);
        const selectedById = new Map(primaryRuntimeCandidates.map((candidate) => [candidate.pathId, candidate]));
        for (const direct of directBaselines) {
          selectedById.set(direct.pathId, direct);
        }
        // An explicit investigation business traversal is an authoritative hypothesis, not an automatic truth.
        // Ensure it enters the bounded runtime cohort when metadata discovery can resolve the exact table sequence.
        for (const assertedCandidate of assertedCandidates) {
          selectedById.set(assertedCandidate.pathId, assertedCandidate);
        }
        businessCandidates = [...selectedById.values()].sort((left, right) => {
          const leftAsserted = assertedCandidateIds.has(left.pathId) ? 0 : 1;
          const rightAsserted = assertedCandidateIds.has(right.pathId) ? 0 : 1;
          return leftAsserted - rightAsserted
            || right.businessPathScore - left.businessPathScore
            || right.metadataTraversalScore - left.metadataTraversalScore
            || left.pathId.localeCompare(right.pathId);
        });
      }
      const relationshipPathById = new Map(discovered.ranked.map((path) => [path.pathId, path]));

      if (!businessCandidates.length) {
        return { ok: false, code: "InvalidArguments", message: `No metadata-valid business path was found from ${sourceTable} to ${targetTable}.` };
      }

      const budget = { remaining: maxProbeRequests };
      const validated = [];
      for (const candidate of businessCandidates) {
        if (budget.remaining <= 0) {
          validated.push(notTestedBusinessPathResult(candidate, assertedCandidateIds.has(candidate.pathId)));
          continue;
        }
        const relationshipPath = relationshipPathById.get(candidate.pathId);
        if (!relationshipPath) {
          validated.push(notTestedBusinessPathResult(candidate, assertedCandidateIds.has(candidate.pathId)));
          continue;
        }
        try {
          const probe = await this.probes.probeRankedRelationshipPath(
            context,
            relationshipPath,
            sourceRecordId,
            maxRecordsPerStep,
            budget
          );
          validated.push(validateBusinessPathResult(candidate, probe, maxRecordsPerStep, assertedCandidateIds.has(candidate.pathId)));
        } catch (error) {
          // Candidate failures are evidence about that candidate, not a reason to abort the
          // cohort. In Dataverse, table-specific read privileges routinely differ by table.
          validated.push(failedBusinessPathResult(candidate, mapStructuredExecutionError(error), assertedCandidateIds.has(candidate.pathId)));
        }
      }

      const ranked = rankValidatedBusinessPaths(validated);
      const winner = ranked.find((item) => item.businessPreferred === "RuntimePreferred");
      const assertedValidatedVariants = ranked.filter((item) => assertedCandidateIds.has(item.pathId));
      const assertedValidated = assertedValidatedVariants.find((item) => item.runtimeStatus === "RuntimeViable")
        ?? assertedValidatedVariants[0];
      const businessPreferredTraversal = assertedValidated?.runtimeStatus === "RuntimeViable" ? assertedValidated : undefined;
      const promotionCandidate = businessPreferredTraversal
        ? allBusinessCandidates.find((candidate) => candidate.pathId === businessPreferredTraversal.pathId)
        : undefined;
      const promotionHops = promotionCandidate
        ? promotionCandidate.hops
            .map((hop, index) => promotionHopFromCandidate(hop, index + 1))
            .filter((hop): hop is BusinessPathHop => Boolean(hop))
        : [];
      const promotionAuthorization = (
        !preferredBusinessPathId
        && businessPreferredTraversal
        && promotionCandidate
        && promotionHops.length === promotionCandidate.hops.length
      )
        ? businessPathPromotionAuthorizations.issue({
            sourceTable,
            targetTable,
            sourceRecordId,
            environmentIdentity: businessPathEnvironmentIdentity(context.baseEnvironmentUrl),
            pathId: businessPreferredTraversal.pathId,
            tables: businessPreferredTraversal.tables,
            relationshipSchemaNames: promotionHops.map((hop) => hop.relationshipSchemaName),
            hops: promotionHops,
            observedTargetRows: businessPreferredTraversal.observedTargetRecordCount
          })
        : undefined;
      const probesUsed = maxProbeRequests - budget.remaining;

      return {
        ok: true,
        summary: winner
          ? winner.targetCountBoundary === "AtLimit"
            ? `Runtime validation observed a runtime-viable ${winner.routeSemantics === "DirectRuntimeReachability" ? "direct source-to-target route" : "multi-hop business traversal candidate"}: ${winner.tables.join(" → ")} (at least ${winner.observedTargetRecordCount} target record${winner.observedTargetRecordCount === 1 ? "" : "s"} observed; probe capped at ${winner.targetObservationBound}).`
            : `Runtime validation observed a runtime-viable ${winner.routeSemantics === "DirectRuntimeReachability" ? "direct source-to-target route" : "multi-hop business traversal candidate"}: ${winner.tables.join(" → ")} (${winner.observedTargetRecordCount} target record${winner.observedTargetRecordCount === 1 ? "" : "s"} observed within the probe bound of ${winner.targetObservationBound}).`
          : `Runtime validation did not reach ${targetTable} through the ${ranked.length} bounded business-path candidate${ranked.length === 1 ? "" : "s"} assessed.`,
        structuredContent: {
          contractVersion: "dvqr-mcp-business-path-runtime-validation-v1.1",
          sourceTable,
          targetTable,
          sourceRecordId,
          validationMode: "BoundedHopByHopRuntimeValidation",
          rankingBasis: "RuntimeViabilityFirstThenBusinessMetadataScore",
          metadataSource,
          ...(metadataFallbackError ? { metadataFallback: { reason: metadataFallbackError.summary, structuredError: metadataFallbackError } } : {}),
          runtimePreferredPath: winner,
          businessPreferredTraversal,
          promotionDecision: normalizedAssertedBusinessPath.length >= 2
            ? businessPreferredTraversal
              ? {
                  eligible: true,
                  source: "AssertedBusinessTraversal",
                  pathId: businessPreferredTraversal.pathId,
                  tables: businessPreferredTraversal.tables,
                  relationshipSchemaNames: promotionAuthorization?.relationshipSchemaNames
                    ?? assertedBusinessPathRelationshipSchemaNames,
                  authorization: promotionAuthorization
                    ? {
                        authorizationId: promotionAuthorization.authorizationId,
                        expiresAt: promotionAuthorization.expiresAt,
                        singleUse: true,
                        saveTool: "dvqr_save_business_path"
                      }
                    : undefined,
                  rule: "Only this exact asserted traversal is eligible for promotion from this validation result. Runtime-ranked shortcuts remain alternatives."
                }
              : {
                  eligible: false,
                  source: "AssertedBusinessTraversal",
                  tables: assertedBusinessPathTables,
                  relationshipSchemaNames: assertedBusinessPathRelationshipSchemaNames,
                  reason: assertedCandidates.length
                    ? "The asserted business traversal was metadata-resolved but did not reach the target in this bounded run."
                    : "The asserted business traversal was not resolved into the bounded metadata discovery pool.",
                  rule: "Do not promote runtimePreferredPath or another observed shortcut as a substitute for the asserted business traversal. A different route requires a separate explicit user selection."
                }
            : {
                eligible: false,
                source: "NoAssertedBusinessTraversal",
                reason: "No explicit business traversal was asserted for this validation request.",
                rule: "Runtime ranking alone is not organisational preference. Obtain explicit user selection before persistence."
              },
          saveFollowUp: promotionAuthorization
            ? {
                shouldAskUser: true,
                question: `Business path confirmed: ${promotionAuthorization.tables.join(" → ")}. It is metadata-valid and runtime-viable for this source record. Would you like to save this as a Preferred Business Path for this workspace?`,
                authorizationId: promotionAuthorization.authorizationId,
                expiresAt: promotionAuthorization.expiresAt,
                saveTool: "dvqr_save_business_path",
                suggestedName: suggestedBusinessPathName(promotionAuthorization.tables),
                instruction: "STOP after presenting this question. Do not save in the same turn. On a subsequent explicit user confirmation, call dvqr_save_business_path with this authorizationId and confirmSave=true. The name is optional in authorized mode; use the returned suggestedName unless the user supplies another name. Do not reconstruct intendedTables or hops."
              }
            : undefined,
          preferredBusinessPath: preferredBusinessPathId ? {
            pathId: preferredBusinessPathId,
            source: "BusinessPathLibrary",
            metadataRevalidation: "Valid",
            historicalVerification: args.preferredBusinessPathHistoricalVerification ?? "unknown",
            historicallyVerifiedInActiveEnvironment:
              args.preferredBusinessPathHistoricallyVerifiedInActiveEnvironment ?? null,
            runtimeEvidenceScope: "CurrentRunIsSeparateFromHistoricalVerification"
          } : undefined,
          assertedBusinessTraversal: normalizedAssertedBusinessPath.length >= 2 ? {
            tables: assertedBusinessPathTables,
            relationshipSchemaNames: assertedBusinessPathRelationshipSchemaNames,
            metadataResolution: assertedCandidates.length ? "ResolvedCandidates" : "NotResolvedInDiscoveryPool",
            runtimeStatus: assertedValidated?.runtimeStatus ?? "NotTested",
            pathId: assertedValidated?.pathId,
            relationshipVariantsResolved: assertedCandidates.length,
            exactRelationshipVariantRequested: assertedBusinessPathRelationshipSchemaNames.length > 0,
            reachedTarget: assertedValidated?.reachedTarget ?? false,
            interpretation: businessPreferredTraversal
              ? "The investigator-asserted business traversal was metadata-resolved and runtime-validated for this source record. It may be treated as the investigation-scoped business-preferred traversal while retaining shorter runtime shortcuts as reachability evidence only."
              : assertedCandidates.length
                ? "The investigator-asserted business traversal was metadata-resolved, including bounded relationship variants for the same table sequence, but no asserted variant reached the target in this run. Do not replace it with a shorter runtime shortcut as business truth; report the asserted traversal as unresolved/not observed and the shortcut separately."
                : "The investigator-asserted business traversal was not resolved into the bounded metadata discovery pool. No runtime conclusion was drawn for that exact chain; shorter observed routes remain runtime reachability evidence only."
          } : undefined,
          validatedPaths: ranked,
          validationSummary: {
            discoveryPoolRequested: discoveryPoolSize,
            metadataCandidatesConsidered: allBusinessCandidates.length,
            candidatesSelectedForRuntime: businessCandidates.length,
            requestedBusinessCandidates: maxCandidates,
            directBaselinesSelected: businessCandidates.filter((candidate) => candidate.hops.length === 1).length,
            assertedBusinessTraversalSelected: assertedCandidates.length > 0,
            assertedRelationshipVariantsSelected: assertedCandidates.length,
            pathsActuallyProbed: ranked.filter((item) => item.runtimeStatus !== "NotTested").length,
            runtimeViablePaths: ranked.filter((item) => item.runtimeStatus === "RuntimeViable").length,
            emptyPaths: ranked.filter((item) => item.runtimeStatus === "NoContinuationObserved").length,
            accessLimitedPaths: ranked.filter((item) => item.runtimeStatus === "AccessLimited").length,
            executionFailedPaths: ranked.filter((item) => item.runtimeStatus === "ExecutionFailed").length,
            notTestedPaths: ranked.filter((item) => item.runtimeStatus === "NotTested").length,
            probesUsed,
            probesRemaining: budget.remaining
          },
          bounds: { maxDepth, maxCandidates, maxRecordsPerStep, maxProbeRequests, discoveryPoolSize },
          distinction: {
            metadataValid: "Candidate relationships were metadata-verified before execution",
            runtimeViable: "Observed only when every hop produced continuation rows and the target was reached",
            businessPreferred: "RuntimePreferred is a legacy field name meaning the top observed runtime route for this source record. It does not establish that the route is the business-preferred traversal or persistent organisational truth.",
            directRoute: "DirectRuntimeReachability proves bounded source-to-target reachability only. Do not present a one-hop direct route as the business-preferred traversal when multi-hop business candidates also exist.",
            multiHopRoute: "MultiHopBusinessTraversalCandidate identifies a runtime-viable multi-hop route that can be considered for business traversal interpretation, still scoped to this record and bounds.",
            businessAuthority: "Runtime ranking and business-path authority are separate. An explicitly asserted traversal may become the investigation-scoped business-preferred traversal only when that exact chain is metadata-resolved and runtime-validated; shorter runtime shortcuts never displace it merely by ranking higher.",
            accessLimited: "AccessLimited means execution was blocked by security and must not be interpreted as an empty relationship",
            notTested: "NotTested means no runtime conclusion was drawn for that candidate",
            boundedCounts: "Observed row counts are bounded samples. AtLimit means the observed count reached maxRecordsPerStep and must be read as at least that many rows, not an exact total."
          },
          suggestedNextActions: winner ? [
            businessPreferredTraversal
              ? `Use the runtime-validated asserted business traversal ${businessPreferredTraversal.tables.join(" → ")} as the investigation-scoped business-preferred traversal; retain ${winner.pathId === businessPreferredTraversal.pathId ? "other viable routes" : `the runtime winner ${winner.tables.join(" → ")}`} as reachability/alternative evidence.`
              : assertedCandidates.length
                ? "The asserted business traversal did not reach the target through any bounded metadata-valid relationship variant in this run. Keep it unresolved/not observed and do not promote a shorter runtime route to business-preferred truth."
                : winner.routeSemantics === "DirectRuntimeReachability"
                  ? "Treat the direct winner as bounded runtime reachability only. Compare any runtime-viable multi-hop candidates before describing a business-preferred traversal."
                  : "Treat the runtime-preferred multi-hop route as investigation-scoped traversal evidence only. Obtain explicit user selection before promoting it to persistent workspace preference.",
            "Inspect per-hop row counts, access limitations and breakpoints of lower-ranked paths before concluding they are generally invalid.",
            "Pass the observed route into investigation evidence/Mini RCA integration in the next Pass 10 stage."
          ] : [
            "Inspect breakHop and runtimeStatus on each candidate to see whether rows stopped, access was limited, or execution was not attempted.",
            "Try a known-good representative source record before treating a candidate as non-viable generally.",
            "Increase the bounded probe budget cautiously only when candidates are explicitly NotTested."
          ],
          limitations: [
            "Runtime viability is scoped to the supplied source record and the bounded sample size.",
            "When targetCountBoundary is AtLimit, observedTargetRecordCount is a lower bound only; the actual total may be higher.",
            "An empty hop does not invalidate the relationship metadata or prove the path is never used by the business.",
            "AccessLimited and ExecutionFailed are indeterminate runtime outcomes, not evidence of zero rows.",
            "Pass 10.2.1 does not persist a Business Path Library preference or rewrite Pass 10.1 metadata scores."
          ]
        }
      };
    } catch (error) {
      const structuredError = mapStructuredExecutionError(error);
      return { ok: false, code: "ExecutionFailed", message: structuredError.summary, structuredError };
    }
  }
}
