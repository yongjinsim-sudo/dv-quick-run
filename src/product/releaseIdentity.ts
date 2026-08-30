import * as fs from "fs";
import * as path from "path";

/**
 * Source fallback used only when package metadata cannot be read.
 * The packaged extension's package.json remains the runtime release authority,
 * so beta/pre-release VSIX identities are reported exactly as packaged.
 */
export const DVQR_RELEASE_VERSION_FALLBACK = "0.16.2";

export function getDvqrReleaseVersion(): string {
  try {
    const packagePath = path.resolve(__dirname, "..", "..", "package.json");
    const parsed = JSON.parse(fs.readFileSync(packagePath, "utf8")) as { version?: unknown };
    const version = typeof parsed.version === "string" ? parsed.version.trim() : "";
    return version || DVQR_RELEASE_VERSION_FALLBACK;
  } catch {
    return DVQR_RELEASE_VERSION_FALLBACK;
  }
}
