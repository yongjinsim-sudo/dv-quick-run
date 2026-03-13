import * as assert from "assert";
import { clearEnvironmentScopedRuntimeCachesWithDeps } from "../../runtime/environmentRuntimeState.js";

suite("environmentRuntimeState", () => {
  test("clears all runtime caches and logs when output is present", () => {
    let metadataCleared = 0;
    let hoverCleared = 0;
    let navigationCleared = 0;
    const logs: string[] = [];

    clearEnvironmentScopedRuntimeCachesWithDeps(
      {
        clearMetadataSessionCache: () => { metadataCleared++; },
        clearHoverFieldContextCache: () => { hoverCleared++; },
        clearNavigationHoverEnrichmentCache: () => { navigationCleared++; },
        logInfo: (message: string) => { logs.push(message); }
      },
      {} as any
    );

    assert.strictEqual(metadataCleared, 1);
    assert.strictEqual(hoverCleared, 1);
    assert.strictEqual(navigationCleared, 1);
    assert.strictEqual(logs.length, 1);
  });

  test("does not log when no output channel is supplied", () => {
    const logs: string[] = [];

    clearEnvironmentScopedRuntimeCachesWithDeps(
      {
        clearMetadataSessionCache: () => undefined,
        clearHoverFieldContextCache: () => undefined,
        clearNavigationHoverEnrichmentCache: () => undefined,
        logInfo: (message: string) => { logs.push(message); }
      },
      undefined
    );

    assert.deepStrictEqual(logs, []);
  });
});
