import { InvestigationInput } from "./types.js";
import { extractInvestigationCandidatesFromJson } from "./investigationCandidateExtractor.js";
import { pickInvestigationCandidate } from "./investigationCandidatePicker.js";
import { scoreInvestigationCandidates } from "./investigationCandidateScorer.js";
import { extractInvestigationCandidatesFromSelection } from "./investigationSelectionExtractor.js";

const GUID_REGEX =
  /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/;

const RECORD_PATH_REGEX =
  /([A-Za-z_][A-Za-z0-9_]*)\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)/i;

export async function resolveInvestigationInput(
  rawText: string,
  fullDocumentText?: string,
  selectionStartOffset?: number
): Promise<InvestigationInput | undefined> {
  const text = rawText.trim();
  if (!text) {
    return undefined;
  }

  const contextUrl = tryExtractRelevantODataContext(text, fullDocumentText, selectionStartOffset);
  const {
    entitySetName,
    primaryIdFieldHint
  } = extractEntitySetAndPrimaryIdHintFromODataContext(contextUrl);

  // Selection-first candidate extraction
  const selectionCandidates = extractInvestigationCandidatesFromSelection(
    text,
    entitySetName
  );

  if (selectionCandidates.length > 0) {
    const scoredSelectionCandidates = scoreInvestigationCandidates(
      selectionCandidates,
      {
        entityLogicalName: undefined,
        primaryIdField: primaryIdFieldHint,
        entitySetName
      }
    );

    const chosenSelectionCandidate = await pickInvestigationCandidate(
      scoredSelectionCandidates
    );

    if (chosenSelectionCandidate?.recordId) {
      return {
        type: "json",
        rawText: text,
        recordId: chosenSelectionCandidate.recordId,
        entitySetName,
        sourceJson: tryParseSelectionObject(text),

        selectedCandidateFieldName: chosenSelectionCandidate.fieldName,
        selectedCandidateType: chosenSelectionCandidate.candidateType,
        selectedCandidateConfidence: chosenSelectionCandidate.confidence,
        selectedCandidateReason: chosenSelectionCandidate.reason
      };
    }
  }

  const jsonInput = await tryParseJsonInput(text);
  if (jsonInput) {
    return jsonInput;
  }

  const recordPathMatch = text.match(RECORD_PATH_REGEX);
  if (recordPathMatch) {
    return {
      type: "recordPath",
      rawText: text,
      entitySetName: recordPathMatch[1],
      recordId: recordPathMatch[2],
      sourcePath: text
    };
  }

  const guidMatch = text.match(GUID_REGEX);
  if (guidMatch) {
    return {
      type: "guid",
      rawText: text,
      recordId: guidMatch[0]
    };
  }

  return undefined;
}

async function tryParseJsonInput(text: string): Promise<InvestigationInput | undefined> {
  try {
    const normalizedText = normalizeJsonInput(text);
    const parsed = JSON.parse(normalizedText) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }

    const root = parsed as Record<string, unknown>;
    const contextUrl = asNonEmptyString(root["@odata.context"]);
    const {
      entitySetName,
      primaryIdFieldHint
    } = extractEntitySetAndPrimaryIdHintFromODataContext(contextUrl);

    const directEntityLogicalName = extractEntityLogicalNameFromJson(root);
    const firstCollectionRecord = tryGetFirstCollectionRecord(root);
    const candidates = extractInvestigationCandidatesFromJson(root, entitySetName);

    const scoredCandidates = scoreInvestigationCandidates(candidates, {
      entityLogicalName: directEntityLogicalName,
      primaryIdField: primaryIdFieldHint,
      entitySetName
    });

    const chosenCandidate = await pickInvestigationCandidate(scoredCandidates);
    if (!chosenCandidate?.recordId) {
      return undefined;
    }

    const sourceJson =
      chosenCandidate.sourceIndex !== undefined
        ? tryGetCollectionRecordByIndex(root, chosenCandidate.sourceIndex) ??
          firstCollectionRecord ??
          root
        : firstCollectionRecord ?? root;

    return {
      type: "json",
      rawText: text,
      recordId: chosenCandidate.recordId,
      entityLogicalName: directEntityLogicalName,
      entitySetName,
      sourceJson,

      selectedCandidateFieldName: chosenCandidate.fieldName,
      selectedCandidateType: chosenCandidate.candidateType,
      selectedCandidateConfidence: chosenCandidate.confidence,
      selectedCandidateReason: chosenCandidate.reason
    };
  } catch {
    return undefined;
  }
}

function normalizeJsonInput(text: string): string {
  const trimmed = text.trim();

  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    const extracted = tryExtractJsonObjectBlock(trimmed);
    if (extracted) {
      return extracted;
    }

    return trimmed;
  }
}

function tryGetFirstCollectionRecord(
  root: Record<string, unknown>
): Record<string, unknown> | undefined {
  return tryGetCollectionRecordByIndex(root, 0);
}

function tryGetCollectionRecordByIndex(
  root: Record<string, unknown>,
  index: number
): Record<string, unknown> | undefined {
  const value = root["value"];
  if (!Array.isArray(value) || index < 0 || index >= value.length) {
    return undefined;
  }

  const item = value[index];
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return undefined;
  }

  return item as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function extractEntitySetAndPrimaryIdHintFromODataContext(contextUrl?: string): {
  entitySetName?: string;
  primaryIdFieldHint?: string;
} {
  if (!contextUrl) {
    return {};
  }

  const hashIndex = contextUrl.indexOf("#");
  if (hashIndex < 0 || hashIndex >= contextUrl.length - 1) {
    return {};
  }

  const fragment = contextUrl.slice(hashIndex + 1).trim();

  // Matches: contacts(contactid) OR contacts(fullname,emailaddress1,contactid)
  const collectionWithProjectionMatch = fragment.match(
    /^([A-Za-z_][A-Za-z0-9_]*)\(([^)]+)\)$/
  );
  if (collectionWithProjectionMatch) {
    const entitySetName = collectionWithProjectionMatch[1];
    const projectionTokens = collectionWithProjectionMatch[2]
      .split(",")
      .map(token => token.trim())
      .filter(Boolean);

    if (
      projectionTokens.length === 1 &&
      /^[A-Za-z_][A-Za-z0-9_]*$/.test(projectionTokens[0])
    ) {
      return {
        entitySetName,
        primaryIdFieldHint: projectionTokens[0]
      };
    }

    return { entitySetName };
  }

  // Matches: contacts/$entity
  const entityMatch = fragment.match(/^([A-Za-z_][A-Za-z0-9_]*)\/\$entity$/);
  if (entityMatch) {
    return {
      entitySetName: entityMatch[1]
    };
  }

  // Matches: contacts
  const collectionMatch = fragment.match(/^([A-Za-z_][A-Za-z0-9_]*)$/);
  if (collectionMatch) {
    return {
      entitySetName: collectionMatch[1]
    };
  }

  return {};
}

function extractEntityLogicalNameFromJson(
  json: Record<string, unknown>
): string | undefined {
  const possibleKeys = [
    "@logicalName",
    "logicalName",
    "entityLogicalName",
    "_entitylogicalname"
  ];

  for (const key of possibleKeys) {
    const value = json[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function tryExtractJsonObjectBlock(text: string): string | undefined {
  const start = text.indexOf("{");
  if (start < 0) {
    return undefined;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      continue;
    }

    if (ch === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;

      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return undefined;
}

function tryExtractRelevantODataContext(
  selectedText: string,
  fullDocumentText?: string,
  selectionStartOffset?: number
): string | undefined {
  const selectedMatch = tryExtractODataContext(selectedText);
  if (selectedMatch) {
    return selectedMatch;
  }

  if (!fullDocumentText?.trim()) {
    return undefined;
  }

  if (typeof selectionStartOffset === "number" && selectionStartOffset >= 0) {
    const beforeSelection = fullDocumentText.slice(0, selectionStartOffset);
    const nearestBefore = tryExtractLastODataContext(beforeSelection);
    if (nearestBefore) {
      return nearestBefore;
    }

    const afterSelection = fullDocumentText.slice(selectionStartOffset);
    const nearestAfter = tryExtractODataContext(afterSelection);
    if (nearestAfter) {
      return nearestAfter;
    }
  }

  return tryExtractLastODataContext(fullDocumentText);
}

function tryExtractODataContext(text: string): string | undefined {
  const match = text.match(/"@odata\.context"\s*:\s*"([^"]+)"/);
  return match?.[1];
}

function tryExtractLastODataContext(text: string): string | undefined {
  const regex = /"@odata\.context"\s*:\s*"([^"]+)"/g;
  let last: string | undefined;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    last = match[1];
  }

  return last;
}

function tryParseSelectionObject(text: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(text);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }

    return undefined;
  } catch {
    return undefined;
  }
}
