import type { ComparisonDifference, ComparisonDriftGroup, ComparisonOperationalSignificance, ComparisonSnapshotTrustSummary, ComparisonViewModel } from "../../../core/comparison/index.js";
import type { AuditEvidenceResult } from "../../audit/auditEvidenceTypes.js";

export type ComparisonReportKind = "DiffFindingsSummary" | "InvestigationHandoff";

export interface ComparisonReportWatermark {
  readonly logoDataUri?: string;
  readonly footerText: string;
}

export interface ComparisonReportFinding {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly groupTitle: string;
  readonly kind: string;
  readonly significance: ComparisonOperationalSignificance;
  readonly evidenceCount: number;
}

export interface ComparisonReportGroup {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly significance: ComparisonOperationalSignificance;
  readonly differenceCount: number;
  readonly differences: readonly ComparisonDifference[];
}

export interface ComparisonReportExecutiveSummary {
  readonly heading: string;
  readonly paragraphs: readonly string[];
  readonly highlights: readonly string[];
}

export interface ComparisonReportProviderDistributionItem {
  readonly label: string;
  readonly count: number;
}

export interface ComparisonReportChartModel {
  readonly significanceDistribution: {
    readonly high: number;
    readonly medium: number;
    readonly low: number;
  };
  readonly providerDistribution: readonly ComparisonReportProviderDistributionItem[];
}

export interface ComparisonReportModel {
  readonly kind: ComparisonReportKind;
  readonly title: string;
  readonly generatedAtIso: string;
  readonly sourceLabel: string;
  readonly targetLabel: string;
  readonly subjectLabel?: string;
  readonly sourceCapturedAtIso?: string;
  readonly targetCapturedAtIso?: string;
  readonly snapshotTrust?: ComparisonSnapshotTrustSummary;
  readonly highCount: number;
  readonly mediumCount: number;
  readonly lowCount: number;
  readonly providerCount: number;
  readonly differenceCount: number;
  readonly executiveSummary: ComparisonReportExecutiveSummary;
  readonly charts?: ComparisonReportChartModel;
  readonly topFindings: readonly ComparisonReportFinding[];
  readonly groups: readonly ComparisonReportGroup[];
  readonly sourceModel: ComparisonViewModel;
  readonly watermark: ComparisonReportWatermark;
  readonly auditEvidenceResults?: readonly AuditEvidenceResult[];
}

export interface BuildComparisonReportOptions {
  readonly generatedAt?: Date;
  readonly watermarkLogoDataUri?: string;
  readonly auditEvidenceResults?: readonly AuditEvidenceResult[];
}

export const reportSignificanceRank: Record<ComparisonOperationalSignificance, number> = {
  High: 3,
  Medium: 2,
  Low: 1
};

export function flattenReportFindings(groups: readonly ComparisonDriftGroup[]): readonly ComparisonReportFinding[] {
  return groups
    .flatMap((group) => group.differences.map((difference) => ({
      id: difference.id,
      title: difference.title,
      summary: difference.summary,
      groupTitle: group.title,
      kind: difference.kind,
      significance: difference.significance,
      evidenceCount: difference.evidence.length
    })))
    .sort((left, right) => {
      const significanceDelta = reportSignificanceRank[right.significance] - reportSignificanceRank[left.significance];
      if (significanceDelta !== 0) {
        return significanceDelta;
      }

      return left.title.localeCompare(right.title);
    });
}
