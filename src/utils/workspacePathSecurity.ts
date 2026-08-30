import * as fs from "fs";
import * as path from "path";

function isWithin(base: string, target: string): boolean {
  const relative = path.relative(base, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/**
 * Assert that a DVQR-managed filesystem target remains inside the bound workspace,
 * including after resolving existing symlink/junction components.
 *
 * The workspace root itself is trusted server-owned binding state. Content/model
 * input may never choose a path outside it or redirect a managed subdirectory
 * through an existing filesystem link.
 */
export function assertWorkspaceContainedPath(workspaceRoot: string, targetPath: string): void {
  const lexicalWorkspace = path.resolve(workspaceRoot);
  const lexicalTarget = path.resolve(targetPath);

  if (!isWithin(lexicalWorkspace, lexicalTarget)) {
    throw new Error("DVQR refused a filesystem path outside the bound workspace.");
  }

  if (!fs.existsSync(lexicalWorkspace)) {
    throw new Error("DVQR workspace root does not exist.");
  }

  const realWorkspace = fs.realpathSync.native(lexicalWorkspace);

  // Resolve the nearest existing ancestor. If a managed directory component was
  // replaced by a symlink/junction, realpath exposes the escape before a write.
  let existing = lexicalTarget;
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) {
      break;
    }
    existing = parent;
  }

  if (fs.existsSync(existing)) {
    const realExisting = fs.realpathSync.native(existing);
    if (!isWithin(realWorkspace, realExisting)) {
      throw new Error("DVQR refused a workspace path redirected outside the bound workspace.");
    }
  }
}
