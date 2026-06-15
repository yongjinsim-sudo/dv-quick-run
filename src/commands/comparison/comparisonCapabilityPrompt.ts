import { canRunCrossEnvironmentDiff } from "../../product/capabilities/capabilityResolver.js";
import { promptForProAccelerationAccess } from "../commercial/proPricingPrompt.js";

export async function promptForCrossEnvironmentDiffProAccess(surface: string): Promise<boolean> {
  if (canRunCrossEnvironmentDiff()) {
    return true;
  }

  return await promptForProAccelerationAccess(surface);
}
