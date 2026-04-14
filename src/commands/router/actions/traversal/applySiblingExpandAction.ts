import * as vscode from "vscode";
import type { CommandContext } from "../../../context/commandContext.js";
import { logInfo, logWarn } from "../../../../utils/logger.js";
import { runAction } from "../shared/actionRunner.js";
import { resolveSiblingExpandCandidates } from "../shared/expand/expandCandidateResolver.js";
import { buildSiblingExpandPlan } from "../shared/expand/expandPlanBuilder.js";
import { MAX_SIBLING_EXPANDS, validateCandidateForSiblingExpand } from "../shared/expand/expandPolicy.js";
import { applyExpand, parseExpandClause, type ExpandNode } from "../shared/expand/expandComposer.js";
import { loadEntityDefs, loadFields, findEntityByLogicalName } from "../shared/metadataAccess.js";
import { getSelectableFields } from "../shared/selectableFields.js";
import { getActiveTraversalProgress, isActiveTraversalSession, setActiveTraversalProgress } from "../shared/traversal/traversalProgressStore.js";
import { executeTraversalStep } from "../shared/traversal/traversalStepExecutor.js";
import { buildTraversalViewerContext } from "./traversalSessionHelpers.js";
import { getTraversalExplainVerbosity } from "./traversalExplainConfig.js";


type ExistingSiblingExpandSelection = {
  navigationPropertyName: string;
  selectedFieldLogicalNames: string[];
};

function toExistingSiblingExpandSelections(nodes: ExpandNode[]): ExistingSiblingExpandSelection[] {
  return nodes.map((node) => ({
    navigationPropertyName: node.relationship,
    selectedFieldLogicalNames: [...(node.select ?? [])]
  }));
}


export function buildMergedSiblingExpandClause(args: {
  currentEntityLogicalName: string;
  candidates: Array<{ sourceEntityLogicalName: string; navigationPropertyName: string; targetEntityLogicalName: string; displayLabel: string; relationshipType: string; isCollection: boolean }>;
  existingClause?: string;
  selectedFieldSets: Array<{ navigationPropertyName: string; selectedFieldLogicalNames: string[] }>;
}): string {
  const existingSelections = toExistingSiblingExpandSelections(parseExpandClause(args.existingClause));
  const plan = buildSiblingExpandPlan(
    args.currentEntityLogicalName,
    args.candidates,
    [...existingSelections, ...args.selectedFieldSets]
  );

  let mergedClause = args.existingClause ?? "";
  for (const entry of plan.entries) {
    mergedClause = applyExpand(mergedClause, {
      relationship: entry.navigationPropertyName,
      select: entry.selectedFieldLogicalNames
    });
  }

  return mergedClause;
}

export async function runApplySiblingExpandAction(
  ctx: CommandContext,
  request?: { traversalSessionId?: string }
): Promise<void> {
  await runAction(ctx, "DV Quick Run: Sibling expand failed. Check Output.", async () => {
    const progress = getActiveTraversalProgress();
    if (!progress) {
      logInfo(ctx.output, "No active traversal is available for sibling expand.");
      return;
    }

    if (request?.traversalSessionId && !isActiveTraversalSession(request.traversalSessionId)) {
      logWarn(ctx.output, "This traversal session is no longer active.");
      return;
    }

    const currentStep = progress.itinerary.steps[progress.currentStepIndex];
    if (!currentStep) {
      logWarn(ctx.output, "Could not determine the current traversal step.");
      return;
    }

    logInfo(ctx.output, `Sibling expand requested for leg ${progress.currentStepIndex + 1}: ${currentStep.stageLabel}`);
    if (progress.isCompleted) {
      logInfo(ctx.output, "Applying sibling expand to a completed traversal landing.");
    }

    const candidates = (await resolveSiblingExpandCandidates(ctx, currentStep.toEntity))
      .filter((candidate) => !validateCandidateForSiblingExpand(candidate));

    if (!candidates.length) {
      void vscode.window.showInformationMessage(`DV Quick Run: No sibling enrichments available for ${currentStep.toEntity}.`);
      return;
    }

    const pickedCandidates = await vscode.window.showQuickPick(
      candidates.map((candidate) => ({
        label: candidate.displayLabel,
        description: candidate.targetEntityLogicalName,
        detail: candidate.relationshipType,
        candidate
      })),
      {
        title: `DV Quick Run: Sibling Expand — ${currentStep.toEntity}`,
        placeHolder: `Pick up to ${MAX_SIBLING_EXPANDS} enrichments for the current leg`,
        canPickMany: true,
        ignoreFocusOut: true,
        matchOnDescription: true,
        matchOnDetail: true
      }
    );

    if (!pickedCandidates?.length) {
      return;
    }

    if (pickedCandidates.length > MAX_SIBLING_EXPANDS) {
      void vscode.window.showWarningMessage(`DV Quick Run: A maximum of ${MAX_SIBLING_EXPANDS} sibling expands are allowed.`);
      return;
    }

    const client = ctx.getClient();
    const token = await ctx.getToken(ctx.getScope());
    const defs = await loadEntityDefs(ctx, client, token);

    const selectedFieldSets = [] as Array<{ navigationPropertyName: string; selectedFieldLogicalNames: string[] }>;

    for (const picked of pickedCandidates) {
      const targetDef = findEntityByLogicalName(defs, picked.candidate.targetEntityLogicalName);
      if (!targetDef) {
        continue;
      }

      const targetFields = await loadFields(ctx, client, token, targetDef.logicalName);
      const selectable = getSelectableFields(targetFields);
      const fieldPick = await vscode.window.showQuickPick(
        selectable.map((field) => ({
          label: field.logicalName,
          description: field.attributeType || "",
          detail: `$select token: ${field.selectToken}`,
          token: String(field.selectToken)
        })),
        {
          title: `DV Quick Run: Sibling fields (${targetDef.entitySetName})`,
          placeHolder: `Pick fields for ${picked.candidate.navigationPropertyName}`,
          canPickMany: true,
          ignoreFocusOut: true,
          matchOnDescription: true,
          matchOnDetail: true
        }
      );

      if (!fieldPick?.length) {
        return;
      }

      selectedFieldSets.push({
        navigationPropertyName: picked.candidate.navigationPropertyName,
        selectedFieldLogicalNames: fieldPick.map((item) => item.token)
      });
    }

    const siblingExpandClause = buildMergedSiblingExpandClause({
      currentEntityLogicalName: currentStep.toEntity,
      candidates,
      existingClause:
        progress.siblingExpandClausesByStep?.[progress.currentStepIndex] ?? progress.currentStepSiblingExpandClause,
      selectedFieldSets
    });

    logInfo(ctx.output, `Sibling expand selected: ${siblingExpandClause}`);

    const landedNode = progress.graph.entities[currentStep.toEntity];
    const explainVerbosity = getTraversalExplainVerbosity();
    const execution = await executeTraversalStep(
      ctx,
      progress.graph,
      progress.itinerary,
      currentStep,
      progress.currentStepInput,
      progress.nextQuerySequenceNumber ?? 1,
      {
        traversalContext: buildTraversalViewerContext({
          sessionId: progress.sessionId,
          isBestMatchRoute: progress.isBestMatchRoute,
          itinerary: progress.itinerary,
          currentStepIndex: progress.currentStepIndex,
          currentEntityName: currentStep.toEntity,
          requiredCarryField: landedNode?.primaryIdAttribute,
          canSiblingExpand: candidates.length > 0,
          verbosity: explainVerbosity
        }),
        siblingExpandClause
      }
    );

    setActiveTraversalProgress({
      ...progress,
      lastLanding: execution.landing,
      currentStepSiblingExpandClause: siblingExpandClause,
      siblingExpandClausesByStep: {
        ...(progress.siblingExpandClausesByStep ?? {}),
        [progress.currentStepIndex]: siblingExpandClause
      },
      nextQuerySequenceNumber: (progress.nextQuerySequenceNumber ?? 1) + execution.executedQueryCount
    });
  });
}
