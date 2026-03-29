import type { CommandContext } from "../../../../context/commandContext.js";
import { ResultViewerPanel } from "../../../../../providers/resultViewerPanel.js";
import {
    buildResultViewerModel,
    type ResultViewerTraversalContext
} from "../../../../../services/resultViewModelBuilder.js";
import {
    loadChoiceMetadata,
    loadEntityDefByEntitySetName,
    loadFields
} from "../../shared/metadataAccess.js";

export type ResultViewerLaunchOptions = {
    traversalContext?: ResultViewerTraversalContext;
};

export async function showResultViewerForQuery(
    ctx: CommandContext,
    result: unknown,
    path: string,
    options?: ResultViewerLaunchOptions
): Promise<void> {
    const client = ctx.getClient();
    const token = await ctx.getToken(ctx.getScope());

    const entitySetName = getEntitySetNameFromPath(path);

    const entityDef = entitySetName
        ? await loadEntityDefByEntitySetName(ctx, client, token, entitySetName)
        : undefined;

    const fields = entityDef?.logicalName
        ? await loadFields(ctx, client, token, entityDef.logicalName, { silent: true })
        : [];

    const choiceMetadata = entityDef?.logicalName
        ? await loadChoiceMetadata(ctx, client, token, entityDef.logicalName, { silent: true })
        : [];

    const activeEnvironment = ctx.envContext.getActiveEnvironment();

    const model = buildResultViewerModel(result, path, {
        entitySetName: entityDef?.entitySetName ?? entitySetName,
        entityLogicalName: entityDef?.logicalName,
        primaryIdField: entityDef?.primaryIdAttribute,
        fields,
        choiceMetadata,
        traversalContext: options?.traversalContext,
        environment: activeEnvironment
            ? {
                name: activeEnvironment.name,
                colorHint: activeEnvironment.statusBarColor ?? "white"
            }
            : undefined
    });

    ResultViewerPanel.show(ctx, model);
}

function getEntitySetNameFromPath(path: string): string | undefined {
    const normalizedPath = path.trim();

    if (!normalizedPath) {
        return undefined;
    }

    const beforeQuery = normalizedPath.split("?")[0] ?? "";
    const beforeRecord = beforeQuery.split("(")[0] ?? "";
    const entitySetName = beforeRecord.replace(/^\/+/, "").trim();

    return entitySetName || undefined;
}