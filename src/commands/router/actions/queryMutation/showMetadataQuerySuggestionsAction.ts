import * as vscode from "vscode";
import type { CommandContext } from "../../../context/commandContext.js";
import { buildQuerySemanticModel } from "../../../../core/query/querySemanticModel.js";
import {
  buildLookupDiscoveryActions,
  buildMetadataQueryDiagnostics,
  type MetadataSuggestedQuery
} from "../../../../core/queryDoctor/metadataQueryDiagnostics.js";
import {
  isMultiTargetLookup,
  type LookupUnderstanding,
  type QueryMetadataContext
} from "../../../../core/metadata/lookupUnderstanding.js";
import { buildMetadataQueryRecommendations } from "../../../../core/recommendations/metadataRecommendationEngine.js";
import { canApplyActionableInsight } from "../../../../product/capabilities/capabilityResolver.js";
import { previewMutationResult } from "../../../../refinement/queryPreview.js";
import { parseDataverseQuery } from "../explain/explainQueryParser.js";
import { tryResolveEntity } from "../explain/explainQueryRuntime.js";
import {
  resolveLookupTargetDisplayMetadata,
  resolveQueryMetadataContext
} from "../shared/metadataContextResolver.js";
import { getLogicalEditorQueryTarget } from "../shared/queryMutation/editorQueryTarget.js";

type SuggestionItem = vscode.QuickPickItem & {
  actionType: "query";
  suggestion: MetadataSuggestedQuery;
  diagnosticTitle: string;
  lookup?: LookupUnderstanding;
};

type CopyReferenceItem = vscode.QuickPickItem & {
  actionType: "copyReference";
  referenceText: string;
  lookupDisplayName: string;
};

type MetadataActionItem = SuggestionItem | CopyReferenceItem;

type LookupItem = vscode.QuickPickItem & {
  lookup: LookupUnderstanding;
};

function lookupDisplayName(lookup: LookupUnderstanding): string {
  return lookup.displayName ?? lookup.attributeLogicalName;
}

function targetDisplayName(target: LookupUnderstanding["targetEntities"][number]): string {
  return target.displayName && target.displayName.toLowerCase() !== target.entityLogicalName.toLowerCase()
    ? `${target.displayName} (${target.entityLogicalName})`
    : target.entityLogicalName;
}

function orderedLookupCandidates(metadata: QueryMetadataContext): LookupUnderstanding[] {
  return [...metadata.lookupUnderstandings].sort((left, right) => {
    const kindOrder = Number(isMultiTargetLookup(right)) - Number(isMultiTargetLookup(left));
    return kindOrder || lookupDisplayName(left).localeCompare(lookupDisplayName(right));
  });
}

async function pickUnreferencedLookup(metadata: QueryMetadataContext): Promise<LookupUnderstanding | undefined> {
  const lookups = orderedLookupCandidates(metadata);
  if (!lookups.length) {
    await vscode.window.showInformationMessage(
      `DV Quick Run: No query-expandable lookup attributes were found for ${metadata.entityLogicalName}.`
    );
    return undefined;
  }

  const items: LookupItem[] = lookups.map((lookup) => ({
    label: lookupDisplayName(lookup),
    description: `${lookup.attributeLogicalName} • ${isMultiTargetLookup(lookup) ? "Multi-target" : "Single-target"}`,
    detail: `Add ${lookup.lookupValueProperty} • Targets: ${lookup.targetEntities.map(targetDisplayName).join(", ")}`,
    lookup
  }));

  const picked = await vscode.window.showQuickPick(items, {
    title: `DV Quick Run – Choose a lookup for ${metadata.entityLogicalName}`,
    placeHolder: "No lookup is referenced yet. Choose one to add or expand.",
    ignoreFocusOut: true,
    matchOnDescription: true,
    matchOnDetail: true
  });
  return picked?.lookup;
}

async function buildDiscoveryItems(
  ctx: CommandContext,
  source: string,
  metadata: QueryMetadataContext
): Promise<MetadataActionItem[] | undefined> {
  const selectedLookup = await pickUnreferencedLookup(metadata);
  if (!selectedLookup) {
    return undefined;
  }

  const lookup = await resolveLookupTargetDisplayMetadata(ctx, selectedLookup);
  const displayName = lookupDisplayName(lookup);
  const actions = buildLookupDiscoveryActions(source, lookup);
  const suggestions = actions
    .filter((action) => action.actionType === "query")
    .map((action, index): SuggestionItem => ({
    actionType: "query",
    label: action.suggestion.label,
    description: action.suggestion.targetEntityLogicalName
      ? `Target: ${action.suggestion.targetEntityLogicalName}`
      : "Identifier only",
    detail: index === 0
      ? `Add ${lookup.lookupValueProperty} to $select without expanding a target.`
      : `Add ${lookup.lookupValueProperty} and the metadata-valid target navigation property.`,
    suggestion: action.suggestion,
    diagnosticTitle: `Add ${displayName} lookup intelligence`,
    lookup
  }));
  const copyReference = actions.find((action) => action.actionType === "copyReference");

  return [
    ...suggestions,
    {
      actionType: "copyReference",
      label: "Copy lookup reference",
      description: "Clipboard only — do not modify the editor",
      detail: `Copy ${lookup.lookupValueProperty}, metadata-valid targets, navigation properties, annotations, and limitations.`,
      referenceText: copyReference?.referenceText ?? "",
      lookupDisplayName: displayName
    }
  ];
}

async function resolveSuggestionContext(ctx: CommandContext, forceRefresh = false) {
  const target = getLogicalEditorQueryTarget();
  const parsed = parseDataverseQuery(target.text);
  if (!parsed.entitySetName) {
    throw new Error("Could not detect an entity set in the current query.");
  }
  const entity = await tryResolveEntity(ctx, parsed.entitySetName);
  if (!entity) {
    throw new Error(`Could not resolve entity metadata for \`${parsed.entitySetName}\` in the active environment.`);
  }
  const model = buildQuerySemanticModel(parsed);
  const metadata = await resolveQueryMetadataContext(ctx, model, entity, { forceRefresh });
  return { target, model, metadata };
}

export async function runShowMetadataQuerySuggestionsAction(ctx: CommandContext): Promise<void> {
  const { target, model, metadata } = await resolveSuggestionContext(ctx);
  const diagnostics = buildMetadataQueryDiagnostics(model, metadata);
  const recommendations = buildMetadataQueryRecommendations(diagnostics);
  let items: MetadataActionItem[] = recommendations.flatMap((recommendation) =>
    recommendation.suggestedQueries.map((suggestion) => ({
      actionType: "query" as const,
      label: suggestion.label,
      description: suggestion.targetEntityLogicalName
        ? `Target: ${suggestion.targetEntityLogicalName}`
        : recommendation.action,
      detail: recommendation.reason,
      suggestion,
      diagnosticTitle: recommendation.action
    }))
  );

  if (
    !items.length
    && diagnostics.length === 0
    && metadata.state === "Resolved"
    && metadata.referencedLookups.length === 0
  ) {
    const discoveryItems = await buildDiscoveryItems(ctx, target.text, metadata);
    if (!discoveryItems) {
      return;
    }
    items = discoveryItems;
  }

  if (!items.length) {
    await vscode.window.showInformationMessage(
      metadata.state === "Resolved"
        ? "DV Quick Run: No deterministic metadata-aware query rewrite is needed."
        : "DV Quick Run: No deterministic rewrite is available. Refresh Metadata Context and try again."
    );
    return;
  }

  const picked = items.length === 1
    ? items[0]
    : await vscode.window.showQuickPick(items, {
      title: "DV Quick Run – Metadata-aware query suggestions",
      placeHolder: "Choose an identifier or target-specific query to preview",
      matchOnDescription: true,
      matchOnDetail: true
    });
  if (!picked) {
    return;
  }

  if (picked.actionType === "copyReference") {
    await vscode.env.clipboard.writeText(picked.referenceText);
    await vscode.window.showInformationMessage(
      `DV Quick Run: Copied lookup reference for ${picked.lookupDisplayName}.`
    );
    return;
  }

  await previewMutationResult(
    target,
    {
      originalQuery: target.text,
      updatedQuery: picked.suggestion.query,
      summary: picked.diagnosticTitle
    },
    {
      heading: "Metadata-aware query rewrite",
      title: picked.label,
      summary: picked.detail,
      sections: [
        { label: "Metadata environment", value: metadata.environmentLabel ?? "Active environment" },
        { label: "Metadata confidence", value: metadata.state },
        ...(picked.suggestion.targetEntityLogicalName
          ? [{ label: "Target table", value: picked.suggestion.targetEntityLogicalName }]
          : []),
        ...(picked.lookup?.limitations.length
          ? [{ label: "Lookup limitations", value: picked.lookup.limitations.join(" ") }]
          : [])
      ]
    },
    {
      mode: canApplyActionableInsight() ? "applyOrCopy" : "copy",
      applyButtonLabel: "Apply Suggested Query",
      copyButtonLabel: "Copy Suggested Query",
      cancelledMessage: "DV Quick Run: Suggestion cancelled. The query was not changed."
    }
  );
}

export async function runRefreshMetadataContextAction(ctx: CommandContext): Promise<void> {
  const { metadata } = await resolveSuggestionContext(ctx, true);
  await vscode.window.showInformationMessage(
    `DV Quick Run: Metadata context refreshed (${metadata.state}; ${metadata.lookupUnderstandings.length} lookups, ${metadata.knownNavigationProperties.length} navigation properties).`
  );
}
