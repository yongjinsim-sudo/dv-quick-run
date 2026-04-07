import * as vscode from "vscode";
import type { CommandContext } from "../../../../context/commandContext.js";
import { loadEntityDefByLogicalName } from "../../shared/metadataAccess.js";
import { buildIdentifierResolutionCandidates } from "./identifierResolutionCandidateBuilder.js";
import type {
  IdentifierResolutionMatch,
  IdentifierResolutionRequest,
  IdentifierResolutionResult
} from "./identifierResolutionTypes.js";

const MAX_QUERIES = 25;

export async function resolveIdentifierOwnership(
  ctx: CommandContext,
  request: IdentifierResolutionRequest
): Promise<IdentifierResolutionResult> {
  const trimmedValue = request.value.trim();
  if (!trimmedValue) {
    return { outcome: "unresolved", message: "No identifier value provided." };
  }

  const { candidates, searchedEntityLogicalNames, missingAllowedTables } = await buildIdentifierResolutionCandidates(ctx, request);

  if (missingAllowedTables) {
    return {
      outcome: "missingAllowedTables",
      searchedEntityLogicalNames
    };
  }

  if (!candidates.length) {
    return {
      outcome: "unresolved",
      searchedEntityLogicalNames
    };
  }

  const client = ctx.getClient();
  const token = await ctx.getToken(ctx.getScope());
  const matches: IdentifierResolutionMatch[] = [];
  let queryCount = 0;

  for (const candidate of candidates) {
    if (queryCount >= MAX_QUERIES) {
      break;
    }

    queryCount += 1;

    const entityDef = await loadEntityDefByLogicalName(ctx, client, token, candidate.entityLogicalName);
    const primaryIdField = entityDef?.primaryIdAttribute;
    if (!primaryIdField) {
      continue;
    }

    const escapedValue = formatODataLiteral(trimmedValue, candidate.attributeType);
    const query = `/${candidate.entitySetName}?$select=${primaryIdField}${entityDef?.primaryNameAttribute ? `,${entityDef.primaryNameAttribute}` : ""}&$filter=${candidate.fieldLogicalName} eq ${escapedValue}&$top=2`;

    try {
      const response = await client.get(query, token) as { value?: Array<Record<string, unknown>> };
      const rows = Array.isArray(response.value) ? response.value : [];
      for (const row of rows) {
        const recordId = String(row[primaryIdField] ?? "").trim();
        if (!recordId) {
          continue;
        }

        matches.push({
          entityLogicalName: candidate.entityLogicalName,
          entitySetName: candidate.entitySetName,
          matchedField: candidate.fieldLogicalName,
          primaryIdField,
          primaryNameField: entityDef?.primaryNameAttribute,
          primaryNameValue: entityDef?.primaryNameAttribute ? String(row[entityDef.primaryNameAttribute] ?? "").trim() || undefined : undefined,
          recordId,
          confidence: candidate.score >= 200 ? "high" : "medium",
          reason: candidate.reason
        });
      }

      if (rows.length === 1 && candidate.score >= 200) {
        return {
          outcome: "resolved",
          resolved: matches[matches.length - 1],
          searchedEntityLogicalNames,
          queriedFieldCount: queryCount
        };
      }
    } catch {
      // Best-effort; continue to next candidate.
    }
  }

  const uniqueMatches = dedupeMatches(matches);

  if (uniqueMatches.length === 1) {
    return {
      outcome: "resolved",
      resolved: uniqueMatches[0],
      searchedEntityLogicalNames,
      queriedFieldCount: queryCount
    };
  }

  if (uniqueMatches.length > 1) {
    const picked = await pickResolutionMatch(uniqueMatches);
    if (picked) {
      return {
        outcome: "resolved",
        resolved: picked,
        matches: uniqueMatches,
        searchedEntityLogicalNames,
        queriedFieldCount: queryCount
      };
    }

    return {
      outcome: "multipleMatches",
      matches: uniqueMatches,
      searchedEntityLogicalNames,
      queriedFieldCount: queryCount
    };
  }

  return {
    outcome: "unresolved",
    searchedEntityLogicalNames,
    queriedFieldCount: queryCount
  };
}

function formatODataLiteral(value: string, attributeType?: string): string {
  const type = String(attributeType ?? "").trim().toLowerCase();
  if (type === "uniqueidentifier") {
    return value;
  }

  return `'${value.replace(/'/g, "''")}'`;
}

function dedupeMatches(matches: IdentifierResolutionMatch[]): IdentifierResolutionMatch[] {
  const byKey = new Map<string, IdentifierResolutionMatch>();
  for (const match of matches) {
    const key = `${match.entityLogicalName}|${match.matchedField}|${match.recordId}`;
    if (!byKey.has(key)) {
      byKey.set(key, match);
    }
  }

  return [...byKey.values()].sort((a, b) => {
    const confidenceCompare = confidenceWeight(b.confidence) - confidenceWeight(a.confidence);
    if (confidenceCompare !== 0) {
      return confidenceCompare;
    }

    return a.entityLogicalName.localeCompare(b.entityLogicalName)
      || a.matchedField.localeCompare(b.matchedField)
      || a.recordId.localeCompare(b.recordId);
  });
}

function confidenceWeight(value: "high" | "medium"): number {
  return value === "high" ? 2 : 1;
}

async function pickResolutionMatch(matches: IdentifierResolutionMatch[]): Promise<IdentifierResolutionMatch | undefined> {
  const picked = await vscode.window.showQuickPick(matches.map((match) => ({
    label: match.entityLogicalName,
    description: match.matchedField,
    detail: [match.primaryNameValue, match.recordId, `confidence: ${match.confidence}`].filter(Boolean).join(" | "),
    match
  })), {
    placeHolder: "Multiple matching records found. Select which record to investigate"
  });

  return picked?.match;
}
