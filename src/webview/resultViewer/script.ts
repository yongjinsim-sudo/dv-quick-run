import { RESULT_VIEWER_SCRIPT_BOOTSTRAP } from "./scriptBootstrap.js";
import { RESULT_VIEWER_SCRIPT_INTERACTION_HANDLERS } from "./scriptInteractionHandlers.js";
import { RESULT_VIEWER_SCRIPT_MESSAGE_BRIDGE } from "./scriptMessageBridge.js";
import { RESULT_VIEWER_SCRIPT_RENDERERS } from "./scriptRenderers.js";
import { RESULT_VIEWER_SCRIPT_UTILITIES } from "./scriptUtilities.js";

export function getResultViewerScript(initialModelJson: string): string {
    return `
${RESULT_VIEWER_SCRIPT_BOOTSTRAP.replace("__INITIAL_MODEL_JSON__", initialModelJson)}
${RESULT_VIEWER_SCRIPT_RENDERERS}
${RESULT_VIEWER_SCRIPT_INTERACTION_HANDLERS}
${RESULT_VIEWER_SCRIPT_MESSAGE_BRIDGE}
${RESULT_VIEWER_SCRIPT_UTILITIES}
    `;
}
