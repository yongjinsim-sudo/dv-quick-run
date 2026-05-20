import type { DataverseClient } from "../../services/dataverseClient.js";
import type {
  OperationalContextEvidence,
  OperationalContextProvider,
  OperationalContextProviderRequest,
  OperationalContextProviderResult,
  OperationalContextSectionViewModel,
  OperationalContextSubject,
  OperationalContextViewModel
} from "./operationalContextTypes.js";

const MAX_RENDERED_EVIDENCE_PER_PROVIDER = 3;

function normaliseProviderResult(
  provider: OperationalContextProvider,
  result: OperationalContextProviderResult
): OperationalContextProviderResult {
  return {
    providerId: result.providerId || provider.id,
    label: result.label || provider.label,
    evidence: result.evidence.slice(0, MAX_RENDERED_EVIDENCE_PER_PROVIDER),
    unavailableReason: result.unavailableReason
  };
}

function providerFailureResult(provider: OperationalContextProvider, error: unknown): OperationalContextProviderResult {
  const detail = error instanceof Error && error.message.trim().length > 0
    ? error.message.trim()
    : "The provider did not return operational context.";

  return {
    providerId: provider.id,
    label: provider.label,
    evidence: [],
    unavailableReason: detail
  };
}

function summariseSection(result: OperationalContextProviderResult): string {
  if (result.evidence.length === 0) {
    return result.unavailableReason ?? "No contextual evidence was returned for this provider.";
  }

  if (result.evidence.length === 1) {
    return result.evidence[0]?.summary ?? "One contextual evidence item was returned.";
  }

  return `${result.evidence.length} contextual evidence items were returned. Participation is context only, not causality.`;
}

function toSection(result: OperationalContextProviderResult): OperationalContextSectionViewModel {
  return {
    id: result.providerId,
    label: result.label,
    summary: summariseSection(result),
    evidence: result.evidence,
    unavailableReason: result.unavailableReason
  };
}

function buildGuardrails(): string[] {
  return [
    "Operational Context is scoped to the current investigation subject.",
    "Default context remains one-hop; curated semantic expansions must be explicit and provider-owned.",
    "Participation does not imply causality.",
    "Runtime actor identities are preserved as observed and are not collapsed.",
    "Audit timelines, chronology reconstruction, behavioural drift, and RCA narratives are out of scope for v0.11.x."
  ];
}

export async function buildOperationalContextViewModel(args: {
  subject: OperationalContextSubject;
  providers: readonly OperationalContextProvider[];
  dataverse?: {
    client: DataverseClient;
    token: string;
  };
}): Promise<OperationalContextViewModel> {
  const request: OperationalContextProviderRequest = {
    subject: args.subject,
    maxExpansionDepth: 1,
    allowSemanticExpansion: true,
    dataverse: args.dataverse
  };

  const results = await Promise.all(args.providers.map(async (provider) => {
    try {
      return normaliseProviderResult(provider, await provider.collect(request));
    } catch (error) {
      return providerFailureResult(provider, error);
    }
  }));

  return {
    subject: args.subject,
    sections: results.map(toSection),
    guardrails: buildGuardrails()
  };
}

export function createOperationalContextProviderResult(args: {
  providerId: string;
  label: string;
  evidence?: OperationalContextEvidence[];
  unavailableReason?: string;
}): OperationalContextProviderResult {
  return {
    providerId: args.providerId,
    label: args.label,
    evidence: args.evidence ?? [],
    unavailableReason: args.unavailableReason
  };
}
