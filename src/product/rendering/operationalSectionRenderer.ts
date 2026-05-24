export interface OperationalKeyValueRow {
  readonly label: string;
  readonly value: string | number | boolean | undefined;
}

export function renderOperationalBulletList(items: readonly string[] | undefined, emptyText: string): string {
  if (!items || items.length === 0) {
    return `_${emptyText}_`;
  }

  return items.map((item) => `- ${item}`).join("\n");
}

export function renderOperationalKeyValueRows(rows: readonly OperationalKeyValueRow[]): string {
  return rows
    .map((row) => `- ${row.label}: ${row.value === undefined || row.value === "" ? "Not returned" : String(row.value)}`)
    .join("\n");
}

export function renderOperationalDetails(summary: string, body: string): string {
  return [
    "<details>",
    `<summary>${summary}</summary>`,
    "",
    body,
    "",
    "</details>"
  ].join("\n");
}
