export interface DvqrMetadataEntityCandidate {
  readonly LogicalName?: unknown;
  readonly SchemaName?: unknown;
  readonly EntitySetName?: unknown;
  readonly DisplayName?: unknown;
  readonly Description?: unknown;
  readonly PrimaryIdAttribute?: unknown;
  readonly PrimaryNameAttribute?: unknown;
  readonly IsCustomEntity?: unknown;
  readonly IsManaged?: unknown;
  readonly OwnershipType?: unknown;
}

export interface DvqrMetadataSearchResult {
  readonly logicalName: string;
  readonly schemaName?: string;
  readonly entitySetName?: string;
  readonly displayName?: string;
  readonly description?: string;
  readonly primaryIdAttribute?: string;
  readonly primaryNameAttribute?: string;
  readonly isCustomEntity?: boolean;
  readonly isManaged?: boolean;
  readonly ownershipType?: string;
  readonly score: number;
  readonly confidence: "high" | "medium" | "low";
  readonly matchedTerms: readonly string[];
  readonly reasons: readonly string[];
  readonly resultTier: "highest-confidence" | "related" | "contextual";
  readonly recommendation: string;
}

const CONCEPT_ALIASES: Readonly<Record<string, readonly string[]>> = {
  employee: ["employee", "user", "systemuser", "team", "businessunit", "position", "worker", "staff", "personnel"],
  employees: ["employee", "user", "systemuser", "team", "businessunit", "position", "worker", "staff", "personnel"],
  user: ["user", "systemuser", "team", "businessunit"],
  users: ["user", "systemuser", "team", "businessunit"],
  customer: ["customer", "account", "contact"],
  customers: ["customer", "account", "contact"],
  company: ["company", "account", "organisation", "organization"],
  companies: ["company", "account", "organisation", "organization"],
  organisation: ["organisation", "organization", "account", "businessunit"],
  organization: ["organization", "organisation", "account", "businessunit"],
  case: ["case", "incident", "ticket"],
  cases: ["case", "incident", "ticket"],
  ticket: ["ticket", "incident", "case"],
  appointment: ["appointment", "activity", "calendar", "meeting"],
  appointments: ["appointment", "activity", "calendar", "meeting"],
  task: ["task", "activity", "todo", "workitem"],
  tasks: ["task", "activity", "todo", "workitem"],
  product: ["product", "catalog", "pricelevel"],
  products: ["product", "catalog", "pricelevel"],
  invoice: ["invoice", "billing", "transaction", "order"],
  invoices: ["invoice", "billing", "transaction", "order"],
  security: ["security", "role", "privilege", "systemuser", "team", "businessunit"],
  owner: ["owner", "systemuser", "team"],
  audit: ["audit", "change", "history"],
  revenue: ["revenue", "account", "opportunity", "invoice", "quote"],
  patient: ["patient", "contact", "careplan", "clinical", "healthcare"],
  patients: ["patient", "contact", "careplan", "clinical", "healthcare"]
};

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function localisedLabel(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return text(value);
  }
  const record = value as Record<string, unknown>;
  const userLabel = record.UserLocalizedLabel;
  if (userLabel && typeof userLabel === "object" && !Array.isArray(userLabel)) {
    const label = text((userLabel as Record<string, unknown>).Label);
    if (label) {
      return label;
    }
  }
  const labels = record.LocalizedLabels;
  if (Array.isArray(labels)) {
    for (const candidate of labels) {
      if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
        const label = text((candidate as Record<string, unknown>).Label);
        if (label) {
          return label;
        }
      }
    }
  }
  return undefined;
}

function normalize(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLocaleLowerCase("en-GB")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return [...new Set(normalize(value).split(/\s+/).filter((part) => part.length > 1))];
}

export function expandDvqrMetadataSearchTerms(query: string): readonly string[] {
  const baseTerms = tokenize(query);
  const expanded = new Set(baseTerms);
  for (const term of baseTerms) {
    for (const alias of CONCEPT_ALIASES[term] ?? []) {
      expanded.add(normalize(alias));
    }
  }
  return [...expanded];
}

function includesTerm(value: string | undefined, term: string): boolean {
  return Boolean(value && normalize(value).includes(term));
}

function confidence(score: number): "high" | "medium" | "low" {
  return score >= 85 ? "high" : score >= 55 ? "medium" : "low";
}

function resultTier(score: number): "highest-confidence" | "related" | "contextual" {
  return score >= 85 ? "highest-confidence" : score >= 55 ? "related" : "contextual";
}

function recommendation(logicalName: string, displayName: string | undefined, tier: "highest-confidence" | "related" | "contextual"): string {
  const label = displayName ?? logicalName;
  if (tier === "highest-confidence") return `${label} is a primary deterministic match for the requested concept.`;
  if (tier === "related") return `${label} is related through explicit metadata or the bounded Dataverse concept catalogue.`;
  return `${label} is contextual; verify its operational relevance before using it.`;
}

export function rankDvqrMetadataEntities(
  query: string,
  candidates: readonly DvqrMetadataEntityCandidate[],
  maxResults = 10
): readonly DvqrMetadataSearchResult[] {
  const directTerms = tokenize(query);
  const expandedTerms = expandDvqrMetadataSearchTerms(query);
  if (directTerms.length === 0) {
    return [];
  }

  const ranked: DvqrMetadataSearchResult[] = [];
  for (const candidate of candidates) {
    const logicalName = text(candidate.LogicalName);
    if (!logicalName) {
      continue;
    }
    const schemaName = text(candidate.SchemaName);
    const entitySetName = text(candidate.EntitySetName);
    const displayName = localisedLabel(candidate.DisplayName);
    const description = localisedLabel(candidate.Description);
    const logicalNormalized = normalize(logicalName);
    const schemaNormalized = normalize(schemaName ?? "");
    const setNormalized = normalize(entitySetName ?? "");
    const displayNormalized = normalize(displayName ?? "");
    const descriptionNormalized = normalize(description ?? "");

    let score = 0;
    const matchedTerms = new Set<string>();
    const reasons: string[] = [];

    for (const term of directTerms) {
      if (logicalNormalized === term || schemaNormalized === term || displayNormalized === term) {
        score += 100;
        matchedTerms.add(term);
        reasons.push(`Exact metadata-name match for “${term}”.`);
      } else {
        if (logicalNormalized.includes(term)) {
          score += 70;
          matchedTerms.add(term);
          reasons.push(`Logical name contains “${term}”.`);
        }
        if (schemaNormalized.includes(term)) {
          score += 60;
          matchedTerms.add(term);
          reasons.push(`Schema name contains “${term}”.`);
        }
        if (displayNormalized.includes(term)) {
          score += 65;
          matchedTerms.add(term);
          reasons.push(`Display name contains “${term}”.`);
        }
        if (setNormalized.includes(term)) {
          score += 45;
          matchedTerms.add(term);
          reasons.push(`Entity-set name contains “${term}”.`);
        }
        if (descriptionNormalized.includes(term)) {
          score += 20;
          matchedTerms.add(term);
          reasons.push(`Description contains “${term}”.`);
        }
      }
    }

    for (const term of expandedTerms) {
      if (directTerms.includes(term)) {
        continue;
      }
      if (logicalNormalized === term || schemaNormalized === term || displayNormalized === term) {
        score += 45;
        matchedTerms.add(term);
        reasons.push(`Deterministic Dataverse concept match for “${term}”.`);
      } else if (
        includesTerm(logicalName, term) ||
        includesTerm(schemaName, term) ||
        includesTerm(displayName, term) ||
        includesTerm(entitySetName, term)
      ) {
        score += 28;
        matchedTerms.add(term);
        reasons.push(`Related Dataverse concept contains “${term}”.`);
      } else if (includesTerm(description, term)) {
        score += 10;
        matchedTerms.add(term);
        reasons.push(`Description relates to “${term}”.`);
      }
    }

    if (score <= 0) {
      continue;
    }

    // Prevent a broad concept expansion from outranking a direct metadata-name match.
    const boundedScore = Math.min(100, score);
    ranked.push({
      logicalName,
      schemaName,
      entitySetName,
      displayName,
      description,
      primaryIdAttribute: text(candidate.PrimaryIdAttribute),
      primaryNameAttribute: text(candidate.PrimaryNameAttribute),
      isCustomEntity: typeof candidate.IsCustomEntity === "boolean" ? candidate.IsCustomEntity : undefined,
      isManaged: typeof candidate.IsManaged === "boolean" ? candidate.IsManaged : undefined,
      ownershipType: text(candidate.OwnershipType),
      score: boundedScore,
      confidence: confidence(boundedScore),
      matchedTerms: [...matchedTerms],
      reasons: [...new Set(reasons)].slice(0, 5),
      resultTier: resultTier(boundedScore),
      recommendation: recommendation(logicalName, displayName, resultTier(boundedScore))
    });
  }

  return ranked
    .sort((left, right) => right.score - left.score || left.logicalName.localeCompare(right.logicalName))
    .slice(0, Math.max(1, Math.min(50, Math.floor(maxResults))));
}
