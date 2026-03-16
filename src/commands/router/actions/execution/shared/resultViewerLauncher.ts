import type { CommandContext } from "../../../../context/commandContext.js";
import { ResultViewerPanel } from "../../../../../providers/resultViewerPanel.js";
import { buildResultViewerModel } from "../../../../../services/resultViewModelBuilder.js";
import { loadEntityDefByEntitySetName } from "../../shared/metadataAccess.js";

export async function showResultViewerForQuery(
    ctx: CommandContext,
    result: unknown,
    path: string
): Promise<void> {
    const client = ctx.getClient();
    const token = await ctx.getToken(ctx.getScope());

    const entitySetName = getEntitySetNameFromPath(path);

    const entityDef = entitySetName
        ? await loadEntityDefByEntitySetName(ctx, client, token, entitySetName)
        : undefined;

    const model = buildResultViewerModel(result, path, {
        entitySetName: entityDef?.entitySetName ?? entitySetName,
        primaryIdField: entityDef?.primaryIdAttribute
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