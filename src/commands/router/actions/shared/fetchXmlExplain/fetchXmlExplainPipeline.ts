import type { CommandContext } from '../../../../context/commandContext.js';
import { buildFetchXmlDiagnostics } from './fetchXmlDiagnostics.js';
import { buildFetchXmlExplainModel } from './fetchXmlExplainModelBuilder.js';
import { enrichFetchXmlTree } from './fetchXmlMetadataEnricher.js';
import { narrateFetchXmlExplain } from './fetchXmlNarrator.js';
import { parseFetchXml } from './fetchXmlParser.js';
import { resolveFetchXmlScopes } from './fetchXmlScopeResolver.js';

export async function runFetchXmlExplainPipeline(
  ctx: CommandContext,
  fetchXmlText: string
): Promise<string> {
  const document = parseFetchXml(fetchXmlText);
  const resolved = resolveFetchXmlScopes(document);
  const enriched = await enrichFetchXmlTree(ctx, resolved);
  const model = buildFetchXmlExplainModel(enriched);
  const { diagnostics, suggestions } = buildFetchXmlDiagnostics(enriched);

  model.diagnostics = diagnostics;
  model.suggestions = suggestions;

  return narrateFetchXmlExplain(document, model, fetchXmlText);
}
