import { getDataverseAccessToken } from "../auth/azureCliAuth.js";
import { mcpDataversePost, type DvqrMcpDataverseGetResult } from "./mcpDataverseTransport.js";
import type { DvqrMcpRuntimeConfiguration } from "./mcpRuntimeConfiguration.js";
import { mapStructuredExecutionError } from "./mcpStructuredErrors.js";
import type { DvqrMcpFreeToolResult } from "./mcpToolResults.js";
import { stringArg } from "./mcpRequestArguments.js";
import { McpCustomApiExecutionPreviewSessionStore } from "./mcpCustomApiExecutionPreviewSessionStore.js";
import { McpCustomApiExecutionEvidenceStore, type McpCustomApiExecutionEvidenceRepository } from "./mcpCustomApiExecutionEvidenceStore.js";

export type McpCustomApiAccessTokenProvider = (scope: string, tenantId?: string) => Promise<string>;
export type McpCustomApiPostExecutor = (args: {
  readonly baseUrl: string;
  readonly path: string;
  readonly token: string;
  readonly body: unknown;
  readonly timeoutMs: number;
}) => Promise<DvqrMcpDataverseGetResult<unknown>>;

function outputSummary(data: unknown): readonly string[] {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return [];
  }
  return Object.keys(data as Record<string, unknown>).sort();
}

export class McpCustomApiExecutionApplicationService {
  public constructor(
    private readonly config: DvqrMcpRuntimeConfiguration,
    private readonly previewSessions: McpCustomApiExecutionPreviewSessionStore,
    private readonly accessTokenProvider: McpCustomApiAccessTokenProvider = getDataverseAccessToken,
    private readonly postExecutor: McpCustomApiPostExecutor = mcpDataversePost,
    private readonly executionEvidence: McpCustomApiExecutionEvidenceRepository = new McpCustomApiExecutionEvidenceStore()
  ) {}

  public async execute(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    if (args.confirmation !== "EXECUTE") {
      return {
        ok: false,
        code: "InvalidArguments",
        message: "Explicit confirmation is required. Reply EXECUTE only after reviewing a fresh DVQR preview."
      };
    }

    const previewId = stringArg(args, "previewId");
    if (!previewId) {
      return {
        ok: false,
        code: "InvalidArguments",
        message: "previewId is required. Generate a fresh preview, present it to the user, and wait for the user to reply EXECUTE."
      };
    }

    const consumed = this.previewSessions.consume(previewId);
    if (!consumed.ok) {
      if (consumed.reason === "expired") {
        return {
          ok: false,
          code: "InvalidArguments",
          message: "This preview session has expired. Generate and review a fresh preview before executing."
        };
      }
      if (consumed.reason === "consumed") {
        return {
          ok: false,
          code: "InvalidArguments",
          message: "This preview session has already been consumed and cannot be replayed. Generate a fresh preview."
        };
      }
      return {
        ok: false,
        code: "InvalidArguments",
        message: "No active preview session exists for this previewId. Generate a fresh preview before executing."
      };
    }
    const plan = consumed.session.plan;
    if (!plan.preview) {
      return {
        ok: false,
        code: "ExecutionFailed",
        message: "The stored preview does not contain an executable plan. No execution occurred."
      };
    }

    const blockers: string[] = [];
    if (plan.readiness === "blocked" || plan.issues.length > 0) {
      blockers.push(...plan.issues);
    }
    if (plan.operationKind !== "Action") {
      blockers.push("Execution Pass 2 supports public global Actions only.");
    }
    if (plan.bindingKind !== "Global") {
      blockers.push("Execution Pass 2 does not execute entity-bound or collection-bound Custom APIs.");
    }
    if (plan.sideEffectPosture !== "generate-only") {
      blockers.push("Execution Pass 2 permits only generate-only Custom APIs.");
    }
    if (plan.preview.method !== "POST") {
      blockers.push("Execution Pass 2 supports POST Action invocation only.");
    }
    if (blockers.length > 0) {
      return {
        ok: false,
        code: "InvalidArguments",
        message: `Custom API execution is blocked: ${blockers.join(" ")}`,
        structuredContent: {
          contractVersion: "dvqr-mcp-custom-api-execution-result-v1",
          uniqueName: plan.uniqueName,
          executed: false,
          blockers,
          previewId,
          previewFingerprint: plan.executionPlanFingerprint,
          evidenceBoundary: "No Dataverse Custom API request was sent because the execution policy blocked the plan."
        }
      };
    }

    try {
      const token = await this.accessTokenProvider(`${plan.environmentUrl}/.default`, this.config.tenantId);
      const result = await this.postExecutor({
        baseUrl: plan.environmentUrl,
        path: plan.preview.route,
        token,
        body: plan.preview.body ?? {},
        timeoutMs: this.config.requestTimeoutMs
      });
      const outputs = outputSummary(result.data);
      const displayText = [
        `${plan.uniqueName} execution succeeded`,
        `HTTP status: ${result.executionContext.statusCode ?? "unknown"}`,
        `Duration: ${result.executionContext.durationMs ?? "unknown"} ms`,
        `Transport: ${result.transport}`,
        ...(outputs.length > 0 ? ["Returned properties:", ...outputs.map((name) => `- ${name}`)] : ["No response properties were returned."]),
        "The response is actual runtime evidence returned by Dataverse. DVQR has not validated its factual or business suitability."
      ].join("\n");

      const stored = this.executionEvidence.record({
        uniqueName: plan.uniqueName,
        environmentUrl: plan.environmentUrl,
        previewId,
        executed: true,
        response: result.data,
        expectedOutputs: plan.preview.expectedOutputs,
        executionContext: result.executionContext as unknown as Readonly<Record<string, unknown>>,
        transport: result.transport,
        nativeFetchFailure: result.nativeFetchFailure
      });
      return {
        ok: true,
        summary: `${plan.uniqueName} executed successfully.`,
        displayText,
        structuredContent: {
          contractVersion: "dvqr-mcp-custom-api-execution-result-v1",
          executionId: stored.executionId,
          environmentUrl: plan.environmentUrl,
          uniqueName: plan.uniqueName,
          executed: true,
          previewId,
          previewFingerprint: plan.executionPlanFingerprint,
          request: {
            method: plan.preview.method,
            route: plan.preview.route,
            parameterNames: Object.keys(plan.preview.body ?? {}).sort()
          },
          response: result.data,
          expectedOutputs: plan.preview.expectedOutputs,
          executionContext: result.executionContext,
          transport: result.transport,
          nativeFetchFailure: result.nativeFetchFailure,
          nextAction: { tool: "dvqr_interpret_custom_api_execution", executionId: stored.executionId },
          evidenceBoundary: "The HTTP status, transport metadata and response payload are actual runtime evidence returned by Dataverse. DVQR has not verified factual accuracy, downstream side effects or business suitability."
        }
      };
    } catch (error) {
      const structuredError = mapStructuredExecutionError(error, `${plan.preview.method} ${plan.preview.route}`);
      const stored = this.executionEvidence.record({
        uniqueName: plan.uniqueName,
        environmentUrl: plan.environmentUrl,
        previewId,
        executed: false,
        expectedOutputs: plan.preview.expectedOutputs,
        structuredError,
        message: structuredError.summary
      });
      return {
        ok: false,
        code: "ExecutionFailed",
        message: structuredError.summary,
        structuredError: {
          ...structuredError,
          executionId: stored.executionId,
          nextAction: { tool: "dvqr_interpret_custom_api_execution", executionId: stored.executionId },
          customApi: {
            uniqueName: plan.uniqueName,
            previewId,
            previewFingerprint: plan.executionPlanFingerprint,
            method: plan.preview.method,
            route: plan.preview.route
          }
        }
      };
    }
  }
}
