import * as fs from "fs";
import * as path from "path";
import type {
  BusinessPathArtifact,
  BusinessPathRepository,
  BusinessPathRepositoryDiagnostic,
  BusinessPathRepositoryInspection
} from "../../core/businessPaths/index.js";
import {
  parseBusinessPathArtifact,
  serializeBusinessPathArtifact
} from "../../core/businessPaths/index.js";
import { assertWorkspaceContainedPath } from "../../utils/workspacePathSecurity.js";

const SAFE_BUSINESS_PATH_ID = /^bp_[0-9a-f]{8}$/;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeLogicalName(value: string): string {
  return value.trim().toLowerCase();
}

export function businessPathWorkspaceRoot(workspaceRoot: string): string {
  return path.join(path.resolve(workspaceRoot), ".dvforgelab", "dvqr", "business-paths");
}

export class WorkspaceBusinessPathRepository implements BusinessPathRepository {
  private readonly workspaceRoot: string;
  private readonly root: string;

  public constructor(workspaceRoot: string) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.root = businessPathWorkspaceRoot(workspaceRoot);
    assertWorkspaceContainedPath(this.workspaceRoot, this.root);
  }

  public list(): readonly BusinessPathArtifact[] {
    return clone(this.inspect().artifacts);
  }

  public findById(id: string): BusinessPathArtifact | undefined {
    if (!SAFE_BUSINESS_PATH_ID.test(id)) {
      return undefined;
    }
    return this.list().find((artifact) => artifact.id === id);
  }

  public findMatching(sourceTable: string, targetTable: string): readonly BusinessPathArtifact[] {
    const source = normalizeLogicalName(sourceTable);
    const target = normalizeLogicalName(targetTable);
    return this.list().filter((artifact) =>
      normalizeLogicalName(artifact.sourceTable) === source
      && normalizeLogicalName(artifact.targetTable) === target
    );
  }

  public save(artifact: BusinessPathArtifact): void {
    const serialized = serializeBusinessPathArtifact(artifact);
    if (!SAFE_BUSINESS_PATH_ID.test(artifact.id)) {
      throw new Error("Invalid Business Path ID.");
    }

    assertWorkspaceContainedPath(this.workspaceRoot, this.root);
    fs.mkdirSync(this.root, { recursive: true });
    const target = this.fileForId(artifact.id);
    this.atomicWrite(target, serialized);

    // Deterministic IDs mean an exact canonical route updates one artifact.
    // Remove only additional well-formed files that claim the same ID; never
    // rewrite or delete malformed artifacts during an unrelated save.
    for (const candidate of this.jsonFiles()) {
      if (candidate === target) {
        continue;
      }
      try {
        const parsed = parseBusinessPathArtifact(fs.readFileSync(candidate, "utf8"));
        if (parsed.id === artifact.id) {
          fs.rmSync(candidate, { force: true });
        }
      } catch {
        // Malformed workspace artifacts are isolated for explicit recovery.
      }
    }
  }

  public delete(id: string): boolean {
    if (!SAFE_BUSINESS_PATH_ID.test(id)) {
      return false;
    }

    let deleted = false;
    for (const file of this.jsonFiles()) {
      try {
        const parsed = parseBusinessPathArtifact(fs.readFileSync(file, "utf8"));
        if (parsed.id !== id) {
          continue;
        }
        fs.rmSync(file, { force: true });
        deleted = true;
      } catch {
        // Never delete a malformed artifact merely because its filename resembles an ID.
      }
    }
    return deleted;
  }

  public inspect(): BusinessPathRepositoryInspection {
    const artifactsById = new Map<string, BusinessPathArtifact>();
    const diagnostics: BusinessPathRepositoryDiagnostic[] = [];

    for (const file of this.jsonFiles()) {
      const fileName = path.basename(file);
      try {
        const parsed = parseBusinessPathArtifact(fs.readFileSync(file, "utf8"));
        const existing = artifactsById.get(parsed.id);
        if (existing) {
          diagnostics.push({
            code: "duplicate-artifact",
            fileName,
            message: `Business Path ${parsed.id} appears more than once; the first valid artifact in deterministic filename order was retained.`
          });
          continue;
        }
        artifactsById.set(parsed.id, parsed);
      } catch (error) {
        diagnostics.push({
          code: "malformed-artifact",
          fileName,
          message: error instanceof Error ? error.message : "Business Path artifact could not be parsed."
        });
      }
    }

    const artifacts = [...artifactsById.values()].sort(compareBusinessPaths);
    return {
      artifacts: clone(artifacts),
      diagnostics: clone(diagnostics)
    };
  }

  private jsonFiles(): string[] {
    if (!fs.existsSync(this.root)) {
      return [];
    }
    try {
      return fs.readdirSync(this.root, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
        .map((entry) => path.join(this.root, entry.name))
        .sort((left, right) => path.basename(left).localeCompare(path.basename(right)));
    } catch (error) {
      throw new Error(`Business Path Library could not be read: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  private fileForId(id: string): string {
    if (!SAFE_BUSINESS_PATH_ID.test(id)) {
      throw new Error("Invalid Business Path ID.");
    }
    return path.join(this.root, `${id}.json`);
  }

  private atomicWrite(file: string, serialized: string): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(temporary, serialized, { encoding: "utf8", mode: 0o600 });
    try {
      fs.renameSync(temporary, file);
    } catch (error) {
      fs.rmSync(temporary, { force: true });
      throw error;
    }
  }
}

function compareBusinessPaths(left: BusinessPathArtifact, right: BusinessPathArtifact): number {
  const source = normalizeLogicalName(left.sourceTable).localeCompare(normalizeLogicalName(right.sourceTable));
  if (source !== 0) {
    return source;
  }

  const target = normalizeLogicalName(left.targetTable).localeCompare(normalizeLogicalName(right.targetTable));
  if (target !== 0) {
    return target;
  }

  const leftPriority = left.priority ?? Number.MAX_SAFE_INTEGER;
  const rightPriority = right.priority ?? Number.MAX_SAFE_INTEGER;
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return left.id.localeCompare(right.id);
}
