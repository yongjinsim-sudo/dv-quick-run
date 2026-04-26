import { PreviewSurfacePanel } from "../providers/previewSurfacePanel.js";
import type {
  PreviewSurfaceAction,
  PreviewSurfaceKind,
  PreviewSurfaceModel,
  PreviewSurfaceResult,
  PreviewSurfaceRiskLevel,
  PreviewSurfaceSection,
  PreviewSurfaceSource
} from "./previewSurfaceTypes.js";

export interface ShowPreviewSurfaceOptions {
  kind: PreviewSurfaceKind;
  title: string;
  source: PreviewSurfaceSource;
  sourceAction: string;
  summary?: string;
  environmentName?: string;
  riskLevel?: PreviewSurfaceRiskLevel;
  sections: PreviewSurfaceSection[];
  primaryAction?: PreviewSurfaceAction;
  secondaryActions?: PreviewSurfaceAction[];
}

export async function showPreviewSurface(
  options: ShowPreviewSurfaceOptions
): Promise<PreviewSurfaceResult> {
  const model: PreviewSurfaceModel = {
    previewId: createPreviewId(),
    kind: options.kind,
    title: options.title,
    source: options.source,
    sourceAction: options.sourceAction,
    createdAt: new Date().toLocaleString(),
    environmentName: options.environmentName,
    riskLevel: options.riskLevel,
    summary: options.summary,
    sections: options.sections,
    primaryAction: options.primaryAction,
    secondaryActions: options.secondaryActions
  };

  return await PreviewSurfacePanel.show(model);
}

export interface UpdatePreviewSurfaceOptions extends ShowPreviewSurfaceOptions {
  previewId?: string;
  createdAt?: string;
}

export function updatePreviewSurface(options: UpdatePreviewSurfaceOptions): void {
  const model: PreviewSurfaceModel = {
    previewId: options.previewId ?? createPreviewId(),
    kind: options.kind,
    title: options.title,
    source: options.source,
    sourceAction: options.sourceAction,
    createdAt: options.createdAt ?? new Date().toLocaleString(),
    environmentName: options.environmentName,
    riskLevel: options.riskLevel,
    summary: options.summary,
    sections: options.sections,
    primaryAction: options.primaryAction,
    secondaryActions: options.secondaryActions
  };

  PreviewSurfacePanel.update(model);
}

export function createPreviewAction(args: {
  id: string;
  label: string;
  kind: "apply" | "copy" | "cancel";
  enabled?: boolean;
  description?: string;
}): PreviewSurfaceAction {
  return {
    id: args.id,
    label: args.label,
    kind: args.kind,
    enabled: args.enabled ?? true,
    description: args.description
  };
}

function createPreviewId(): string {
  return `preview-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
