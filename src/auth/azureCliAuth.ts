import { exec, execFile } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

function isWindows(): boolean {
  return process.platform === "win32";
}

async function resolveAzureCliPath(): Promise<string> {
  if (!isWindows()) {
    return "az";
  }

  // 1. Try PATH lookup first
  try {
    const { stdout } = await execAsync("where az");
    const matches = stdout
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);

    // Prefer cmd/exe if available
    const preferred =
      matches.find(p => /az\.cmd$/i.test(p)) ??
      matches.find(p => /az\.exe$/i.test(p)) ??
      matches[0];

    if (preferred) {
      return preferred;
    }
  } catch {
    // ignore and continue to fallback paths
  }

  // 2. Common Windows fallback locations
  const fallbackPaths = [
    String.raw`C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd`,
    String.raw`C:\Program Files (x86)\Microsoft SDKs\Azure\CLI2\wbin\az.cmd`
  ];

  for (const p of fallbackPaths) {
    try {
      await execFileAsync("cmd", ["/c", "if", "exist", p, "echo", "found"]);
      return p;
    } catch {
      // continue
    }
  }

  throw new Error(
    "Azure CLI was not found. Please install Azure CLI or ensure 'az' is available in PATH."
  );
}

export async function getAzureCliAccessToken(
  scope: string,
  tenantId?: string
): Promise<string> {
  const azPath = await resolveAzureCliPath();

  const args = [
    "account",
    "get-access-token",
    "--scope",
    scope,
    "-o",
    "json"
  ];

  if (tenantId?.trim()) {
    args.push("--tenant", tenantId.trim());
  }

  try {
    const result = isWindows() && azPath.toLowerCase().endsWith(".cmd")
      ? await execAsync(
          `"${azPath}" ${args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(" ")}`
        )
      : await execFileAsync(azPath, args);

    const raw = result.stdout?.toString().trim();
    if (!raw) {
      throw new Error("Azure CLI returned an empty response.");
    }

    const parsed = JSON.parse(raw);
    const token = parsed.accessToken as string | undefined;

    if (!token) {
      throw new Error("Azure CLI response did not contain accessToken.");
    }

    return token;
  } catch (err: any) {
    const stderr = err?.stderr?.toString?.() ?? "";
    const stdout = err?.stdout?.toString?.() ?? "";
    const message = err?.message ?? String(err);

    throw new Error(
      [
        "Azure CLI authentication failed.",
        `Command: ${azPath} ${args.join(" ")}`,
        stderr ? `STDERR: ${stderr}` : "",
        stdout ? `STDOUT: ${stdout}` : "",
        message ? `ERROR: ${message}` : ""
      ]
        .filter(Boolean)
        .join("\n")
    );
  }
}

export async function getDataverseAccessToken(
  scope: string,
  tenantId?: string
): Promise<string> {
  return getAzureCliAccessToken(scope, tenantId);
}