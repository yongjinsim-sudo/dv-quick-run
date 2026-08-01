import { McpRelationshipMetadataRepository } from "./mcpRelationshipMetadataRepository.js";
import { McpRelationshipProbeService } from "./mcpRelationshipProbeService.js";
import { McpOperationalAnchorApplicationService } from "./mcpOperationalAnchorApplicationService.js";
import { McpLookupNavigationApplicationService } from "./mcpLookupNavigationApplicationService.js";
import { McpRelationshipPathDiscoveryApplicationService } from "./mcpRelationshipPathDiscoveryApplicationService.js";
import { McpRelationshipQueryApplicationService } from "./mcpRelationshipQueryApplicationService.js";
import { McpRelationshipTraversalApplicationService } from "./mcpRelationshipTraversalApplicationService.js";
import type { DvqrMcpRuntimeConfiguration } from "./mcpRuntimeConfiguration.js";
import type { DvqrMcpFreeToolResult } from "./mcpToolResults.js";

export class McpRelationshipApplicationService {
  private readonly operationalAnchors: McpOperationalAnchorApplicationService;
  private readonly lookupNavigation: McpLookupNavigationApplicationService;
  private readonly pathDiscovery: McpRelationshipPathDiscoveryApplicationService;
  private readonly queryGeneration: McpRelationshipQueryApplicationService;
  private readonly traversal: McpRelationshipTraversalApplicationService;

  public constructor(config: DvqrMcpRuntimeConfiguration) {
    const metadata = new McpRelationshipMetadataRepository(config);
    const probes = new McpRelationshipProbeService(config, metadata);
    this.operationalAnchors = new McpOperationalAnchorApplicationService(metadata);
    this.lookupNavigation = new McpLookupNavigationApplicationService(config, metadata);
    this.pathDiscovery = new McpRelationshipPathDiscoveryApplicationService(metadata);
    this.queryGeneration = new McpRelationshipQueryApplicationService(metadata);
    this.traversal = new McpRelationshipTraversalApplicationService(metadata, probes);
  }

  public async discoverOperationalAnchors(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    return this.operationalAnchors.discoverOperationalAnchors(args);
  }

  public async resolveNavigationProperty(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    return this.lookupNavigation.resolveNavigationProperty(args);
  }

  public async findRelationshipPaths(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    return this.pathDiscovery.findRelationshipPaths(args);
  }

  public async generateRelationshipQuery(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    return this.queryGeneration.generateRelationshipQuery(args);
  }

  public async probeRelationshipPath(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    return this.traversal.probeRelationshipPath(args);
  }

  public async explainLookup(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    return this.lookupNavigation.explainLookup(args);
  }
}
