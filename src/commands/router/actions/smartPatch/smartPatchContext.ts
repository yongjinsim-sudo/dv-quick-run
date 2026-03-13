import { CommandContext } from "../../../context/commandContext.js";
import { DataverseClient } from "../../../../services/dataverseClient.js";
import { SmartMetadataSession } from "../smart/shared/smartMetadataSession.js";

export type SmartPatchRuntimeContext = {
  baseUrl: string;
  scope: string;
  token: string;
  client: DataverseClient;
  session: SmartMetadataSession;
};

export async function initSmartPatchContext(ctx: CommandContext): Promise<SmartPatchRuntimeContext> {
  const baseUrl = await ctx.getBaseUrl();
  const scope = ctx.getScope();
  const token = await ctx.getToken(scope);
  const client = ctx.getClient();
  const session = new SmartMetadataSession(ctx, client, token);

  return { baseUrl, scope, token, client, session };
}
