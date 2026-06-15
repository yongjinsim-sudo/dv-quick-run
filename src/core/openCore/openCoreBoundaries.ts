export type OpenCoreLayer = "core" | "pro" | "team" | "enterprise" | "internal";

export interface OpenCoreBoundaryRule {
  readonly sourceLayer: OpenCoreLayer;
  readonly forbiddenImports: readonly OpenCoreLayer[];
  readonly reason: string;
}

export const openCoreBoundaryRules: readonly OpenCoreBoundaryRule[] = [
  {
    sourceLayer: "core",
    forbiddenImports: ["pro", "team", "enterprise", "internal"],
    reason: "Core owns operational understanding and shared contracts; it must never depend on proprietary or private acceleration layers."
  },
  {
    sourceLayer: "pro",
    forbiddenImports: ["team", "enterprise", "internal"],
    reason: "Pro owns commercial acceleration and must remain independent from future Team/Enterprise/private implementation layers."
  },
  {
    sourceLayer: "team",
    forbiddenImports: ["enterprise", "internal"],
    reason: "Future Team capabilities must not couple to Enterprise or private implementation layers."
  },
  {
    sourceLayer: "enterprise",
    forbiddenImports: ["internal"],
    reason: "Future Enterprise capabilities must not couple runtime behaviour to private tooling."
  }
];

export function describeOpenCoreBoundary(): string {
  return "Core owns understanding. Pro owns acceleration. Internal tooling never ships.";
}
