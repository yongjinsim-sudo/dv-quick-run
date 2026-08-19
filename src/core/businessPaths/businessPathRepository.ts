import type { BusinessPathArtifact } from "./businessPathContracts.js";

export interface BusinessPathRepository {
  list(): readonly BusinessPathArtifact[];
  findById(id: string): BusinessPathArtifact | undefined;
  findMatching(sourceTable: string, targetTable: string): readonly BusinessPathArtifact[];
  save(artifact: BusinessPathArtifact): void;
  delete(id: string): boolean;
}

export interface BusinessPathRepositoryDiagnostic {
  readonly code:
    | "malformed-artifact"
    | "duplicate-artifact"
    | "read-failed";
  readonly fileName: string;
  readonly message: string;
}

export interface BusinessPathRepositoryInspection {
  readonly artifacts: readonly BusinessPathArtifact[];
  readonly diagnostics: readonly BusinessPathRepositoryDiagnostic[];
}
