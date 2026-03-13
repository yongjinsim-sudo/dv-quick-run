import { CommandContext } from "../../../context/commandContext.js";
import { DataverseClient } from "../../../../services/dataverseClient.js";
import { validateParsedQuery } from "../shared/queryExplain/queryValidation.js";
import { ParsedDataverseQuery } from "./explainQueryTypes.js";
import { tryResolveEntity } from "./explainQueryRuntime.js";

export interface ExplainQueryAnalysis {
  entity: Awaited<ReturnType<typeof tryResolveEntity>>;
  validationIssues: Awaited<ReturnType<typeof validateParsedQuery>>;
}

export async function analyseExplainQuery(
  ctx: CommandContext,
  parsed: ParsedDataverseQuery
): Promise<ExplainQueryAnalysis> {
  const entity = await tryResolveEntity(ctx, parsed.entitySetName);
  const scope = ctx.getScope();
  const token = await ctx.getToken(scope);
  const client: DataverseClient = ctx.getClient();
  const validationIssues = await validateParsedQuery(ctx, client, token, parsed, entity);

  return {
    entity,
    validationIssues
  };
}
