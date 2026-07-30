export const DEFAULT_MCP_PORTABLE_TEXT_MAX_CHARACTERS = 32_768;

export interface DvqrMcpPortableTextOptions {
  readonly enabled: boolean;
  readonly maxCharacters: number;
}

export interface DvqrMcpPortableTextResult {
  readonly text?: string;
  readonly mirrored: boolean;
  readonly truncated: boolean;
  readonly originalCharacterCount?: number;
}

function normalizeMaxCharacters(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_MCP_PORTABLE_TEXT_MAX_CHARACTERS;
  }
  return Math.max(1_024, Math.floor(value));
}

export function normalizeStructuredContent(structuredContent: unknown): Record<string, unknown> | undefined {
  if (structuredContent === undefined) {
    return undefined;
  }
  return structuredContent && typeof structuredContent === "object" && !Array.isArray(structuredContent)
    ? structuredContent as Record<string, unknown>
    : { result: structuredContent };
}

export function buildPortableTextPayload(
  structuredContent: Record<string, unknown> | undefined,
  options: DvqrMcpPortableTextOptions
): DvqrMcpPortableTextResult {
  if (!options.enabled || structuredContent === undefined) {
    return { mirrored: false, truncated: false };
  }

  const serialized = JSON.stringify(structuredContent, null, 2);
  const maxCharacters = normalizeMaxCharacters(options.maxCharacters);
  if (serialized.length <= maxCharacters) {
    return {
      text: serialized,
      mirrored: true,
      truncated: false,
      originalCharacterCount: serialized.length
    };
  }

  const notice = "Portable text mirror truncated. The complete bounded payload remains available in structuredContent for hosts that support it.";
  const fixedEnvelopeBudget = 512;
  const previewLength = Math.max(256, maxCharacters - fixedEnvelopeBudget);
  const portableEnvelope = {
    contractVersion: "dvqr-mcp-portable-text-v1",
    truncated: true,
    originalCharacterCount: serialized.length,
    maxCharacters,
    notice,
    preview: serialized.slice(0, previewLength)
  };

  return {
    text: JSON.stringify(portableEnvelope, null, 2),
    mirrored: true,
    truncated: true,
    originalCharacterCount: serialized.length
  };
}
