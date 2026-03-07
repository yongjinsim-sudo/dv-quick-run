export const ACTIONS = ["Top 10", "Select fields", "Custom query"] as const;
export type Action = (typeof ACTIONS)[number];