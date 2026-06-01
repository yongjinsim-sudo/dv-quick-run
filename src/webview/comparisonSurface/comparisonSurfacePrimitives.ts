import type { ComparisonOperationalSignificance } from "../../core/comparison/index.js";

export interface ComparisonSurfaceRenderOptions {
  readonly canExport?: boolean;
  readonly isProPreview?: boolean;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "group";
}

export function formatCapturedAt(value: string | undefined): string {
  if (!value) {
    return "Not captured";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

export function significanceRank(value: ComparisonOperationalSignificance): number {
  return value === "High" ? 3 : value === "Medium" ? 2 : 1;
}
