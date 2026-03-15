import * as assert from "assert";
import { buildRecordQueries } from "../../commands/router/actions/investigateRecord/recordQueryBuilder.js";
import { buildDataverseRecordUiLink } from "../../commands/router/actions/investigateRecord/dataverseUiLinkBuilder.js";

suite("recordQueryAndUiLink", () => {
  test("buildRecordQueries includes primary id and primary name in minimal query", () => {
    const result = buildRecordQueries({
      entityLogicalName: "contact",
      entitySetName: "contacts",
      primaryIdField: "contactid",
      primaryNameField: "fullname",
      inferenceSource: "jsonContext"
    }, "8129eec7-4414-f111-8341-6045bdc42f8b");

    assert.strictEqual(result.rawQuery, "contacts(8129eec7-4414-f111-8341-6045bdc42f8b)");
    assert.match(result.minimalQuery, /^contacts\(8129eec7-4414-f111-8341-6045bdc42f8b\)\?\$select=/);
    assert.match(result.minimalQuery, /contactid/);
    assert.match(result.minimalQuery, /fullname/);
  });

  test("buildDataverseRecordUiLink strips api path and encodes record id", () => {
    const result = buildDataverseRecordUiLink(
      "https://example.crm.dynamics.com/api/data/v9.2/",
      "contact",
      "8129eec7-4414-f111-8341-6045bdc42f8b"
    );

    assert.strictEqual(
      result,
      "https://example.crm.dynamics.com/main.aspx?etn=contact&id=%7B8129eec7-4414-f111-8341-6045bdc42f8b%7D&pagetype=entityrecord"
    );
  });

  test("buildDataverseRecordUiLink preserves non-api base urls", () => {
    const result = buildDataverseRecordUiLink(
      "https://example.crm.dynamics.com/",
      "account",
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    );

    assert.strictEqual(
      result,
      "https://example.crm.dynamics.com/main.aspx?etn=account&id=%7Baaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa%7D&pagetype=entityrecord"
    );
  });
});
