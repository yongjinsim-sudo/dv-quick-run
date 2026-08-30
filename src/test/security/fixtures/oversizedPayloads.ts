function buildNestedObject(depth: number): Record<string, unknown> {
  let value: Record<string, unknown> = { leaf: "bounded" };
  for (let index = 0; index < depth; index += 1) {
    value = { nested: value };
  }
  return value;
}

export const oversizedPayloadFixtures = {
  hugeString: "x".repeat(128 * 1024),
  hugeArray: Array.from({ length: 4096 }, (_, index) => `item-${index}`),
  deepObject: buildNestedObject(128),
  hugeQuery: `contacts?$filter=${"x".repeat(128 * 1024)}`,
  hugeFetchXml: `<fetch><entity name="contact"><filter><condition attribute="fullname" operator="eq" value="${"x".repeat(128 * 1024)}" /></filter></entity></fetch>`,
  malformedJson: '{"pathId":"bp_2f4d19cc",',
  truncatedJson: '{"schemaVersion":"dvqr-business-path-v1"',
  controlCharacters: "prefix\u0000\u0001\u0007suffix"
} as const;
