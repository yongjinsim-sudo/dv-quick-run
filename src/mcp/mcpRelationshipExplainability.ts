import type { McpRankedRelationshipPath, McpRelationshipEdge } from "./mcpRelationshipIntelligence.js";

export type RelationshipCategory = "Activities" | "CRM" | "Security" | "Hierarchy" | "General";

const CATEGORY_LABELS: Record<RelationshipCategory, string> = {
  Activities: "Activity Relationship",
  CRM: "CRM Relationship",
  Security: "Security Relationship",
  Hierarchy: "Hierarchy Relationship",
  General: "Dataverse Relationship"
};

export interface McpRelationshipPurpose {
  readonly category: RelationshipCategory;
  readonly categoryLabel: string;
  readonly label: string;
  readonly businessMeaning: string;
  readonly educationalTip?: string;
}

export interface McpPathExplainability {
  readonly confidence: number;
  readonly confidenceKind: "MetadataConfidence";
  readonly confidenceLabel: "Very High" | "High" | "Moderate" | "Low";
  readonly rating: 1 | 2 | 3 | 4 | 5;
  readonly ratingStars: string;
  readonly confidenceDisplay: string;
  readonly businessConfidence: "UnknownFromMetadata";
  readonly purpose: McpRelationshipPurpose;
  readonly whySelected: readonly string[];
  readonly whyNotFirst: readonly string[];
  readonly scoring: readonly { code: string; points: number; message: string }[];
}

const normalize = (value?: string) => (value ?? "").trim().toLowerCase();

export function describeRelationshipPurpose(edge: McpRelationshipEdge): McpRelationshipPurpose {
  const attribute = normalize(edge.referencingAttribute);
  const navigation = normalize(edge.navigationProperty);
  const schema = normalize(edge.relationshipSchemaName);
  const token = `${attribute} ${navigation} ${schema}`;

  if (token.includes("regardingobjectid") || token.includes("_tasks") || token.includes("activity")) {
    return {
      category: "Activities",
      categoryLabel: CATEGORY_LABELS.Activities,
      label: "Activity association",
      businessMeaning: `Connects ${edge.fromTable} to ${edge.toTable} through an activity relationship, commonly used for records that are regarding another Dataverse row.`,
      educationalTip: "Regarding relationships are polymorphic; inspect the runtime lookup logical name when row-level target identity matters."
    };
  }
  if (token.includes("ownerid") || token.includes("owninguser") || token.includes("owningteam")) {
    return {
      category: "Security",
      categoryLabel: CATEGORY_LABELS.Security,
      label: "Record ownership",
      businessMeaning: `Represents the user or team ownership relationship for ${edge.fromTable}.`,
      educationalTip: "Owner lookups can resolve to either systemuser or team."
    };
  }
  if (token.includes("businessunit")) {
    return {
      category: "Security",
      categoryLabel: CATEGORY_LABELS.Security,
      label: "Business unit boundary",
      businessMeaning: "Represents organisational placement used by Dataverse security and ownership models."
    };
  }
  if (token.includes("parentcustomerid")) {
    return {
      category: "CRM",
      categoryLabel: CATEGORY_LABELS.CRM,
      label: "Parent customer",
      businessMeaning: `Represents the parent customer associated with ${edge.fromTable}; the target may be an Account or Contact.`,
      educationalTip: "Customer lookups require target-specific navigation properties such as parentcustomerid_account or parentcustomerid_contact."
    };
  }
  if (token.includes("primarycontact")) {
    return {
      category: "CRM",
      categoryLabel: CATEGORY_LABELS.CRM,
      label: "Primary contact",
      businessMeaning: `Represents the Account for which this Contact is configured as the primary contact, or the primary Contact selected on an Account.`
    };
  }
  if (token.includes("parent") || token.includes("child")) {
    return {
      category: "Hierarchy",
      categoryLabel: CATEGORY_LABELS.Hierarchy,
      label: "Parent-child relationship",
      businessMeaning: `Represents a hierarchical relationship between ${edge.fromTable} and ${edge.toTable}.`
    };
  }
  return {
    category: "General",
    categoryLabel: CATEGORY_LABELS.General,
    label: "Metadata relationship",
    businessMeaning: `Connects ${edge.fromTable} to ${edge.toTable} through the verified navigation property ${edge.navigationProperty}.`
  };
}

function confidenceLabel(score: number): McpPathExplainability["confidenceLabel"] {
  if (score >= 90) { return "Very High"; }
  if (score >= 75) { return "High"; }
  if (score >= 55) { return "Moderate"; }
  return "Low";
}

function rating(score: number): 1 | 2 | 3 | 4 | 5 {
  if (score >= 90) { return 5; }
  if (score >= 75) { return 4; }
  if (score >= 55) { return 3; }
  if (score >= 35) { return 2; }
  return 1;
}

export function explainRelationshipPath(path: McpRankedRelationshipPath, options: { relationshipHintHonoured?: boolean; rank?: number } = {}): McpPathExplainability {
  const first = path.hops[0];
  const purpose = first ? describeRelationshipPurpose(first) : { category: "General" as const, categoryLabel: CATEGORY_LABELS.General, label: "Metadata relationship", businessMeaning: "Verified Dataverse relationship path." };
  const scoring = [
    ...path.reasons.map((reason) => ({ ...reason })),
    ...path.penalties.map((penalty) => ({ ...penalty })),
    ...(options.relationshipHintHonoured ? [{ code: "explicit_relationship_honoured", points: 15, message: "The explicitly requested lookup, navigation property, or relationship schema was honoured." }] : [])
  ];
  const confidence = Math.max(0, Math.min(100, path.score + (options.relationshipHintHonoured ? 0 : 0)));
  const whySelected = [
    ...(options.relationshipHintHonoured ? ["Explicit relationship intent was honoured."] : []),
    ...(path.hops.length === 1 ? ["Direct metadata relationship with no bridge table."] : [`Verified ${path.hops.length}-hop metadata path.`]),
    ...(path.hops.every((hop) => !!hop.navigationProperty) ? ["Every navigation property is metadata verified."] : []),
    ...(path.bridgeTables.length === 0 ? ["Lowest traversal complexity for this path shape."] : [`Uses ${path.bridgeTables.length} bridge table${path.bridgeTables.length === 1 ? "" : "s"}: ${path.bridgeTables.join(", ")}.`])
  ];
  const whyNotFirst = (options.rank ?? 1) <= 1 ? [] : [
    ...(path.hops.length > 1 ? [`Requires ${path.hops.length - 1} additional hop${path.hops.length === 2 ? "" : "s"}.`] : []),
    ...path.penalties.map((penalty) => penalty.message)
  ];
  const confidenceRating = rating(confidence);
  const label = confidenceLabel(confidence);
  return {
    confidence,
    confidenceKind: "MetadataConfidence",
    confidenceLabel: label,
    rating: confidenceRating,
    ratingStars: `${"★".repeat(confidenceRating)}${"☆".repeat(5 - confidenceRating)}`,
    confidenceDisplay: `${"★".repeat(confidenceRating)}${"☆".repeat(5 - confidenceRating)} ${label}`,
    businessConfidence: "UnknownFromMetadata",
    purpose,
    whySelected,
    whyNotFirst,
    scoring
  };
}
