export interface IdentifierFixture {
  id: string;
  value: string;
  kind: "guid" | "logicalName" | "relationship" | "businessPathId";
}

export const malformedIdentifierFixtures: readonly IdentifierFixture[] = [
  { id: "short-guid", kind: "guid", value: "12345" },
  { id: "encoded-delimiter", kind: "guid", value: "00000000-0000-0000-0000-000000000001%2Fcontacts" },
  { id: "url-fragment", kind: "guid", value: "00000000-0000-0000-0000-000000000001#fragment" },
  { id: "query-fragment", kind: "guid", value: "00000000-0000-0000-0000-000000000001?$top=1" },
  { id: "path-fragment", kind: "businessPathId", value: "../../bp_2f4d19cc" },
  { id: "quote-injection", kind: "logicalName", value: "contact') or true" },
  { id: "control-character", kind: "logicalName", value: "contact\u0000account" },
  { id: "oversized", kind: "relationship", value: "r".repeat(8192) },
  { id: "windows-path", kind: "businessPathId", value: "C:\\temp\\bp_2f4d19cc.json" },
  { id: "unc-path", kind: "businessPathId", value: "\\\\server\\share\\bp_2f4d19cc.json" }
] as const;
