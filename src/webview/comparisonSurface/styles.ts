import { baseStyles } from "./styleFragments/baseStyles.js";
import { searchAndDriftStyles } from "./styleFragments/searchAndDriftStyles.js";
import { investigationSessionStyles } from "./styleFragments/investigationSessionStyles.js";
import { workspaceModeStyles } from "./styleFragments/workspaceModeStyles.js";
import { workspaceRefinementStyles } from "./styleFragments/workspaceRefinementStyles.js";
import { communityFooterStyles } from "./styleFragments/communityFooterStyles.js";

export function getComparisonSurfaceStyles(): string {
  return [
    baseStyles,
    searchAndDriftStyles,
    investigationSessionStyles,
    workspaceModeStyles,
    workspaceRefinementStyles,
    communityFooterStyles
  ].join("");
}
