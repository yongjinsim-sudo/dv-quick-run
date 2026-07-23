function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

export function formatLocalReportFileTimestamp(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function formatUtcReportFileTimestamp(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "").replace("T", "-").slice(0, 17);
}
