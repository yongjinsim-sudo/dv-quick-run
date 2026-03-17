import type { ValidationIssue } from "../shared/queryExplain/queryValidation.js";
import type { ExplainRelationshipReasoningNote } from "./explainQueryTypes.js";

const RELATED_FIELD_PATTERN = /^Field `([^`]+)` in (\$select|\$orderby) was not found on `([^`]+)`\. It exists on related entity `([^`]+)`\.$/;

export function deriveRelationshipReasoningNotes(
  validationIssues: ValidationIssue[]
): ExplainRelationshipReasoningNote[] {
  const notes: ExplainRelationshipReasoningNote[] = [];

  for (const issue of validationIssues) {
    const match = issue.message.match(RELATED_FIELD_PATTERN);
    if (!match) {
      continue;
    }

    const [, fieldToken, clauseText, baseEntity, relatedEntity] = match;
    const clause: "$select" | "$orderby" = clauseText === "$orderby" ? "$orderby" : "$select";
    const suggestion = typeof issue.suggestion === "string" && issue.suggestion.trim()
      ? issue.suggestion.trim()
      : undefined;

    notes.push({
      clause,
      field: fieldToken,
      baseEntity,
      relatedEntity,
      summary: `Field \`${fieldToken}\` appears to belong to related entity \`${relatedEntity}\`, not \`${baseEntity}\`.`,
      suggestion
    });
  }

  return notes;
}
