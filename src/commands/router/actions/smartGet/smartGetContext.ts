import { CommandContext } from "../../../context/commandContext.js";
import { DataverseClient } from "../../../../services/dataverseClient.js";
import { SmartMetadataSession } from "../smart/shared/smartMetadataSession.js";

export type SmartGetRuntimeContext = {
  token: string;
  client: DataverseClient;
  session: SmartMetadataSession;
};

export async function initSmartGetContext(ctx: CommandContext): Promise<SmartGetRuntimeContext> {
  const baseUrl = await ctx.getBaseUrl();
  void baseUrl;
  const scope = ctx.getScope();
  const token = await ctx.getToken(scope);
  const client = ctx.getClient();
  const session = new SmartMetadataSession(ctx, client, token);

  return { token, client, session };
}
