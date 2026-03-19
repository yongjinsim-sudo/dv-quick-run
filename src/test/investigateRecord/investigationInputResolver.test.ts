import * as assert from "assert";
import { resolveInvestigationInput } from "../../commands/router/actions/investigateRecord/investigationInputResolver.js";

suite("investigationInputResolver", () => {
  test("resolves record path input", async () => {
    const result = await resolveInvestigationInput("contacts(8129eec7-4414-f111-8341-6045bdc42f8b)");

    assert.ok(result);
    assert.strictEqual(result?.type, "recordPath");
    assert.strictEqual(result?.entitySetName, "contacts");
    assert.strictEqual(result?.recordId, "8129eec7-4414-f111-8341-6045bdc42f8b");
  });

  test("resolves plain guid input", async () => {
    const result = await resolveInvestigationInput("8129eec7-4414-f111-8341-6045bdc42f8b");

    assert.ok(result);
    assert.strictEqual(result?.type, "guid");
    assert.strictEqual(result?.recordId, "8129eec7-4414-f111-8341-6045bdc42f8b");
  });

  test("resolves json input using primary candidate over lookup guid", async () => {
    const json = JSON.stringify({
      "@odata.context": "https://example.crm.dynamics.com/api/data/v9.2/$metadata#contacts/$entity",
      contactid: "8129eec7-4414-f111-8341-6045bdc42f8b",
      _ownerid_value: "22222222-2222-2222-2222-222222222222"
    });

    const result = await resolveInvestigationInput(json);

    assert.ok(result);
    assert.strictEqual(result?.type, "json");
    assert.strictEqual(result?.recordId, "8129eec7-4414-f111-8341-6045bdc42f8b");
    assert.strictEqual(result?.selectedCandidateFieldName, "contactid");
    assert.strictEqual(result?.selectedCandidateType, "primary");
    assert.strictEqual(result?.entitySetName, "contacts");
  });

  test("extracts json object from surrounding prose", async () => {
    const text = `Here is a row:\n{\n  \"@odata.context\": \"https://example.crm.dynamics.com/api/data/v9.2/$metadata#accounts/$entity\",\n  \"accountid\": \"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa\"\n}`;

    const result = await resolveInvestigationInput(text);

    assert.ok(result);
    assert.strictEqual(result?.type, "json");
    assert.strictEqual(result?.recordId, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    assert.strictEqual(result?.entitySetName, "accounts");
  });

  test("extracts entity set from projected collection odata context", async () => {
    const json = JSON.stringify({
      "@odata.context": "https://example.crm.dynamics.com/api/data/v9.2/$metadata#bu_healthcheckactivitydefinitions(bu_title,bu_bookingurl,bu_bookingurldestination)",
      value: [
        {
          bu_healthcheckactivitydefinitionid: "d7eabf0b-1f3d-f011-b4cb-002248129d4e",
          bu_title: "Eye test"
        }
      ]
    });

    const result = await resolveInvestigationInput(json);

    assert.ok(result);
    assert.strictEqual(result?.type, "json");
    assert.strictEqual(result?.entitySetName, "bu_healthcheckactivitydefinitions");
    assert.strictEqual(result?.recordId, "d7eabf0b-1f3d-f011-b4cb-002248129d4e");
  });
  test("uses nearest preceding odata context from full document for selected fragment", async () => {
    const selectedText = `{"contactid":"8129eec7-4414-f111-8341-6045bdc42f8b"}`;
    const fullDocument = `
{
  "@odata.context": "https://example.crm.dynamics.com/api/data/v9.2/$metadata#organizations/$entity",
  "organizationid": "7f29eec7-4414-f111-8341-6045bdc42f8b"
}

{
  "@odata.context": "https://example.crm.dynamics.com/api/data/v9.2/$metadata#contacts/$entity",
  "contactid": "8129eec7-4414-f111-8341-6045bdc42f8b",
  "_ownerid_value": "22222222-2222-2222-2222-222222222222"
}`;

    const selectionStart = fullDocument.lastIndexOf('"contactid"');
    const result = await resolveInvestigationInput(selectedText, fullDocument, selectionStart);

    assert.ok(result);
    assert.strictEqual(result?.type, "json");
    assert.strictEqual(result?.entitySetName, "contacts");
    assert.strictEqual(result?.recordId, "8129eec7-4414-f111-8341-6045bdc42f8b");
  });

    test("resolves uppercase guid input", async () => {
    const result = await resolveInvestigationInput("8129EEC7-4414-4F11-8341-6045BDC42F8B");

    assert.ok(result);
    assert.strictEqual(result?.type, "guid");
    assert.strictEqual(result?.recordId, "8129EEC7-4414-4F11-8341-6045BDC42F8B");
  });

  test("extracts record id from noisy prose when no full json object is present", async () => {
    const input = "2026-03-18 10:11:12Z ERROR failed to load row contactid=8129eec7-4414-4f11-8341-6045bdc42f8b while rendering result viewer";

    const result = await resolveInvestigationInput(input);

    assert.ok(result);
    assert.strictEqual(result?.type, "json");
    assert.strictEqual(result?.recordId, "8129eec7-4414-4f11-8341-6045bdc42f8b");
    assert.strictEqual(result?.selectedCandidateFieldName, "contactid");
  });

  test("prefers primary id candidate from json over lookup guid when multiple guid fields exist", async () => {
    const json = JSON.stringify({
      "@odata.context": "https://example.crm.dynamics.com/api/data/v9.2/$metadata#accounts/$entity",
      _primarycontactid_value: "11111111-1111-4111-8111-111111111111",
      accountid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name: "Acme"
    });

    const result = await resolveInvestigationInput(json);

    assert.ok(result);
    assert.strictEqual(result?.type, "json");
    assert.strictEqual(result?.recordId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    assert.strictEqual(result?.selectedCandidateFieldName, "accountid");
    assert.strictEqual(result?.selectedCandidateType, "primary");
    assert.strictEqual(result?.entitySetName, "accounts");
  });

  test("returns undefined for malformed text with no valid guid", async () => {
    const result = await resolveInvestigationInput("contactid=not-a-guid and no usable payload here");

    assert.strictEqual(result, undefined);
  });

    test("resolves brace-wrapped guid input", async () => {
    const result = await resolveInvestigationInput("{8129eec7-4414-4f11-8341-6045bdc42f8b}");

    assert.ok(result);
    assert.strictEqual(result?.type, "guid");
    assert.strictEqual(result?.recordId, "8129eec7-4414-4f11-8341-6045bdc42f8b");
  });

  test("extracts json row from surrounding prose for selection sourceJson", async () => {
    const input = 'INFO payload received { "contactid": "8129eec7-4414-4f11-8341-6045bdc42f8b", "fullname": "Alice" }';

    const result = await resolveInvestigationInput(input);

    assert.ok(result);
    assert.strictEqual(result?.type, "json");
    assert.strictEqual(result?.recordId, "8129eec7-4414-4f11-8341-6045bdc42f8b");
    assert.ok(result?.sourceJson);
  });

});

