import { parseEditorQuery } from "../../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";

const navHoverEnrichmentCache = new Map<
  string,
  {
    exampleExpand?: string;
    suggestedFields?: string[];
    targetEntitySetName?: string;
  }
>();

export function getExpandValue(queryText: string): string | undefined {
  const parsed = parseEditorQuery(queryText);
  return parsed.queryOptions.get("$expand") ?? undefined;
}

export function tokenAppearsInExpand(queryText: string, token: string): boolean {
  const expand = getExpandValue(queryText);
  if (!expand) {
    return false;
  }

  return expand.toLowerCase().includes(token.trim().toLowerCase());
}

export function pickPreferredExampleField(fieldLogicalNames: string[]): string | undefined {
  const lowered = new Map(fieldLogicalNames.map((name) => [name.toLowerCase(), name]));

  return (
    lowered.get("fullname") ??
    lowered.get("name") ??
    lowered.get("subject") ??
    lowered.get("title") ??
    lowered.get("domainname") ??
    lowered.get("internalemailaddress") ??
    lowered.get("emailaddress1") ??
    lowered.get("telephone1") ??
    lowered.get("accountnumber") ??
    lowered.get("currencyname") ??
    lowered.get("isocurrencycode") ??
    fieldLogicalNames[0]
  );
}

export function pickSuggestedFields(fieldLogicalNames: string[]): string[] {
  const preferredOrder = [
    "fullname",
    "name",
    "subject",
    "title",
    "domainname",
    "internalemailaddress",
    "emailaddress1",
    "telephone1",
    "accountnumber",
    "currencyname",
    "isocurrencycode",
    "firstname",
    "lastname"
  ];

  const lowered = new Map(fieldLogicalNames.map((name) => [name.toLowerCase(), name]));
  const preferred = preferredOrder
    .map((name) => lowered.get(name))
    .filter((name): name is string => !!name);

  const remaining = fieldLogicalNames.filter(
    (name) => !preferred.some((p) => p.toLowerCase() === name.toLowerCase())
  );

  return [...preferred, ...remaining].slice(0, 5);
}

export function getCachedNavigationHoverEnrichment(cacheKey: string): {
  exampleExpand?: string;
  suggestedFields?: string[];
  targetEntitySetName?: string;
} | undefined {
  return navHoverEnrichmentCache.get(cacheKey);
}

export function setCachedNavigationHoverEnrichment(
  cacheKey: string,
  value: {
    exampleExpand?: string;
    suggestedFields?: string[];
    targetEntitySetName?: string;
  }
): void {
  navHoverEnrichmentCache.set(cacheKey, value);
}

export function clearNavigationHoverEnrichmentCache(): void {
  navHoverEnrichmentCache.clear();
}
