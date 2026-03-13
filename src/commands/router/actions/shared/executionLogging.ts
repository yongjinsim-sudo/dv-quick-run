import { logInfo } from "../../../../utils/logger.js";

export function logDataverseExecutionStart(
  output: any,
  envName: string,
  verb: string,
  path: string
) {
  logInfo(output, `[DV:${envName}] ${verb} ${path.replace(/^\//, "")}`);
}

export function logDataverseExecutionResult(
  output: any,
  recordCount: number,
  durationMs: number
) {
  logInfo(
    output,
    `→ ${recordCount} record${recordCount === 1 ? "" : "s"} returned (${durationMs}ms)`
  );
}