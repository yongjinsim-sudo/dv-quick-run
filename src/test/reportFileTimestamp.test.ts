import * as assert from "assert";
import {
  formatLocalReportFileTimestamp,
  formatUtcReportFileTimestamp
} from "../product/reporting/reportFileTimestamp.js";

suite("reportFileTimestamp", () => {
  test("includes seconds in local report filenames", () => {
    const local = new Date(2026, 6, 23, 8, 3, 7, 286);
    assert.strictEqual(formatLocalReportFileTimestamp(local), "2026-07-23-080307");
  });

  test("includes seconds but not milliseconds in UTC report filenames", () => {
    const utc = new Date("2026-07-23T08:03:07.286Z");
    assert.strictEqual(formatUtcReportFileTimestamp(utc), "2026-07-23-080307");
  });

  test("gives every second a distinct filename timestamp", () => {
    const first = new Date("2026-07-23T08:03:07.000Z");
    const second = new Date("2026-07-23T08:03:08.000Z");
    assert.notStrictEqual(
      formatUtcReportFileTimestamp(first),
      formatUtcReportFileTimestamp(second)
    );
  });
});
