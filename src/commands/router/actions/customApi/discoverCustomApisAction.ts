import { CommandContext } from "../../../context/commandContext.js";
import { CustomApiDiscoveryService } from "../../../../customApi/discovery/customApiDiscoveryService.js";
import { buildCustomApiCatalogueResult } from "../../../../customApi/viewModels/customApiCatalogueViewModelBuilder.js";
import { ResultViewerPanel } from "../../../../providers/resultViewerPanel.js";
import { buildResultViewerModel } from "../../../../services/resultViewModelBuilder.js";
import { logDataverseExecutionResult, logDataverseExecutionStart } from "../shared/executionLogging.js";
import { runAction } from "../shared/actionRunner.js";

const CUSTOM_API_CATALOGUE_QUERY_LABEL = "Custom API Discovery";

export async function runDiscoverCustomApisAction(ctx: CommandContext): Promise<void> {
  await runAction(ctx, "DV Quick Run: Discover Custom APIs failed. Check Output.", async () => {
    const scope = ctx.getScope();
    const token = await ctx.getToken(scope);
    const client = ctx.getClient();
    const environmentName = ctx.envContext.getEnvironmentName();
    const startedAt = Date.now();

    logDataverseExecutionStart(ctx.output, environmentName, "GET", CUSTOM_API_CATALOGUE_QUERY_LABEL);

    const discoveryService = new CustomApiDiscoveryService(ctx, client, token);
    const definitions = await discoveryService.discoverCustomApis();
    const catalogueResult = buildCustomApiCatalogueResult(definitions);
    const activeEnvironment = ctx.envContext.getActiveEnvironment();
    const model = buildResultViewerModel(catalogueResult, CUSTOM_API_CATALOGUE_QUERY_LABEL, {
      environment: activeEnvironment
        ? {
          name: activeEnvironment.name,
          colorHint: activeEnvironment.statusBarColor ?? "white"
        }
        : undefined
    });

    model.title = `Custom API Discovery (${definitions.length} APIs)`;
    ResultViewerPanel.show(ctx, model);

    logDataverseExecutionResult(ctx.output, definitions.length, Date.now() - startedAt);
  });
}
