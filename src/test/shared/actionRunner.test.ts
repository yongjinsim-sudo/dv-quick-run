import * as assert from "assert";
import { handleActionFailure } from "../../commands/router/actions/shared/actionRunner.js";

suite("actionRunner", () => {
  test("logs normalized error message and surfaces failure message", () => {
    const logged: string[] = [];
    const shown: string[] = [];

    handleActionFailure(new Error("boom"), "Friendly failure", {
      logError: (message: string) => { logged.push(message); },
      showErrorMessage: (message: string) => { shown.push(message); }
    });

    assert.deepStrictEqual(logged, ["boom"]);
    assert.deepStrictEqual(shown, ["Friendly failure"]);
  });

  test("handles non-Error thrown values", () => {
    const logged: string[] = [];
    const shown: string[] = [];

    handleActionFailure("plain failure", "Friendly failure", {
      logError: (message: string) => { logged.push(message); },
      showErrorMessage: (message: string) => { shown.push(message); }
    });

    assert.deepStrictEqual(logged, ["plain failure"]);
    assert.deepStrictEqual(shown, ["Friendly failure"]);
  });
});
