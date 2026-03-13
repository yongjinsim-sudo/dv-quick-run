import * as vscode from "vscode";
import type { CommandContext } from "../../../../context/commandContext.js";
import type { DataverseClient } from "../../../../../services/dataverseClient.js";
import { logDebug, logInfo } from "../../../../../utils/logger.js";
import { loadEntityDefs, findEntityByEntitySetName } from "../metadataAccess.js";
import { parseEditorQuery, buildEditorQuery, getEntitySetNameFromEditorQuery, type ParsedEditorQuery } from "./parsedEditorQuery.js";
import { applyEditorQueryUpdate } from "./applyEditorQueryUpdate.js";
import { resolveEditorQuery } from "../../../../../shared/editorIntelligence/queryCursorResolver.js";
import type { EditorQueryTarget } from "./editorQueryTarget.js";
import type { EntityDef } from "../../../../../utils/entitySetCache.js";
import { runAction } from "../actionRunner.js";

type ResolveEntitySetError = (targetText: string) => Error | undefined;

export type QueryMutationActionContext = {
  target: EditorQueryTarget;
  parsed: ParsedEditorQuery;
  entitySetName: string;
  token: string;
  client: DataverseClient;
  defs: EntityDef[];
  entityDef: EntityDef;
};

export async function runQueryMutationAction(
  ctx: CommandContext,
  actionLabel: string,
  successMessage: string,
  mutate: (args: QueryMutationActionContext) => Promise<boolean | void>,
  resolveEntitySetError?: ResolveEntitySetError
): Promise<void> {
  await runAction(ctx, `DV Quick Run: ${actionLabel} failed. Check Output.`, async () => {
    const target = resolveEditorQuery();
    const parsed = parseEditorQuery(target.text);

    const entitySetName = getEntitySetNameFromEditorQuery(parsed.entityPath);
    if (!entitySetName) {
      const customError = resolveEntitySetError?.(target.text);
      throw customError ?? new Error(`Could not detect entity set name from: ${target.text}`);
    }

    const token = await ctx.getToken(ctx.getScope());
    const client: DataverseClient = ctx.getClient();

    const defs = await loadEntityDefs(ctx, client, token);
    const entityDef = findEntityByEntitySetName(defs, entitySetName);
    if (!entityDef) {
      throw new Error(`Could not find metadata for entity set: ${entitySetName}`);
    }

    const shouldApply = await mutate({
      target,
      parsed,
      entitySetName,
      token,
      client,
      defs,
      entityDef
    });

    if (shouldApply === false) {
      return;
    }

    const updated = buildEditorQuery(parsed);
    await applyEditorQueryUpdate(target, updated);

    logInfo(ctx.output, `${actionLabel}: query updated.`);
    logDebug(ctx.output, `${actionLabel}: ${target.text} -> ${updated}`);
    vscode.window.showInformationMessage(successMessage);
  });
}
