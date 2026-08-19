import type {
  BusinessPathPromotionClock,
  BusinessPathPromotionInput,
  BusinessPathPromotionResult,
  BusinessPathRepository
} from "../../core/businessPaths/index.js";
import { buildPromotedBusinessPathArtifact, businessPathId } from "../../core/businessPaths/index.js";

const systemClock: BusinessPathPromotionClock = {
  nowIso: () => new Date().toISOString()
};

/**
 * Explicit mutation service for reviewed Business Path promotion.
 *
 * Merely constructing this service, discovering a path, validating a path, or
 * ranking a path never persists anything. Persistence occurs only when promote()
 * is called by an explicit user-facing action.
 */
export class BusinessPathPromotionService {
  public constructor(
    private readonly repository: BusinessPathRepository,
    private readonly clock: BusinessPathPromotionClock = systemClock
  ) {}

  public promote(input: BusinessPathPromotionInput): BusinessPathPromotionResult {
    if (!input.name.trim()) {
      throw new Error("Business Path promotion requires a user-visible name.");
    }
    if (!input.hops.length) {
      throw new Error("Business Path promotion requires at least one exact relationship hop.");
    }

    const id = businessPathId(input.sourceTable, input.targetTable, input.hops);
    const existing = this.repository.findById(id);
    const artifact = buildPromotedBusinessPathArtifact(
      input,
      existing,
      this.clock.nowIso()
    );

    this.repository.save(artifact);

    return {
      artifact,
      created: existing === undefined,
      updatedExisting: existing !== undefined
    };
  }
}
