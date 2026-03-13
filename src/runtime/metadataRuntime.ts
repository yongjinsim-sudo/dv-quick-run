import { CommandContext } from "../commands/context/commandContext.js";
import { fetchEntityDefs } from "../services/entityMetadataService.js";
import { getCachedEntityDefs, setCachedEntityDefs } from "../utils/entitySetCache.js";
import { logDebug, logError } from "../utils/logger.js";

export async function prewarmEntityDefs(ctx: CommandContext): Promise<void> {
  try {
    const cached = getCachedEntityDefs(ctx.ext, ctx.envContext.getEnvironmentName());
    if (cached?.length) {
      logDebug(ctx.output, `DV Quick Run: Entity defs loaded from persisted cache (${cached.length}).`);
      return;
    }

    const scope = ctx.getScope();
    const token = await ctx.getToken(scope);
    const client = ctx.getClient();

    const defs = await fetchEntityDefs(client, token);

    if (defs?.length) {
      await setCachedEntityDefs(ctx.ext, ctx.envContext.getEnvironmentName(), defs);
      logDebug(ctx.output, `DV Quick Run: Entity defs fetched and cached (${defs.length}).`);
    }
  } catch (e: any) {
    logError(ctx.output, `DV Quick Run: Entity defs prewarm skipped: ${e?.message ?? String(e)}`);
  }
}

export function initializeMetadataRuntime(ctx: CommandContext): void {
  setTimeout(() => {
    void prewarmEntityDefs(ctx);
  }, 2000);
}
