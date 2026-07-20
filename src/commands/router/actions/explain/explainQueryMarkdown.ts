import { EntityDef } from "../../../../utils/entitySetCache.js";
import type { DiagnosticResult } from "../shared/diagnostics/diagnosticTypes.js";
import { buildDiagnosticMarkdownLines } from "../shared/diagnostics/diagnosticOutputBuilder.js";
import { type ValidationIssue } from "../shared/queryExplain/queryValidation.js";
import { buildDesignNotes, buildIntentLines, buildInvestigationProfile, buildInvestigationStage, buildPotentialObservations, buildSections, buildSummary, buildTeachingObservations, buildValidationLines, buildVerificationGuidance } from "./explainQuerySections.js";
import type { ChoiceMetadataDef } from "../../../../services/entityChoiceMetadataService.js";
import { ExplainRelationshipReasoningNote, ParsedDataverseQuery } from "./explainQueryTypes.js";
import type { ExecutionEvidence } from "../shared/diagnostics/executionEvidence.js";
import { runExplainEngine } from "../../../../product/explainEngine/explainEngine.js";
import { fromNumericConfidence } from "../../../../product/explainEngine/explainConfidence.js";
import { renderUnderstandingDocumentMarkdown } from "../../../../product/understanding/understandingMarkdownRenderer.js";
import type { ExplainContributor, ExplainResult } from "../../../../product/explainEngine/explainEngineTypes.js";
import { buildODataQueryUnderstandingDocument } from "./explainQueryUnderstanding.js";
import { buildLookupUnderstandingLines, type ExplainLookupUnderstanding } from "./explainLookupUnderstanding.js";

function buildRelationshipReasoningLines(notes: ExplainRelationshipReasoningNote[]): string[] {
  const lines: string[] = [];

  for (const note of notes) {
    lines.push(`- ${note.summary}`);
    lines.push(`  - Clause: \`${note.clause}\``);
    if (note.suggestion) {
      lines.push(`  - Suggestion: ${note.suggestion}`);
    }
  }

  return lines;
}

function buildQueryExplainContributors(
  parsed: ParsedDataverseQuery,
  entity: EntityDef | undefined,
  validationIssues: ValidationIssue[],
  relationshipReasoningNotes: ExplainRelationshipReasoningNote[],
  diagnostics: DiagnosticResult | undefined,
  executionEvidence: ExecutionEvidence | undefined,
  choiceMetadata: ChoiceMetadataDef[],
  lookupUnderstanding: ExplainLookupUnderstanding[]
): ExplainContributor[] {
  return [
    {
      id: "dvqr.investigation.summary",
      title: "Investigation Summary",
      run: () => ({
        summaryLines: [buildSummary(parsed, entity)],
        sections: [
          {
            heading: "Investigation Stage",
            lines: buildInvestigationStage(parsed),
            confidence: "medium" as const,
            sourceContributor: "dvqr.investigation.summary"
          },
          {
            heading: "Investigation Profile",
            lines: buildInvestigationProfile(parsed),
            confidence: "high" as const,
            sourceContributor: "dvqr.investigation.summary"
          },
          {
            heading: "Potential Observations",
            lines: buildPotentialObservations(parsed),
            confidence: "medium" as const,
            sourceContributor: "dvqr.investigation.summary"
          },
          {
            heading: "Things Worth Verifying",
            lines: buildVerificationGuidance(parsed),
            confidence: "medium" as const,
            sourceContributor: "dvqr.investigation.summary"
          }
        ]
      })
    },
    {
      id: "dvqr.teaching",
      title: "Teaching & Best Practices",
      run: () => ({
        observations: buildTeachingObservations(parsed)
      })
    },
    {
      id: "odata.query.structure",
      title: "Query Structure Analysis",
      run: () => {
        const sections = buildSections(parsed, entity, choiceMetadata).map((section) => ({
          ...section,
          confidence: "high" as const,
          sourceContributor: "odata.query.structure"
        }));

        return {
          sections: [
            {
              heading: "Raw Query",
              lines: ["```text", parsed.normalized, "```"],
              confidence: "high" as const,
              sourceContributor: "odata.query.structure"
            },
            {
              heading: "Query Intent",
              lines: buildIntentLines(parsed),
              confidence: "high" as const,
              sourceContributor: "odata.query.structure"
            },
            ...sections
          ],
          evidence: [
            {
              label: "Parsed query",
              detail: `Entity set \`${parsed.entitySetName ?? "unknown"}\`, selected columns ${parsed.select.length}, expands ${parsed.expand.length}.`,
              confidence: "high" as const
            }
          ]
        };
      }
    },
    {
      id: "odata.validation",
      title: "Validation & Unknowns",
      run: () => ({
        sections: validationIssues.length
          ? [{
            heading: "Validation",
            lines: buildValidationLines(validationIssues),
            confidence: "medium" as const,
            sourceContributor: "odata.validation"
          }]
          : [],
        unknowns: parsed.unknownParams.map((param) => ({
          label: `Unknown query option \`${param.key}\``,
          reason: "The option was preserved but is not interpreted by the Explain Engine yet.",
          impact: "Review the generated query manually before using it as operational evidence."
        }))
      })
    },
    {
      id: "dataverse.lookup.understanding",
      title: "Lookup & Relationship Understanding",
      run: () => ({
        sections: lookupUnderstanding.length
          ? [{
            heading: "Lookup & Relationship Understanding",
            lines: buildLookupUnderstandingLines(lookupUnderstanding),
            confidence: "high" as const,
            sourceContributor: "dataverse.lookup.understanding"
          }]
          : []
      })
    },
    {
      id: "dataverse.relationship.reasoning",
      title: "Field Provenance & Relationship Advice",
      run: () => ({
        sections: relationshipReasoningNotes.length
          ? [{
            heading: "Field Provenance & Relationship Advice",
            lines: buildRelationshipReasoningLines(relationshipReasoningNotes),
            confidence: "medium" as const,
            sourceContributor: "dataverse.relationship.reasoning"
          }]
          : []
      })
    },
    {
      id: "query.doctor.v2",
      title: "Query Doctor",
      run: () => ({
        sections: diagnostics?.findings.length
          ? [{
            heading: "Diagnostics",
            lines: buildDiagnosticMarkdownLines(diagnostics)
              .filter((line) => line !== "## Diagnostics")
              .map((line) => line.startsWith("### ") ? `#### ${line.slice(4)}` : line),
            confidence: "medium" as const,
            sourceContributor: "query.doctor.v2"
          }]
          : [],
        recommendations: (diagnostics?.findings ?? [])
          .filter((finding) => finding.suggestion || finding.suggestedFix || finding.suggestedQuery)
          .map((finding) => ({
            title: finding.suggestedFix?.label ?? "Review diagnostic finding",
            detail: finding.suggestion ?? finding.suggestedFix?.detail ?? finding.message,
            confidence: fromNumericConfidence(finding.confidence),
            sourceContributor: "query.doctor.v2",
            previewQuery: finding.suggestedQuery?.query,
            actionability: finding.actionability ?? "none"
          }))
      })
    },
    {
      id: "execution.evidence",
      title: "Execution Evidence",
      run: () => {
        if (!executionEvidence) {
          return {};
        }

        const lines: string[] = [];
        lines.push(`- Observed rows returned: ${executionEvidence.returnedRowCount}`);
        lines.push(`- Observed execution time: ${executionEvidence.executionTimeMs}ms`);
        if (typeof executionEvidence.requestedTop === "number") {
          lines.push(`- Requested $top: ${executionEvidence.requestedTop}`);
          lines.push(`- Returned full requested page: ${executionEvidence.returnedFullPage ? "yes" : "no"}`);
        }
        lines.push(`- Selected column count: ${executionEvidence.selectedColumnCount}`);
        lines.push(`- Expand present: ${executionEvidence.hasExpand ? "yes" : "no"}`);
        if (executionEvidence.filterFieldNames.length) {
          lines.push(`- Filter fields observed: ${executionEvidence.filterFieldNames.map((item) => `\`${item}\``).join(", ")}`);
        }

        return {
          sections: [{
            heading: "Evidence",
            lines,
            confidence: "medium" as const,
            sourceContributor: "execution.evidence"
          }],
          evidence: [
            {
              label: "Last observed execution",
              detail: `${executionEvidence.returnedRowCount} rows in ${executionEvidence.executionTimeMs}ms.`,
              confidence: "medium" as const
            }
          ]
        };
      }
    },
    {
      id: "dvqr.trust.model",
      title: "Trust Assessment",
      run: () => ({
        sections: [
          {
            heading: "Design Notes",
            lines: buildDesignNotes(parsed),
            confidence: "high" as const,
            sourceContributor: "dvqr.trust.model"
          },
          {
            heading: "Trust Model",
            lines: [
              "- Clause explanations are based on parsed OData query structure.",
              "- Dataverse-specific hints are applied only for recognised patterns and common system fields.",
              "- Unknown query options are preserved and shown rather than silently ignored.",
              "- Query Doctor recommendations are advisory and do not claim root cause certainty."
            ],
            confidence: "high" as const,
            sourceContributor: "dvqr.trust.model"
          }
        ]
      })
    }
  ];
}

export async function toExplainResult(
  parsed: ParsedDataverseQuery,
  entity: EntityDef | undefined,
  validationIssues: ValidationIssue[] = [],
  relationshipReasoningNotes: ExplainRelationshipReasoningNote[] = [],
  diagnostics?: DiagnosticResult,
  executionEvidence?: ExecutionEvidence,
  choiceMetadata: ChoiceMetadataDef[] = [],
  lookupUnderstanding: ExplainLookupUnderstanding[] = []
): Promise<ExplainResult> {
  return await runExplainEngine(
    "DV Quick Run - Explain Query",
    {
      subjectKind: "odata",
      sourceText: parsed.normalized,
      entityLogicalName: entity?.logicalName,
      entitySetName: parsed.entitySetName
    },
    buildQueryExplainContributors(parsed, entity, validationIssues, relationshipReasoningNotes, diagnostics, executionEvidence, choiceMetadata, lookupUnderstanding)
  );
}

export async function toExplainMarkdown(
  parsed: ParsedDataverseQuery,
  entity: EntityDef | undefined,
  validationIssues: ValidationIssue[] = [],
  relationshipReasoningNotes: ExplainRelationshipReasoningNote[] = [],
  diagnostics?: DiagnosticResult,
  executionEvidence?: ExecutionEvidence,
  choiceMetadata: ChoiceMetadataDef[] = [],
  lookupUnderstanding: ExplainLookupUnderstanding[] = []
): Promise<string> {
  const result = await toExplainResult(
    parsed,
    entity,
    validationIssues,
    relationshipReasoningNotes,
    diagnostics,
    executionEvidence,
    choiceMetadata,
    lookupUnderstanding
  );

  const understanding = buildODataQueryUnderstandingDocument(result, parsed, entity, diagnostics, executionEvidence);

  return renderUnderstandingDocumentMarkdown(understanding);
}
