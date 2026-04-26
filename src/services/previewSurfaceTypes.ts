export type PreviewSurfaceKind = "query" | "patch" | "diagnostic" | "batch";

export type PreviewSurfaceSource = "resultViewer" | "editor" | "explain" | "queryDoctor" | "smartPatch";

export type PreviewSurfaceRiskLevel = "normal" | "amber" | "red";

export type PreviewSurfaceActionKind = "apply" | "copy" | "cancel";

export interface PreviewSurfaceAction {
  id: string;
  label: string;
  kind: PreviewSurfaceActionKind;
  enabled: boolean;
  description?: string;
}

export interface PreviewSurfaceSection {
  title: string;
  content: string;
  language?: "text" | "json" | "http" | "bash" | "markdown";
}

export interface PreviewSurfaceModel {
  previewId: string;
  kind: PreviewSurfaceKind;
  title: string;
  source: PreviewSurfaceSource;
  sourceAction: string;
  createdAt: string;
  environmentName?: string;
  riskLevel?: PreviewSurfaceRiskLevel;
  summary?: string;
  sections: PreviewSurfaceSection[];
  primaryAction?: PreviewSurfaceAction;
  secondaryActions?: PreviewSurfaceAction[];
}

export interface PreviewSurfaceResult {
  actionId: string;
  actionKind: PreviewSurfaceActionKind;
  previewId: string;
}
