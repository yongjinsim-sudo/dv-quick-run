import {
  buildPortableTextPayload,
  normalizeStructuredContent,
  type DvqrMcpPortableTextOptions
} from "./mcpPortableText.js";
import { redactMcpOutput } from "./mcpOutputRedaction.js";

export interface DvqrMcpTextContent {
  type: "text";
  text: string;
}

export interface DvqrMcpToolResponse {
  readonly [key: string]: unknown;
  content: DvqrMcpTextContent[];
  structuredContent?: Record<string, unknown>;
  isError?: true;
}

export function formatDvqrMcpToolResponse(
  text: string,
  structuredContent: unknown,
  portableTextOptions: DvqrMcpPortableTextOptions,
  isError = false
): DvqrMcpToolResponse {
  const normalized = normalizeStructuredContent(redactMcpOutput(structuredContent));
  const portable = buildPortableTextPayload(normalized, portableTextOptions);
  const content: DvqrMcpTextContent[] = [{ type: "text", text: String(redactMcpOutput(text)) }];
  if (portable.text !== undefined) {
    content.push({ type: "text", text: portable.text });
  }
  return {
    content,
    ...(normalized === undefined ? {} : { structuredContent: normalized }),
    ...(isError ? { isError: true as const } : {})
  };
}
