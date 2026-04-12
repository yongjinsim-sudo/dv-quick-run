import * as vscode from "vscode";
import type { CommandContext } from "../../../context/commandContext.js";
import { canRunTraversalBatch, canRunTraversalOptimizedBatch } from "../../../../product/capabilities/capabilityResolver.js";
import { getActiveTraversalProgress, isActiveTraversalSession } from "../shared/traversal/traversalProgressStore.js";
import { runAction } from "../shared/actionRunner.js";
import { previewAndRunBatchQueries } from "../execution/batch/runBatchExecutionFlow.js";
import { buildStepExecutionPlan } from "../shared/traversal/traversalStepExecutor.js";



function getSelectedInputForStep(progress: any, stepIndex: number, step: any) {
  const selectedCarryValue = progress.selectedCarryValuesByStep?.[stepIndex];
  const currentStepSelectedInput =
    stepIndex === progress.currentStepIndex &&
    progress.currentStepInput &&
    progress.currentStepInput.entityName === step.fromEntity &&
    Array.isArray(progress.currentStepInput.ids) &&
    progress.currentStepInput.ids.length > 0
      ? {
          entityName: progress.currentStepInput.entityName,
          ids: [progress.currentStepInput.ids[0]!]
        }
      : undefined;
  return selectedCarryValue
    ? {
        entityName: step.fromEntity,
        ids: [selectedCarryValue]
      }
    : currentStepSelectedInput ?? progress.selectedInputsByStep?.[stepIndex];
}

function buildOptimizedPreviousStepFilter(progress: any, step: any, stepIndex: number): string | undefined {
  const nextSelectedInput = progress.selectedInputsByStep?.[stepIndex + 1] ??
    ((stepIndex + 1 === progress.currentStepIndex && progress.currentStepInput) ? progress.currentStepInput : undefined);

  if (!nextSelectedInput || nextSelectedInput.entityName !== step.toEntity || !Array.isArray(nextSelectedInput.ids) || nextSelectedInput.ids.length === 0) {
    return undefined;
  }

  const selectedId = String(nextSelectedInput.ids[0] ?? '').trim();
  if (!selectedId) {
    return undefined;
  }

  const targetNode = progress.graph.entities[step.toEntity];
  const targetPrimaryId = targetNode?.primaryIdAttribute;
  if (!targetPrimaryId || !Array.isArray(step.edges) || step.edges.length === 0) {
    return undefined;
  }

  const relationshipPath = step.edges.map((edge: any) => edge.navigationPropertyName).filter((value: string) => !!value).join('/');
  if (!relationshipPath) {
    return undefined;
  }

  return `${relationshipPath}/${targetPrimaryId} eq '${selectedId}'`;
}

function mergeFilterIntoQueryPath(queryPath: string, newFilter: string): string {
  const [pathPart, queryPart = ''] = queryPath.split('?');
  const parts = queryPart ? queryPart.split('&').filter(Boolean) : [];
  const filterIndex = parts.findIndex((part) => part.startsWith('$filter='));

  if (filterIndex >= 0) {
    const existingFilter = parts[filterIndex].slice('$filter='.length);
    parts[filterIndex] = `$filter=(${existingFilter}) and (${newFilter})`;
  } else {
    parts.splice(1, 0, `$filter=${newFilter}`);
  }

  return parts.length ? `${pathPart}?${parts.join('&')}` : pathPart;
}

export async function runTraversalAsBatchAction(
  ctx: CommandContext,
  request?: { traversalSessionId?: string; optimizeSelectedPath?: boolean }
): Promise<void> {
  await runAction(ctx, "DV Quick Run: Run traversal as $batch failed. Check Output.", async () => {

    const optimizeSelectedPath = !!request?.optimizeSelectedPath;

    if (optimizeSelectedPath ? !canRunTraversalOptimizedBatch() : !canRunTraversalBatch()) {
      void vscode.window.showInformationMessage(
        optimizeSelectedPath
          ? "DV Quick Run: This optimization is a Pro capability."
          : "DV Quick Run: Running completed traversal as $batch is unavailable."
      );
      return;
    }

    const progress = getActiveTraversalProgress();
    const sessionId = String(request?.traversalSessionId ?? "").trim();

    if (!progress || !sessionId || !isActiveTraversalSession(sessionId)) {
      void vscode.window.showWarningMessage("DV Quick Run: This traversal session is no longer active.");
      return;
    }

    if (!progress.isCompleted) {
      void vscode.window.showWarningMessage("DV Quick Run: Complete the traversal first before running it as $batch.");
      return;
    }

    const queries = progress.itinerary.steps
      .flatMap((step, stepIndex) => {
        const selectedInput = getSelectedInputForStep(progress, stepIndex, step);
        const siblingExpandClause = progress.siblingExpandClausesByStep?.[stepIndex];
        const rebuiltPlan = buildStepExecutionPlan(
          progress.graph,
          progress.itinerary,
          step,
          selectedInput,
          1,
          siblingExpandClause
        );
        let rebuiltQueries = rebuiltPlan.queries
          .map((query) => query.queryPath.trim())
          .filter((query) => !!query && !query.includes("__RUNTIME_VALUE__"));

        if (optimizeSelectedPath && stepIndex < progress.itinerary.steps.length - 1 && (rebuiltPlan.mode === "direct" || rebuiltPlan.mode === "nested_expand") && rebuiltQueries.length === 1) {
          const tightenedFilter = buildOptimizedPreviousStepFilter(progress, step, stepIndex);
          if (tightenedFilter) {
            rebuiltQueries = [mergeFilterIntoQueryPath(rebuiltQueries[0]!, tightenedFilter)];
          }
        }

        if (rebuiltQueries.length === rebuiltPlan.queries.length && rebuiltQueries.length > 0) {
          return rebuiltQueries;
        }

        return (progress.executedQueriesByStep?.[stepIndex] ?? [])
          .map((query) => query.queryPath.trim())
          .filter((query) => !!query);
      })
      .filter((query, index, all) => all.indexOf(query) === index);

    if (queries.length < 2) {
      void vscode.window.showWarningMessage("DV Quick Run: Completed traversal did not produce enough concrete queries to run as $batch.");
      return;
    }

    await previewAndRunBatchQueries(ctx, queries, {
      previewTitle: optimizeSelectedPath
        ? `DV Quick Run: Execute ${queries.length} optimized selected-path queries as one $batch call?`
        : `DV Quick Run: Execute ${queries.length} completed traversal queries as one $batch call?`,
      traversalSessionId: progress.sessionId,
      canRunOptimizedBatch: !optimizeSelectedPath && canRunTraversalOptimizedBatch()
    });
  });
}
