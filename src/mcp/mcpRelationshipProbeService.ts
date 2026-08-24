import { mcpDataverseGet } from "./mcpDataverseTransport.js";
import { buildRuntimeObservation, type McpRelationshipRuntimeObservation } from "./mcpRelationshipRuntimeEvidence.js";
import { generateRelationshipQuery } from "./mcpRelationshipQueryGenerator.js";
import type { McpRankedRelationshipPath } from "./mcpRelationshipIntelligence.js";
import type { DvqrMcpRuntimeConfiguration } from "./mcpRuntimeConfiguration.js";
import type { McpMetadataContext } from "./mcpRelationshipMetadataRepository.js";
import { McpRelationshipMetadataRepository } from "./mcpRelationshipMetadataRepository.js";

export interface McpRelationshipProbeResult {
  readonly observation: McpRelationshipRuntimeObservation;
  readonly reachedTarget: boolean;
  readonly finalTargetRecordIds: readonly string[];
  readonly steps: readonly unknown[];
  readonly probeRequestsUsed: number;
}

export class McpRelationshipProbeService {
  public constructor(
    private readonly config: DvqrMcpRuntimeConfiguration,
    private readonly metadata: McpRelationshipMetadataRepository
  ) {}

  public async probeRankedRelationshipPath(
    context: { baseEnvironmentUrl: string; token: string },
    path: McpRankedRelationshipPath,
    sourceRecordId: string,
    maxRecordsPerStep: number,
    budget: { remaining: number }
  ): Promise<{
    readonly observation: McpRelationshipRuntimeObservation;
    readonly reachedTarget: boolean;
    readonly finalTargetRecordIds: readonly string[];
    readonly steps: readonly unknown[];
    readonly probeRequestsUsed: number;
  }> {
    const shapes = await Promise.all(path.tables.map((table) => this.metadata.fetchEntityShape(context.baseEnvironmentUrl, context.token, table)));
    const generated = generateRelationshipQuery(path, shapes, sourceRecordId, maxRecordsPerStep);
    let currentIds = [sourceRecordId];
    const probeSteps: any[] = [];
    let probeRequestsUsed = 0;
    let intermediateRowsObserved = 0;
    let budgetExhausted = false;

    for (const step of generated.stagedQueries) {
      const targetShape = shapes.find((shape) => shape.logicalName.toLowerCase() === step.toTable.toLowerCase())!;
      const nextIds: string[] = [];
      const attempts: any[] = [];
      for (const currentId of currentIds.slice(0, maxRecordsPerStep)) {
        if (budget.remaining <= 0) {
          budgetExhausted = true;
          break;
        }
        budget.remaining -= 1;
        probeRequestsUsed += 1;
        const query = step.queryTemplate.replace(/<[^>]+>/, currentId);
        const result = await mcpDataverseGet<any>({
          baseUrl: `${context.baseEnvironmentUrl}/api/data/v9.2`,
          path: `/${query}`,
          token: context.token,
          timeoutMs: this.config.requestTimeoutMs
        });
        const data: any = result.data;
        // A 204/null ManyToOne navigation may be represented by the transport as an
        // empty object. Count landed records, not response envelopes: a singleton
        // exists only when the target primary ID is actually present.
        const singletonId = data && typeof data === "object" ? data[targetShape.primaryIdAttribute] : undefined;
        const rows = Array.isArray(data?.value)
          ? data.value
          : (typeof singletonId === "string" && singletonId ? [data] : []);
        for (const row of rows.slice(0, maxRecordsPerStep)) {
          const value = row?.[targetShape.primaryIdAttribute];
          if (typeof value === "string" && value) {
            nextIds.push(value);
          }
        }
        attempts.push({ sourceRecordId: currentId, query, returnedRecords: rows.length, transport: result.transport });
      }
      probeSteps.push({
        ...step,
        attempts,
        continuationRecordCount: nextIds.length,
        status: nextIds.length ? "DataObserved" : budgetExhausted ? "ProbeBudgetExhausted" : "NoMatchingDataObserved"
      });
      if (step.index < generated.stagedQueries.length) {
        intermediateRowsObserved += nextIds.length;
      }
      currentIds = [...new Set(nextIds)].slice(0, maxRecordsPerStep);
      if (!currentIds.length || budgetExhausted) {
        break;
      }
    }

    const reachedTarget = !budgetExhausted && probeSteps.length === path.hops.length && currentIds.length > 0;
    const observation = buildRuntimeObservation({
      path,
      reachedTarget,
      completedHops: probeSteps.length,
      intermediateRowsObserved,
      finalTargetRecordCount: reachedTarget ? currentIds.length : 0,
      probeBudgetExhausted: budgetExhausted
    });
    return {
      observation,
      reachedTarget,
      finalTargetRecordIds: reachedTarget ? currentIds : [],
      steps: probeSteps,
      probeRequestsUsed
    };
  }


}
