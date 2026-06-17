import * as assert from "assert";
import * as vscode from "vscode";
import { buildSnapshotFileName, buildSnapshotWorkspaceFileUri, slugSnapshotSegment } from "../../product/comparison/index.js";

suite("snapshotWorkspaceService", () => {
  test("builds short deterministic snapshot filenames from metadata labels", () => {
    const fileName = buildSnapshotFileName({
      capturedAt: new Date("2026-06-17T11:45:00.000Z"),
      label: "Before Release!"
    });

    assert.strictEqual(fileName, "20260617-1145-before-release.dvqrsnapshot.json");
  });

  test("keeps snapshot path identity in folders and filename identity short", () => {
    const uri = buildSnapshotWorkspaceFileUri({
      snapshotsRoot: vscode.Uri.file("/workspace/.dvqr/snapshots"),
      entityLogicalName: "account",
      environmentLabel: "DEV",
      capturedAt: new Date("2026-06-17T11:45:00.000Z"),
      label: "Before Release"
    });

    assert.ok(
      uri.fsPath.replace(/\\/g, "/").endsWith("account/dev/20260617-1145-before-release.dvqrsnapshot.json")
    );
  });

  test("normalizes snapshot path segments without turning filenames into identity carriers", () => {
    assert.strictEqual(slugSnapshotSegment("Care Plan / DEV", "snapshot"), "care-plan-dev");
  });
});
