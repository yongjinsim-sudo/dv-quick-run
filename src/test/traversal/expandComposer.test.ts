import * as assert from "assert";
import {
  applyExpand,
  parseExpandClause,
  serializeExpandNodes,
  type ExpandNode
} from "../../commands/router/actions/shared/expand/expandComposer.js";

suite("expandComposer", () => {
  test("appends a new expand when existing clause is empty", () => {
    const result = applyExpand(undefined, {
      relationship: "createdby",
      select: ["fullname", "systemuserid"]
    });

    assert.strictEqual(result, "createdby($select=fullname,systemuserid)");
  });

  test("merges selects for an existing relationship", () => {
    const result = applyExpand("createdby($select=fullname)", {
      relationship: "createdby",
      select: ["address1_city", "fullname"]
    });

    assert.strictEqual(result, "createdby($select=address1_city,fullname)");
  });

  test("preserves multiple expands with deterministic ordering", () => {
    const result = applyExpand("createdby($select=fullname)", {
      relationship: "owningbusinessunit",
      select: ["name"]
    });

    assert.strictEqual(
      result,
      "createdby($select=fullname),owningbusinessunit($select=name)"
    );
  });

  test("supports nested expand composition internally", () => {
    const result = applyExpand(undefined, {
      relationship: "primarycontactid",
      select: ["fullname"],
      expand: [
        {
          relationship: "parentcustomerid_account",
          select: ["name"]
        }
      ]
    });

    assert.strictEqual(
      result,
      "primarycontactid($select=fullname;$expand=parentcustomerid_account($select=name))"
    );
  });

  test("parses and serializes additional options without dropping them", () => {
    const nodes = parseExpandClause(
      "primarycontactid($select=fullname;$filter=contains(fullname,'a');$expand=parentcustomerid_account($select=name))"
    );

    const roundTrip = serializeExpandNodes(nodes);

    assert.strictEqual(
      roundTrip,
      "primarycontactid($select=fullname;$expand=parentcustomerid_account($select=name);$filter=contains(fullname,'a'))"
    );
  });

  test("serializes equivalent Add Expand and Sibling Expand node shapes identically", () => {
    const addExpandShape: ExpandNode[] = [
      {
        relationship: "createdby",
        select: ["fullname", "systemuserid"]
      }
    ];

    const siblingExpandShape: ExpandNode[] = [
      {
        relationship: "createdby",
        select: ["systemuserid", "fullname"]
      }
    ];

    assert.strictEqual(
      serializeExpandNodes(addExpandShape),
      serializeExpandNodes(siblingExpandShape)
    );
  });
});
