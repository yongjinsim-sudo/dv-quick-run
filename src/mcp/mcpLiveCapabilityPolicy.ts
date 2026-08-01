import type { DvqrLiveMcpToolDefinition } from "./mcpLiveToolCatalogue.js";

export type DvqrMcpCapabilityAvailability = "available" | "capability_required";

export interface DvqrMcpCapabilityProjection {
  readonly name: string;
  readonly title: string;
  readonly tier: "free" | "pro";
  readonly description: string;
  readonly availability: DvqrMcpCapabilityAvailability;
}

export interface DvqrMcpCapabilityDecision {
  readonly allowed: boolean;
  readonly availability: DvqrMcpCapabilityAvailability;
}

export const DVQR_MCP_COMMERCIAL_BOUNDARY = {
  free: "Execute, query, inspect, explain and understand.",
  pro: "Correlate, derive, prioritise, recommend and investigate."
} as const;

export class DvqrMcpLiveCapabilityPolicy {
  public constructor(private readonly proEnabled: boolean) {}

  public decide(tool: DvqrLiveMcpToolDefinition): DvqrMcpCapabilityDecision {
    const allowed = tool.tier === "free" || this.proEnabled;
    return {
      allowed,
      availability: allowed ? "available" : "capability_required"
    };
  }

  public project(tool: DvqrLiveMcpToolDefinition): DvqrMcpCapabilityProjection {
    return {
      name: tool.name,
      title: tool.title,
      tier: tool.tier,
      description: tool.description,
      availability: this.decide(tool).availability
    };
  }

  public projectAll(tools: readonly DvqrLiveMcpToolDefinition[]): readonly DvqrMcpCapabilityProjection[] {
    return tools.map((tool) => this.project(tool));
  }

  public capabilityRequiredPayload(tool: DvqrLiveMcpToolDefinition) {
    return {
      status: "capability_required",
      capability: tool.name,
      availableIn: tool.tier,
      preview: [
        "Deterministic investigation readiness",
        "Evidence-gap derivation",
        "Evidence-linked recommendations"
      ]
    } as const;
  }
}
