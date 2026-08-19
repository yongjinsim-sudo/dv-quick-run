import type {
  BusinessPathArtifact,
  BusinessPathManagementClock,
  BusinessPathManagementUpdate,
  BusinessPathRepository
} from "../../core/businessPaths/index.js";
import { updateManagedBusinessPath } from "../../core/businessPaths/index.js";

const systemClock: BusinessPathManagementClock = {
  nowIso: () => new Date().toISOString()
};

export class BusinessPathManagementService {
  public constructor(
    private readonly repository: BusinessPathRepository,
    private readonly clock: BusinessPathManagementClock = systemClock
  ) {}

  public update(id: string, update: BusinessPathManagementUpdate): BusinessPathArtifact {
    const existing = this.repository.findById(id);
    if (!existing) {
      throw new Error(`Business Path ${id} was not found.`);
    }
    const updated = updateManagedBusinessPath(existing, update, this.clock.nowIso());
    this.repository.save(updated);
    return updated;
  }

  public setEnabled(id: string, enabled: boolean): BusinessPathArtifact {
    return this.update(id, { state: enabled ? "preferred" : "disabled" });
  }

  public delete(id: string): boolean {
    return this.repository.delete(id);
  }
}
