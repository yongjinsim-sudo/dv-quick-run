import { CommandContext } from "../../../context/commandContext.js";
import type { DataverseClient } from "../../../../services/dataverseClient.js";
import {
  loadEntityDefByLogicalName,
  loadNavigationProperties
} from "../shared/metadataAccess.js";
import {
  InvestigationReverseSuggestion,
  RecordContext
} from "./types.js";
import {
  toFriendlyLabel,
  prettifyEntityName,
  normalize
} from "./investigationDisplayHelpers";

type NavigationPropertyLike = {
  navigationPropertyName?: string;
  relationshipType?: string;
  referencingAttribute?: string;
  referencedEntity?: string;
  referencingEntity?: string;
  targetEntityLogicalName?: string;
  targetEntitySetName?: string;
};

type EntityDefinitionLike = {
  logicalName?: string;
  entitySetName?: string;
  primaryIdAttribute?: string;
  primaryNameAttribute?: string;
};

const REVERSE_LINK_SOURCE_BLACKLIST = [
  "principalobjectattributeaccess",
  "userentityinstancedata"
];


function buildReverseLinkLabel(
  navigationPropertyName: string | undefined,
  referencingEntity: string,
  referencingAttribute: string
): string {
  if (navigationPropertyName) {
    return toFriendlyLabel(navigationPropertyName);
  }

  return `${prettifyEntityName(referencingEntity) ?? referencingEntity} via ${referencingAttribute}`;
}

function rankReverseLinks(
  links: InvestigationReverseSuggestion[]
): InvestigationReverseSuggestion[] {
  return [...links]
    .map((link) => ({
      link,
      score: scoreReverseLink(link)
    }))
    .sort((a, b) => b.score - a.score || a.link.label.localeCompare(b.link.label))
    .map((item) => item.link)
    .filter((link, index, array) => {
      const firstIndex = array.findIndex((candidate) =>
        candidate.sourceEntitySetName === link.sourceEntitySetName &&
        candidate.referencingAttribute === link.referencingAttribute
      );

      return firstIndex === index;
    });
}

function scoreReverseLink(link: InvestigationReverseSuggestion): number {
  const label = `${link.label} ${link.sourceEntityLogicalName ?? ""}`.toLowerCase();
  const attn = (link.referencingAttribute ?? "").toLowerCase();

  if (label.includes("activityparty") || attn === "partyid") {
    return 120;
  }

  if (label.includes("annotation") || label.includes("note") || attn === "objectid") {
    return 110;
  }

  if (label.includes("activity")) {
    return 100;
  }

  if (label.includes("task")) {
    return 95;
  }

  if (label.includes("email")) {
    return 85;
  }

  if (label.includes("appointment")) {
    return 85;
  }

  if (label.includes("phonecall")) {
    return 85;
  }

  if (attn.includes("regarding")) {
    return 70;
  }

  if (attn.includes("customer") || attn.endsWith("id")) {
    return 60;
  }

  return 50;
}

function formatGuidLiteral(value: string): string {
  return value;
}

export async function buildReverseLinks(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  recordContext: RecordContext,
  recordId: string
): Promise<InvestigationReverseSuggestion[]> {
  const navigationProperties = await loadNavigationProperties(
    ctx,
    client,
    token,
    recordContext.entityLogicalName,
    { silent: true }
  );

  const result: InvestigationReverseSuggestion[] = [];

  for (const nav of navigationProperties as NavigationPropertyLike[]) {
    const referencedEntity = normalize(nav.referencedEntity);
    const referencingEntity = normalize(nav.referencingEntity);
    const referencingAttribute = normalize(nav.referencingAttribute);
    const navigationPropertyName = normalize(nav.navigationPropertyName);

    if (!referencedEntity || !referencingEntity || !referencingAttribute) {
      continue;
    }

    if (referencedEntity !== normalize(recordContext.entityLogicalName)) {
      continue;
    }

    if (REVERSE_LINK_SOURCE_BLACKLIST.includes(referencingEntity)) {
      continue;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(referencingAttribute)) {
      continue;
    }

    const sourceEntityDef = (await loadEntityDefByLogicalName(
      ctx,
      client,
      token,
      referencingEntity
    ).catch(() => undefined)) as EntityDefinitionLike | undefined;

    if (!sourceEntityDef?.entitySetName) {
      continue;
    }

    result.push({
      label: buildReverseLinkLabel(
        navigationPropertyName,
        referencingEntity,
        referencingAttribute
      ),
      sourceEntityLogicalName: prettifyEntityName(referencingEntity),
      sourceEntitySetName: sourceEntityDef.entitySetName,
      referencingAttribute,
      query: `${sourceEntityDef.entitySetName}?$filter=_${referencingAttribute}_value eq ${formatGuidLiteral(recordId)}`
    });
  }

  return rankReverseLinks(result).slice(0, 8);
}
