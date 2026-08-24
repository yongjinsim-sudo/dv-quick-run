import type {
  BusinessPathArtifact,
  BusinessPathHop,
  BusinessPathPromotionInput
} from "../core/businessPaths/index.js";
import {
  BusinessPathRevalidationService,
  businessPathDisplayChain,
  businessPathId
} from "../core/businessPaths/index.js";
import { WorkspaceBusinessPathRepository } from "../runtime/businessPaths/workspaceBusinessPathRepository.js";
import { BusinessPathManagementService } from "../runtime/businessPaths/businessPathManagementService.js";
import { BusinessPathPromotionService } from "../runtime/businessPaths/businessPathPromotionService.js";
import { BusinessPathVerificationService } from "../runtime/businessPaths/businessPathVerificationService.js";
import { McpBusinessPathMetadataProvider, businessPathEnvironmentIdentity } from "./mcpBusinessPathMetadataProvider.js";
import { McpRelationshipMetadataRepository } from "./mcpRelationshipMetadataRepository.js";
import { McpRelationshipProbeService } from "./mcpRelationshipProbeService.js";
import { McpBusinessPathRuntimeValidationApplicationService } from "./mcpBusinessPathRuntimeValidationApplicationService.js";
import { McpPreferredBusinessPathRuntimeValidationService } from "./mcpPreferredBusinessPathRuntimeValidationService.js";
import { stringArg } from "./mcpRequestArguments.js";
import type { DvqrMcpRuntimeConfiguration } from "./mcpRuntimeConfiguration.js";
import type { DvqrMcpFreeToolResult } from "./mcpToolResults.js";
import { requireMcpWorkspaceBinding, resolveMcpWorkspaceBinding } from "./mcpWorkspaceBinding.js";
import { businessPathPromotionAuthorizations, suggestedBusinessPathName } from "./mcpBusinessPathPromotionAuthorizationStore.js";

const relationshipTypes = new Set(["ManyToOne", "OneToMany", "ManyToMany"]);
const directions = new Set(["forward", "reverse"]);

function workspaceDiagnostics(config: DvqrMcpRuntimeConfiguration): Record<string, unknown> {
  const binding = resolveMcpWorkspaceBinding(config);
  return binding.available
    ? {
        available: true,
        workspaceRoot: binding.workspaceRoot,
        businessPathDirectory: binding.businessPathDirectory,
        source: binding.source
      }
    : {
        available: false,
        source: binding.source,
        reason: binding.reason
      };
}

function numberArg(args: Record<string, unknown>, name: string): number | undefined {
  const value = args[name];
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringArrayArg(args: Record<string, unknown>, name: string): readonly string[] {
  const value = args[name];
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
        .map((item) => item.trim())
    : [];
}

function tablesFromHops(hops: readonly BusinessPathHop[]): readonly string[] {
  const ordered = [...hops].sort((left, right) => left.ordinal - right.ordinal);
  return ordered.length
    ? [ordered[0].fromTable, ...ordered.map((hop) => hop.toTable)]
    : [];
}

function sameTableSequence(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length
    && left.every((value, index) => value.trim().toLowerCase() === right[index]?.trim().toLowerCase());
}

function parseHops(args: Record<string, unknown>): readonly BusinessPathHop[] {
  if (!Array.isArray(args.hops) || !args.hops.length) {
    throw new Error("hops must contain at least one exact relationship hop.");
  }

  return args.hops.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`hops[${index}] must be an object.`);
    }
    const hop = raw as Record<string, unknown>;
    const fromTable = typeof hop.fromTable === "string" ? hop.fromTable.trim() : "";
    const toTable = typeof hop.toTable === "string" ? hop.toTable.trim() : "";
    const relationshipSchemaName = typeof hop.relationshipSchemaName === "string"
      ? hop.relationshipSchemaName.trim()
      : "";
    const relationshipType = typeof hop.relationshipType === "string" ? hop.relationshipType : "";
    const direction = typeof hop.direction === "string" ? hop.direction : "";

    if (!fromTable || !toTable || !relationshipSchemaName) {
      throw new Error(`hops[${index}] requires fromTable, toTable and relationshipSchemaName.`);
    }
    if (!relationshipTypes.has(relationshipType)) {
      throw new Error(`hops[${index}].relationshipType must be ManyToOne, OneToMany or ManyToMany.`);
    }
    if (!directions.has(direction)) {
      throw new Error(`hops[${index}].direction must be forward or reverse.`);
    }

    return {
      ordinal: index + 1,
      fromTable,
      toTable,
      relationshipSchemaName,
      relationshipType: relationshipType as BusinessPathHop["relationshipType"],
      direction: direction as BusinessPathHop["direction"],
      ...(typeof hop.navigationProperty === "string" && hop.navigationProperty.trim()
        ? { navigationProperty: hop.navigationProperty.trim() }
        : {}),
      ...(typeof hop.lookupAttribute === "string" && hop.lookupAttribute.trim()
        ? { lookupAttribute: hop.lookupAttribute.trim() }
        : {}),
      ...(typeof hop.intersectTable === "string" && hop.intersectTable.trim()
        ? { intersectTable: hop.intersectTable.trim() }
        : {}),
      ...(typeof hop.polymorphicTarget === "string" && hop.polymorphicTarget.trim()
        ? { polymorphicTarget: hop.polymorphicTarget.trim() }
        : {})
    };
  });
}

function artifactSummary(artifact: BusinessPathArtifact): Record<string, unknown> {
  return {
    id: artifact.id,
    name: artifact.name,
    description: artifact.description,
    sourceTable: artifact.sourceTable,
    targetTable: artifact.targetTable,
    state: artifact.state,
    priority: artifact.priority,
    route: businessPathDisplayChain(artifact),
    hops: artifact.hops,
    verification: artifact.verification,
    applicability: artifact.applicability,
    provenance: artifact.provenance,
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt
  };
}


function recordArg(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function arrayArg(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function exactPreferredRuntimeObservation(
  result: DvqrMcpFreeToolResult
): {
  readonly runtimeStatus: string;
  readonly reachedTarget: boolean;
  readonly observedTargetRows: number | null;
  readonly pathId?: string;
} | undefined {
  if (!result.ok) {
    return undefined;
  }

  const content = recordArg(result.structuredContent);
  const asserted = recordArg(content?.assertedBusinessTraversal);
  const pathId = typeof asserted?.pathId === "string" ? asserted.pathId : undefined;
  const runtimeStatus = typeof asserted?.runtimeStatus === "string"
    ? asserted.runtimeStatus
    : "NotTested";
  const reachedTarget = asserted?.reachedTarget === true;

  const validated = arrayArg(content?.validatedPaths)
    .map(recordArg)
    .filter((item): item is Record<string, unknown> => Boolean(item));
  const exact = pathId
    ? validated.find((item) => item.pathId === pathId)
    : undefined;
  const observed = typeof exact?.observedTargetRecordCount === "number"
    ? exact.observedTargetRecordCount
    : null;

  return {
    runtimeStatus,
    reachedTarget,
    observedTargetRows: observed,
    ...(pathId ? { pathId } : {})
  };
}

/**
 * MCP adapter over canonical Managed Business Path services.
 *
 * This class owns no discovery, ranking, persistence format, validation or
 * mutation semantics. Those remain in the core/runtime services.
 */
export class McpBusinessPathManagementApplicationService {
  private readonly metadata: McpRelationshipMetadataRepository;

  public constructor(private readonly config: DvqrMcpRuntimeConfiguration) {
    this.metadata = new McpRelationshipMetadataRepository(config);
  }

  public async list(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const binding = resolveMcpWorkspaceBinding(this.config);
    if (!binding.available) {
      return {
        ok: false,
        code: "InvalidArguments",
        message: binding.reason,
        structuredContent: { workspace: workspaceDiagnostics(this.config) }
      };
    }
    try {
      const repository = new WorkspaceBusinessPathRepository(requireMcpWorkspaceBinding(this.config).workspaceRoot);
      const sourceTable = stringArg(args, "sourceTable");
      const targetTable = stringArg(args, "targetTable");
      const includeDisabled = args.includeDisabled === true;
      const inspection = repository.inspect();

      let paths = [...inspection.artifacts];
      if (sourceTable) {
        paths = paths.filter((item) => item.sourceTable.toLowerCase() === sourceTable.toLowerCase());
      }
      if (targetTable) {
        paths = paths.filter((item) => item.targetTable.toLowerCase() === targetTable.toLowerCase());
      }
      if (!includeDisabled) {
        paths = paths.filter((item) => item.state !== "disabled");
      }

      return {
        ok: true,
        summary: paths.length
          ? `Found ${paths.length} managed Business Path${paths.length === 1 ? "" : "s"} in the workspace.`
          : "No matching managed Business Paths were found in the workspace.",
        structuredContent: {
          contractVersion: "dvqr-mcp-managed-business-path-list-v1",
          workspace: workspaceDiagnostics(this.config),
          resultCount: paths.length,
          paths: paths.map(artifactSummary),
          diagnostics: inspection.diagnostics,
          distinction: "Saved preference is workspace guidance. It does not prove current metadata validity or runtime viability."
        }
      };
    } catch (error) {
      return { ok: false, code: "ExecutionFailed", message: error instanceof Error ? error.message : "Business Path list failed." };
    }
  }

  public async get(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const binding = resolveMcpWorkspaceBinding(this.config);
    if (!binding.available) {
      return {
        ok: false,
        code: "InvalidArguments",
        message: binding.reason,
        structuredContent: { workspace: workspaceDiagnostics(this.config) }
      };
    }
    const pathId = stringArg(args, "pathId");
    if (!pathId) return { ok: false, code: "InvalidArguments", message: "pathId is required." };

    try {
      const artifact = new WorkspaceBusinessPathRepository(requireMcpWorkspaceBinding(this.config).workspaceRoot).findById(pathId);
      if (!artifact) {
        return { ok: false, code: "InvalidArguments", message: `Business Path ${pathId} was not found.` };
      }
      return {
        ok: true,
        summary: `Loaded managed Business Path ${artifact.name}.`,
        structuredContent: {
          contractVersion: "dvqr-mcp-managed-business-path-v1",
          workspace: workspaceDiagnostics(this.config),
          path: artifactSummary(artifact),
          distinction: "This is saved workspace preference and historical provenance; current metadata/runtime truth must be evaluated separately."
        }
      };
    } catch (error) {
      return { ok: false, code: "ExecutionFailed", message: error instanceof Error ? error.message : "Business Path retrieval failed." };
    }
  }

  public async save(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const binding = resolveMcpWorkspaceBinding(this.config);
    if (!binding.available) {
      return {
        ok: false,
        code: "InvalidArguments",
        message: binding.reason,
        structuredContent: { workspace: workspaceDiagnostics(this.config) }
      };
    }
    if (args.confirmSave !== true) {
      return {
        ok: false,
        code: "InvalidArguments",
        message: "confirmSave=true is required. Save a Business Path only after explicit user intent to persist this exact route."
      };
    }

    const promotionAuthorizationId = stringArg(args, "promotionAuthorizationId");
    const authorization = promotionAuthorizationId
      ? businessPathPromotionAuthorizations.get(promotionAuthorizationId)
      : undefined;

    if (promotionAuthorizationId && !authorization) {
      return {
        ok: false,
        code: "InvalidArguments",
        message: "The Business Path promotion authorization is missing, expired, already consumed, or belongs to another MCP process. Re-run exact asserted Business Path validation and confirm the new save follow-up."
      };
    }

    const name = stringArg(args, "name")
      ?? (authorization ? suggestedBusinessPathName(authorization.tables) : undefined);
    if (!name) {
      return {
        ok: false,
        code: "InvalidArguments",
        message: "name is required for manual save. Authorized save follow-up may omit name and use DVQR's suggested route name."
      };
    }

    let sourceTable: string;
    let targetTable: string;
    let intendedTables: readonly string[];
    let hops: readonly BusinessPathHop[];

    if (authorization) {
      sourceTable = authorization.sourceTable;
      targetTable = authorization.targetTable;
      intendedTables = authorization.tables;
      hops = authorization.hops;

      const suppliedSource = stringArg(args, "sourceTable");
      const suppliedTarget = stringArg(args, "targetTable");
      const suppliedIntended = stringArrayArg(args, "intendedTables");
      if (suppliedSource && suppliedSource.toLowerCase() !== sourceTable.toLowerCase()) {
        return { ok: false, code: "InvalidArguments", message: "sourceTable does not match the authorized promotion route." };
      }
      if (suppliedTarget && suppliedTarget.toLowerCase() !== targetTable.toLowerCase()) {
        return { ok: false, code: "InvalidArguments", message: "targetTable does not match the authorized promotion route." };
      }
      if (suppliedIntended.length && !sameTableSequence(suppliedIntended, intendedTables)) {
        return {
          ok: false,
          code: "InvalidArguments",
          message: `intendedTables does not match the authorized promotion route. Authorized: ${intendedTables.join(" → ")}.`
        };
      }
      if (Array.isArray(args.hops)) {
        const suppliedHops = parseHops(args);
        if (!sameTableSequence(tablesFromHops(suppliedHops), intendedTables)) {
          return {
            ok: false,
            code: "InvalidArguments",
            message: `Supplied hops do not match the authorized promotion route. Authorized: ${intendedTables.join(" → ")}.`
          };
        }
        const authorizedSchemas = hops.map((hop) => hop.relationshipSchemaName.toLowerCase());
        const suppliedSchemas = suppliedHops.map((hop) => hop.relationshipSchemaName.toLowerCase());
        if (
          authorizedSchemas.length !== suppliedSchemas.length
          || !authorizedSchemas.every((value, index) => value === suppliedSchemas[index])
        ) {
          return {
            ok: false,
            code: "InvalidArguments",
            message: "Supplied relationship identities do not match the authorized promotion route."
          };
        }
      }
    } else {
      const manualSource = stringArg(args, "sourceTable");
      const manualTarget = stringArg(args, "targetTable");
      const manualIntended = stringArrayArg(args, "intendedTables");
      if (!manualSource || !manualTarget || manualIntended.length < 2) {
        return {
          ok: false,
          code: "InvalidArguments",
          message: "Manual save requires sourceTable, targetTable and intendedTables. For a runtime-validated save follow-up, pass promotionAuthorizationId instead and do not reconstruct the route."
        };
      }
      sourceTable = manualSource;
      targetTable = manualTarget;
      intendedTables = manualIntended;
      try {
        hops = parseHops(args);
      } catch (error) {
        return {
          ok: false,
          code: "InvalidArguments",
          message: error instanceof Error ? error.message : "Manual save requires exact hops."
        };
      }
    }

    const persistedTables = tablesFromHops(hops);
    if (!sameTableSequence(intendedTables, persistedTables)) {
      return {
        ok: false,
        code: "InvalidArguments",
        message: `Business Path promotion rejected because the route being saved differs from the selected/asserted business traversal. Intended: ${intendedTables.join(" → ")}. Supplied hops: ${persistedTables.join(" → ")}. A different runtime-observed route requires a separate explicit user selection before it can be saved.`
      };
    }
    if (
      intendedTables[0].toLowerCase() !== sourceTable.toLowerCase()
      || intendedTables[intendedTables.length - 1].toLowerCase() !== targetTable.toLowerCase()
    ) {
      return {
        ok: false,
        code: "InvalidArguments",
        message: "intendedTables must begin with sourceTable and end with targetTable."
      };
    }

    try {
      const priority = numberArg(args, "priority");
      if (priority !== undefined && (!Number.isInteger(priority) || priority < 0)) {
        return { ok: false, code: "InvalidArguments", message: "priority must be a non-negative integer." };
      }

      const context = await this.metadata.metadataContext(args);
      if ("ok" in context) {
        return context;
      }
      const environmentIdentity = businessPathEnvironmentIdentity(context.baseEnvironmentUrl);
      if (
        authorization
        && authorization.environmentIdentity.toLowerCase() !== environmentIdentity.toLowerCase()
      ) {
        return {
          ok: false,
          code: "InvalidArguments",
          message: `Promotion authorization belongs to ${authorization.environmentIdentity}, but the active environment is ${environmentIdentity}. Revalidate the asserted Business Path in the active environment.`
        };
      }

      const now = new Date().toISOString();
      const input: BusinessPathPromotionInput = {
        name,
        ...(stringArg(args, "description") ? { description: stringArg(args, "description") } : {}),
        sourceTable,
        targetTable,
        hops,
        ...(priority !== undefined ? { priority } : {}),
        provenance: authorization
          ? {
              promotedFrom: "runtime-validation",
              sourceEvidenceId: authorization.pathId,
              promotedAt: now,
              promotedBy: "user"
            }
          : {
              promotedFrom: "manual-reviewed",
              promotedAt: now,
              promotedBy: "user"
            },
        verification: authorization
          ? {
              status: "verified",
              environment: { identity: authorization.environmentIdentity },
              verifiedAt: authorization.issuedAt,
              testedSourceCount: 1,
              reachedTargetCount: 1,
              observedTargetRows: authorization.observedTargetRows,
              bounded: true,
              evidenceRef: authorization.pathId
            }
          : {
              status: "not-runtime-verified",
              bounded: true
            },
        applicability: authorization
          ? {
              scope: "workspace",
              verifiedEnvironmentIds: [authorization.environmentIdentity]
            }
          : { scope: "workspace" }
      };

      const repository = new WorkspaceBusinessPathRepository(requireMcpWorkspaceBinding(this.config).workspaceRoot);
      const promotion = new BusinessPathPromotionService(repository);
      const transientArtifact: BusinessPathArtifact = {
        schemaVersion: "dvqr-business-path-v1",
        id: businessPathId(sourceTable, targetTable, hops),
        name,
        ...(stringArg(args, "description") ? { description: stringArg(args, "description") } : {}),
        sourceTable,
        targetTable,
        state: "preferred",
        ...(priority !== undefined ? { priority } : {}),
        hops,
        provenance: input.provenance,
        verification: input.verification,
        applicability: input.applicability,
        createdAt: now,
        updatedAt: now
      };

      const validation = await new BusinessPathRevalidationService(
        new McpBusinessPathMetadataProvider(this.metadata, context)
      ).revalidate(transientArtifact, environmentIdentity);

      if (validation.state !== "valid") {
        return {
          ok: false,
          code: "InvalidArguments",
          message: validation.state === "stale"
            ? `Business Path cannot be saved because current metadata does not validate the exact route: ${validation.issues[0]?.message ?? "saved relationship identity is stale."}`
            : "Business Path cannot be saved because current metadata validation could not complete."
        };
      }

      const result = promotion.promote(input);
      if (authorization) {
        businessPathPromotionAuthorizations.consume(authorization.authorizationId);
      }

      return {
        ok: true,
        summary: result.created
          ? `Saved Preferred Business Path ${result.artifact.name}.`
          : `Updated existing Preferred Business Path ${result.artifact.name}.`,
        structuredContent: {
          contractVersion: "dvqr-mcp-managed-business-path-save-v1.1",
          workspace: workspaceDiagnostics(this.config),
          mutation: result.created ? "created" : "updated",
          promotionMode: authorization ? "AuthorizedRuntimeValidation" : "ManualReviewed",
          pathNameSource: stringArg(args, "name") ? "UserSupplied" : "DvqrSuggested",
          promotionAuthorization: authorization
            ? {
                authorizationId: authorization.authorizationId,
                consumed: true,
                sourceRecordId: authorization.sourceRecordId,
                environment: authorization.environmentIdentity,
                validatedPathId: authorization.pathId
              }
            : undefined,
          intendedTables,
          routeIntegrity: {
            matched: true,
            persistedTables: tablesFromHops(result.artifact.hops),
            relationshipSchemaNames: result.artifact.hops.map((hop) => hop.relationshipSchemaName),
            rule: authorization
              ? "Persisted route was loaded from the server-held promotion authorization; host reconstruction was not trusted."
              : "Persisted hops exactly match the explicitly supplied manual table sequence."
          },
          path: artifactSummary(result.artifact),
          metadataValidation: validation,
          verificationBoundary: authorization
            ? "Canonical runtime evidence from the authorized asserted-path validation is persisted as historical verification."
            : "Manual save does not claim runtime verification. Use existing runtime validation to establish current bounded runtime evidence."
        }
      };
    } catch (error) {
      return { ok: false, code: "InvalidArguments", message: error instanceof Error ? error.message : "Business Path save failed." };
    }
  }

  public async test(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const binding = resolveMcpWorkspaceBinding(this.config);
    if (!binding.available) {
      return {
        ok: false,
        code: "InvalidArguments",
        message: binding.reason,
        structuredContent: { workspace: workspaceDiagnostics(this.config) }
      };
    }
    const pathId = stringArg(args, "pathId");
    const sourceRecordId = stringArg(args, "sourceRecordId");
    if (!pathId || !sourceRecordId) {
      return {
        ok: false,
        code: "InvalidArguments",
        message: "pathId and sourceRecordId are required."
      };
    }

    try {
      const repository = new WorkspaceBusinessPathRepository(requireMcpWorkspaceBinding(this.config).workspaceRoot);
      const artifact = repository.findById(pathId);
      if (!artifact) {
        return { ok: false, code: "InvalidArguments", message: `Business Path ${pathId} was not found.` };
      }
      if (artifact.state !== "preferred") {
        return {
          ok: false,
          code: "InvalidArguments",
          message: `Business Path ${pathId} is disabled. Enable it as Preferred before using the managed-path runtime test.`
        };
      }

      const context = await this.metadata.metadataContext(args);
      if ("ok" in context) {
        return context;
      }

      const environmentIdentity = businessPathEnvironmentIdentity(context.baseEnvironmentUrl);
      const revalidation = await new BusinessPathRevalidationService(
        new McpBusinessPathMetadataProvider(this.metadata, context)
      ).revalidate(artifact, environmentIdentity);

      if (revalidation.state !== "valid") {
        return {
          ok: false,
          code: "InvalidArguments",
          message: revalidation.state === "stale"
            ? `Business Path ${pathId} is stale and cannot be runtime-tested as Preferred: ${revalidation.issues[0]?.message ?? "saved relationship identity no longer resolves."}`
            : `Business Path ${pathId} could not be metadata-revalidated, so no runtime conclusion was attempted.`
        };
      }

      const probes = new McpRelationshipProbeService(this.config, this.metadata);
      const validator = new McpBusinessPathRuntimeValidationApplicationService(this.metadata, probes);
      const preferredRuntime = new McpPreferredBusinessPathRuntimeValidationService(validator);
      const runtimeResult = await preferredRuntime.validatePreferredPath({
        artifact,
        revalidation,
        sourceRecordId,
        runtimeArguments: {
          ...args,
          environmentUrl: context.baseEnvironmentUrl
        },
        maxCandidates: numberArg(args, "maxCandidates") ?? 5,
        maxRecordsPerStep: numberArg(args, "maxRecordsPerStep") ?? 5,
        maxProbeRequests: numberArg(args, "maxProbeRequests") ?? 16,
        maxDepth: Math.max(2, numberArg(args, "maxDepth") ?? Math.max(5, artifact.hops.length))
      });

      if (!runtimeResult.ok) {
        return runtimeResult;
      }

      const observation = exactPreferredRuntimeObservation(runtimeResult);
      let refreshedArtifact: BusinessPathArtifact | undefined;
      const refreshVerification = args.refreshVerification !== false;

      if (
        refreshVerification
        && observation?.runtimeStatus === "RuntimeViable"
        && observation.reachedTarget
      ) {
        refreshedArtifact = new BusinessPathVerificationService(repository)
          .recordSuccessfulRuntimeVerification(pathId, {
            environment: { identity: environmentIdentity },
            observedTargetRows: observation.observedTargetRows
          });
      }

      const content = recordArg(runtimeResult.structuredContent) ?? {};
      return {
        ok: true,
        summary: observation?.runtimeStatus === "RuntimeViable" && observation.reachedTarget
          ? `Preferred Business Path ${artifact.name} reached ${artifact.targetTable} for the supplied source record.`
          : `Preferred Business Path ${artifact.name} did not reach ${artifact.targetTable} in this bounded run; its saved preference and any earlier successful verification remain unchanged.`,
        structuredContent: {
          contractVersion: "dvqr-mcp-managed-business-path-runtime-test-v1",
          workspace: workspaceDiagnostics(this.config),
          path: artifactSummary(refreshedArtifact ?? artifact),
          metadataRevalidation: revalidation,
          currentRuntimeObservation: observation ?? {
            runtimeStatus: "NotTested",
            reachedTarget: false,
            observedTargetRows: null
          },
          verificationRefresh: refreshedArtifact
            ? {
                refreshed: true,
                status: refreshedArtifact.verification?.status,
                verifiedAt: refreshedArtifact.verification?.verifiedAt,
                environment: refreshedArtifact.verification?.environment
              }
            : {
                refreshed: false,
                reason: refreshVerification
                  ? "Current exact saved path did not reach the target; historical verification was not downgraded."
                  : "refreshVerification=false requested a read-only runtime test."
              },
          runtimeValidation: content,
          scopeBoundary: {
            exactPathOnly: true,
            operationTerminated: true,
            automaticBroadeningAllowed: false,
            alternateRouteDiscoveryAllowed: false,
            alternateTargetProbeAllowed: false,
            alternateEntitySetGuessingAllowed: false,
            requiresNewUserRequestForBroaderInvestigation: true,
            outcome: observation?.runtimeStatus === "RuntimeViable" && observation.reachedTarget
              ? "TargetReached"
              : "TerminatedAtBoundedFrontier",
            forbiddenAutomaticContinuations: [
              "direct or broad target-table queries",
              "alternate entity-set guesses",
              "relationship-path probing",
              "alternate route discovery",
              "target-concept expansion",
              "metadata search intended to substitute another target or route"
            ],
            nextStep: observation?.runtimeStatus === "RuntimeViable" && observation.reachedTarget
              ? "This exact-path operation is complete. Any unrelated or broader query, alternate route discovery, or alternate target probe requires a new explicit user request."
              : "Stop this Business Path operation. Do not automatically call dvqr_execute_odata, dvqr_probe_relationship_path, dvqr_discover_business_paths, query the target table broadly, try alternate entity-set names, expand target concepts, search for substitute targets, or otherwise widen scope in the same user request. Any broader investigation requires a new explicit user request."
          },
          distinction: {
            preferred: "Workspace preference remains explicit organisational guidance, not organisation-wide truth or production readiness.",
            metadata: "Current metadata revalidation is separate from runtime row evidence.",
            currentRuntime: "Current runtime observation is scoped to this source record and bounded probe settings.",
            historicalVerification: "A successful canonical saved-path test may refresh bounded historical verification provenance. Empty or failed current runs never erase earlier successful verification and never authorize automatic scope broadening."
          }
        }
      };
    } catch (error) {
      return {
        ok: false,
        code: "ExecutionFailed",
        message: error instanceof Error ? error.message : "Preferred Business Path runtime test failed."
      };
    }
  }

  public async remove(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const binding = resolveMcpWorkspaceBinding(this.config);
    if (!binding.available) {
      return {
        ok: false,
        code: "InvalidArguments",
        message: binding.reason,
        structuredContent: { workspace: workspaceDiagnostics(this.config) }
      };
    }
    const pathId = stringArg(args, "pathId");
    if (!pathId) return { ok: false, code: "InvalidArguments", message: "pathId is required." };
    if (args.confirmDelete !== true) {
      return {
        ok: false,
        code: "InvalidArguments",
        message: "confirmDelete=true is required. Delete only after explicit user intent."
      };
    }

    try {
      const repository = new WorkspaceBusinessPathRepository(requireMcpWorkspaceBinding(this.config).workspaceRoot);
      const existing = repository.findById(pathId);
      if (!existing) {
        return { ok: false, code: "InvalidArguments", message: `Business Path ${pathId} was not found.` };
      }
      const deleted = new BusinessPathManagementService(repository).delete(pathId);
      return {
        ok: true,
        summary: deleted
          ? `Deleted workspace Business Path ${existing.name}.`
          : `Business Path ${pathId} was not deleted.`,
        structuredContent: {
          contractVersion: "dvqr-mcp-managed-business-path-delete-v1",
          workspace: workspaceDiagnostics(this.config),
          pathId,
          deleted,
          historicalEvidenceBoundary: "Deleting workspace preference does not delete historical investigation evidence."
        }
      };
    } catch (error) {
      return { ok: false, code: "ExecutionFailed", message: error instanceof Error ? error.message : "Business Path delete failed." };
    }
  }

  public async revalidate(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const binding = resolveMcpWorkspaceBinding(this.config);
    if (!binding.available) {
      return {
        ok: false,
        code: "InvalidArguments",
        message: binding.reason,
        structuredContent: { workspace: workspaceDiagnostics(this.config) }
      };
    }
    const pathId = stringArg(args, "pathId");
    if (!pathId) return { ok: false, code: "InvalidArguments", message: "pathId is required." };

    try {
      const repository = new WorkspaceBusinessPathRepository(requireMcpWorkspaceBinding(this.config).workspaceRoot);
      const artifact = repository.findById(pathId);
      if (!artifact) {
        return { ok: false, code: "InvalidArguments", message: `Business Path ${pathId} was not found.` };
      }

      const context = await this.metadata.metadataContext(args);
      if ("ok" in context) {
        return context;
      }
      const validation = await new BusinessPathRevalidationService(
        new McpBusinessPathMetadataProvider(this.metadata, context)
      ).revalidate(artifact, businessPathEnvironmentIdentity(context.baseEnvironmentUrl));

      return {
        ok: true,
        summary: validation.state === "valid"
          ? `${artifact.name} is valid against current metadata.`
          : validation.state === "stale"
            ? `${artifact.name} is stale against current metadata.`
            : `${artifact.name} metadata validation is unavailable.`,
        structuredContent: {
          contractVersion: "dvqr-mcp-managed-business-path-revalidation-v1",
          workspace: workspaceDiagnostics(this.config),
          path: artifactSummary(artifact),
          validation,
          runtimeBoundary: "Metadata revalidation does not test rows or establish current runtime viability."
        }
      };
    } catch (error) {
      return { ok: false, code: "ExecutionFailed", message: error instanceof Error ? error.message : "Business Path revalidation failed." };
    }
  }
}
