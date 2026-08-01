export interface DvqrMcpFreeToolSuccess {
  readonly ok: true;
  readonly summary: string;
  readonly displayText?: string;
  readonly structuredContent: unknown;
}

export interface DvqrMcpFreeToolFailure {
  readonly ok: false;
  readonly code: "InvalidArguments" | "EnvironmentRequired" | "ExecutionFailed" | "UnknownNavigationProperty";
  readonly message: string;
  readonly structuredError?: unknown;
  readonly structuredContent?: unknown;
}

export type DvqrMcpFreeToolResult = DvqrMcpFreeToolSuccess | DvqrMcpFreeToolFailure;
