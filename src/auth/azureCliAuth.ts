// src/auth/azureCliAuth.ts

import { exec } from "child_process";

const AZ_PATH = `"C:\\Program Files (x86)\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.cmd"`;

/**
 * Execute an Azure CLI command
 */
function execAz(command: string): Promise<string> {
  return new Promise((resolve, reject) => {

    exec(command, { windowsHide: true }, (err, stdout, stderr) => {

      if (err) {
        reject(
          new Error(
            `Azure CLI failed.\n` +
            `Command: ${command}\n` +
            `STDERR:\n${stderr}\n` +
            `STDOUT:\n${stdout}`
          )
        );
        return;
      }

      resolve(stdout);

    });

  });
}

/**
 * Try get access token
 */
async function tryGetToken(scope: string): Promise<string> {

  const command =
    `${AZ_PATH} account get-access-token --scope ${scope} -o json`;

  const stdout = await execAz(command);

  const parsed = JSON.parse(stdout);

  if (!parsed.accessToken) {
    throw new Error(`Azure CLI returned no accessToken.\nOutput:\n${stdout}`);
  }

  return parsed.accessToken;

}

/**
 * Detect MFA / login required
 */
function isInteractionRequired(msg: string): boolean {

  return (
    msg.includes("AADSTS50079") ||
    msg.includes("AADSTS50158") ||
    msg.includes("Status_InteractionRequired") ||
    msg.includes("Please run 'az login'")
  );

}

/**
 * Main token function
 */
export async function getDataverseAccessToken(
  scope: string,
  tenantId?: string
): Promise<string> {

  try {

    return await tryGetToken(scope);

  } catch (e: any) {

    const msg = e?.message ?? String(e);

    if (!isInteractionRequired(msg)) {
      throw e;
    }

    // interactive login

    let loginCommand =
      `${AZ_PATH} login --allow-no-subscriptions --scope ${scope}`;

    if (tenantId) {
      loginCommand =
        `${AZ_PATH} login --tenant ${tenantId} --allow-no-subscriptions --scope ${scope}`;
    }

    await execAz(loginCommand);

    return await tryGetToken(scope);

  }

}