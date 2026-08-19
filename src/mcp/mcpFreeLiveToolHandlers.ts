import { createDvqrMcpCapabilityPayload } from "./mcpCapabilityPayload.js";
import type { DvqrMcpFreeApplicationAdapter } from "./mcpFreeApplicationAdapter.js";
import type { DvqrLiveMcpFreeHandlerId } from "./mcpLiveToolCatalogue.js";
import type { DvqrMcpRuntimeConfiguration } from "./mcpRuntimeConfiguration.js";
import type { DvqrMcpFreeToolResult } from "./mcpToolResults.js";
import type { DvqrMcpToolResponse } from "./mcpToolResponseFormatter.js";

export type DvqrMcpFreeLiveHandler = (args: Record<string, unknown>) => Promise<DvqrMcpToolResponse>;

export interface DvqrMcpFreeLiveHandlerDependencies {
  readonly config: DvqrMcpRuntimeConfiguration;
  readonly adapter: DvqrMcpFreeApplicationAdapter;
  readonly format: (
    summary: string,
    structuredContent: Record<string, unknown>,
    isError?: boolean
  ) => DvqrMcpToolResponse;
  readonly formatFreeResult: (result: DvqrMcpFreeToolResult) => DvqrMcpToolResponse;
  readonly dispatchRelationshipQuery: (args: Record<string, unknown>) => Promise<DvqrMcpToolResponse>;
}

/**
 * Free live-tool routing is deliberately kept outside the main live dispatcher.
 * This prevents capability growth (including traversal/business-path tools) from
 * adding protocol-neutral handler wiring to the Pro investigation orchestrator.
 */
export function createDvqrMcpFreeLiveHandlers(
  deps: DvqrMcpFreeLiveHandlerDependencies
): Readonly<Record<DvqrLiveMcpFreeHandlerId, DvqrMcpFreeLiveHandler>> {
  const { adapter, config } = deps;
  return {
    listCapabilities: async () => deps.format(
      "DVQR local MCP is active. Free execution and understanding tools are available; Pro tools provide investigation acceleration.",
      createDvqrMcpCapabilityPayload(config.proEnabled)
    ),
    explainOData: async (args) => deps.formatFreeResult(adapter.explainOData(args)),
    executeOData: async (args) => deps.formatFreeResult(await adapter.executeOData(args)),
    searchMetadata: async (args) => deps.formatFreeResult(await adapter.searchMetadata(args)),
    getEntityMetadata: async (args) => deps.formatFreeResult(await adapter.getEntityMetadata(args)),
    getOperationalProfile: async (args) => deps.formatFreeResult(await adapter.getOperationalProfile(args)),
    discoverCustomApis: async (args) => deps.formatFreeResult(await adapter.discoverCustomApis(args)),
    getCustomApiDefinition: async (args) => deps.formatFreeResult(await adapter.getCustomApiDefinition(args)),
    explainCustomApi: async (args) => deps.formatFreeResult(await adapter.explainCustomApi(args)),
    compareCustomApis: async (args) => deps.formatFreeResult(await adapter.compareCustomApis(args)),
    recommendCustomApis: async (args) => deps.formatFreeResult(await adapter.recommendCustomApis(args)),
    recommendSolutionArchitecture: async (args) => deps.formatFreeResult(await adapter.recommendSolutionArchitecture(args)),
    checkCustomApiExecution: async (args) => deps.formatFreeResult(await adapter.checkCustomApiExecution(args)),
    previewCustomApiExecution: async (args) => deps.formatFreeResult(await adapter.previewCustomApiExecution(args)),
    executeCustomApi: async (args) => deps.formatFreeResult(await adapter.executeCustomApi(args)),
    interpretCustomApiExecution: async (args) => deps.formatFreeResult(adapter.interpretCustomApiExecution(args)),
    discoverOperationalAnchors: async (args) => deps.formatFreeResult(await adapter.discoverOperationalAnchors(args)),
    resolveNavigationProperty: async (args) => deps.formatFreeResult(await adapter.resolveNavigationProperty(args)),
    findRelationshipPaths: async (args) => deps.formatFreeResult(await adapter.findRelationshipPaths(args)),
    discoverBusinessPaths: async (args) => deps.formatFreeResult(await adapter.discoverBusinessPaths(args)),
    validateBusinessPaths: async (args) => deps.formatFreeResult(await adapter.validateBusinessPaths(args)),
    listBusinessPaths: async (args) => deps.formatFreeResult(await adapter.listBusinessPaths(args)),
    getBusinessPath: async (args) => deps.formatFreeResult(await adapter.getBusinessPath(args)),
    saveBusinessPath: async (args) => deps.formatFreeResult(await adapter.saveBusinessPath(args)),
    deleteBusinessPath: async (args) => deps.formatFreeResult(await adapter.deleteBusinessPath(args)),
    revalidateBusinessPath: async (args) => deps.formatFreeResult(await adapter.revalidateBusinessPath(args)),
    testBusinessPath: async (args) => deps.formatFreeResult(await adapter.testBusinessPath(args)),
    generateRelationshipQuery: async (args) => deps.dispatchRelationshipQuery(args),
    probeRelationshipPath: async (args) => deps.formatFreeResult(await adapter.probeRelationshipPath(args)),
    explainLookup: async (args) => deps.formatFreeResult(await adapter.explainLookup(args))
  };
}
