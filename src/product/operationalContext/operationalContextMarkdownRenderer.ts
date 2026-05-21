import type {
  OperationalContextEvidence,
  OperationalContextSectionViewModel,
  OperationalContextViewModel
} from "./operationalContextTypes.js";

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}


type RenderableAccessRole = {
  roleName?: string;
  sourceTeamName?: string;
};

type RenderableTeamMembership = {
  teamName?: string;
  teamType?: string;
  inheritedRoles?: RenderableAccessRole[];
};

type RenderableAccessEvidence = {
  sourceDisplayName?: string;
  relationshipType?: string;
  evidenceDescription?: string;
};

type RenderableAccessContext = {
  principalSummary?: {
    displayName?: string;
    uniqueName?: string;
    principalType?: string;
    isDisabled?: boolean;
    accessMode?: string;
    businessUnitName?: string;
    applicationId?: string;
  };
  directRoles?: RenderableAccessRole[];
  teamMemberships?: RenderableTeamMembership[];
  inheritedRoles?: RenderableAccessRole[];
  evidence?: RenderableAccessEvidence[];
  operationalSignificance?: string;
  topologySummary?: string;
  queryLog?: string[];
  searchHint?: string;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
}

function accessContextFromEvidence(item: OperationalContextEvidence): RenderableAccessContext | undefined {
  const raw = asRecord(item.raw);
  const candidate = asRecord(raw?.accessContext);
  return candidate as RenderableAccessContext | undefined;
}

function renderAccessRole(role: RenderableAccessRole): string {
  const source = role.sourceTeamName ? ` — from ${role.sourceTeamName}` : "";
  return `- ${escapeMarkdown(role.roleName ?? "Unnamed role")}${escapeMarkdown(source)}`;
}

function renderAccessTeam(team: RenderableTeamMembership): string {
  const teamType = team.teamType ? ` (${team.teamType})` : "";
  const roles = Array.isArray(team.inheritedRoles) && team.inheritedRoles.length > 0
    ? team.inheritedRoles.map((role) => `  - inherited role: ${escapeMarkdown(role.roleName ?? "Unnamed role")}`).join("\n")
    : "  - inherited roles: none observed in this bounded lookup";
  return `- ${escapeMarkdown(team.teamName ?? "Unnamed team")}${escapeMarkdown(teamType)}\n${roles}`;
}

function renderAccessEvidenceDetail(detail: RenderableAccessEvidence): string {
  const relationship = detail.relationshipType ? ` — ${detail.relationshipType}` : "";
  const description = detail.evidenceDescription ? `: ${detail.evidenceDescription}` : "";
  return `- **${escapeMarkdown(detail.sourceDisplayName ?? "Observed evidence")}**${escapeMarkdown(relationship)}${escapeMarkdown(description)}`;
}

function renderAccessContextGovernanceNote(): string {
  return "> Access Context shows bounded operational participation evidence. It does not prove effective access.";
}

function renderAccessArray<T>(items: readonly T[] | undefined, render: (item: T) => string, empty: string): string {
  if (!items || items.length === 0) {
    return `_No ${escapeMarkdown(empty)} observed in this bounded lookup._`;
  }
  return items.map(render).join("\n");
}

function renderAccessContextDetails(accessContext: RenderableAccessContext): string {
  const principal = accessContext.principalSummary ?? {};
  const disabled = typeof principal.isDisabled === "boolean" ? (principal.isDisabled ? "Disabled" : "Enabled") : "Not returned";
  return [
    "",
    "<details>",
    "<summary>Observed access signals</summary>",
    "",
    "#### Principal Summary",
    `- Name: ${escapeMarkdown(principal.displayName ?? principal.uniqueName ?? "Not returned")}`,
    `- Principal type: ${escapeMarkdown(principal.principalType ?? "Unknown Principal")}`,
    `- State: ${escapeMarkdown(disabled)}`,
    `- Access mode: ${escapeMarkdown(principal.accessMode ?? "Not returned")}`,
    `- Business unit: ${escapeMarkdown(principal.businessUnitName ?? "Not returned")}`,
    ...(principal.applicationId ? [`- Application id: \`${escapeMarkdown(principal.applicationId)}\``] : []),
    "",
    "#### Direct Roles",
    renderAccessArray(accessContext.directRoles, renderAccessRole, "direct roles"),
    "",
    "#### Team Memberships",
    renderAccessArray(accessContext.teamMemberships, renderAccessTeam, "team memberships"),
    "",
    "#### Inherited Team Roles",
    renderAccessArray(accessContext.inheritedRoles, renderAccessRole, "inherited team roles"),
    "",
    "#### Access Evidence",
    renderAccessArray(accessContext.evidence, renderAccessEvidenceDetail, "access evidence"),
    "",
    "</details>"
  ].join("\n");
}

function renderRawJsonDetails(summary: string, value: unknown): string {
  return [
    "  <details>",
    `  <summary>${escapeMarkdown(summary)}</summary>`,
    "",
    "  ```json",
    JSON.stringify(value, null, 2),
    "  ```",
    "",
    "  </details>"
  ].join("\n");
}

function renderRawEvidence(item: OperationalContextEvidence): string {
  if (typeof item.raw === "undefined" && typeof item.query === "undefined") {
    return "";
  }

  const accessContext = accessContextFromEvidence(item);
  const rawRecord = asRecord(item.raw);
  const rawLines: string[] = ["", "  <details>", "  <summary>Raw evidence</summary>", ""];

  rawLines.push(
    "  > Raw verification evidence for export and troubleshooting.",
    ""
  );

  if (accessContext?.queryLog && accessContext.queryLog.length > 0) {
    rawLines.push(
      "  <details>",
      "  <summary>Executed bounded queries</summary>",
      "",
      ...accessContext.queryLog.map((query) => `  - \`${escapeMarkdown(query)}\``),
      "",
      "  </details>",
      ""
    );
  } else if (item.query) {
    rawLines.push(
      "  <details>",
      "  <summary>Executed bounded query</summary>",
      "",
      `  - \`${escapeMarkdown(item.query)}\``,
      "",
      "  </details>",
      ""
    );
  }

  if (accessContext) {
    rawLines.push(
      renderRawJsonDetails("Principal raw context", accessContext.principalSummary ?? {}),
      "",
      renderRawJsonDetails("Direct roles raw context", accessContext.directRoles ?? []),
      "",
      renderRawJsonDetails("Team memberships raw context", accessContext.teamMemberships ?? []),
      "",
      renderRawJsonDetails("Access evidence raw context", accessContext.evidence ?? [])
    );
  }

  if (typeof item.raw !== "undefined") {
    rawLines.push("", renderRawJsonDetails("Full raw JSON", rawRecord ?? item.raw));
  }

  rawLines.push("", "  </details>");
  return rawLines.join("\n");
}

function renderAccessTopologyEvidence(item: OperationalContextEvidence, accessContext: RenderableAccessContext): string {
  return [
    renderAccessContextGovernanceNote(),
    "",
    "### Operational Significance",
    "",
    escapeMarkdown(accessContext.operationalSignificance ?? item.summary),
    "",
    "<details>",
    "<summary>Observed topology</summary>",
    "",
    `- ${escapeMarkdown(accessContext.topologySummary ?? item.summary)}`,
    `- Evidence: ${item.evidenceType}; confidence: ${item.confidence}; scope: ${item.scope}; source: ${item.source}`,
    "",
    "</details>",
    renderAccessContextDetails(accessContext),
    "",
    "<details>",
    "<summary>Search guidance</summary>",
    "",
    `> ${escapeMarkdown(accessContext.searchHint ?? "Search is local to the currently rendered Access Context evidence.")}`,
    "",
    "</details>",
    renderRawEvidence(item)
  ].filter((line) => line.length > 0).join("\n");
}

function renderEvidence(item: OperationalContextEvidence): string {
  const accessContext = accessContextFromEvidence(item);
  if (accessContext && item.evidenceType === "AccessTopology") {
    return renderAccessTopologyEvidence(item, accessContext);
  }

  const emphasis = item.emphasis ? ` — ${item.emphasis}` : "";
  return [
    `- **${escapeMarkdown(item.title)}**${escapeMarkdown(emphasis)}`,
    `  - ${escapeMarkdown(item.summary)}`,
    `  - Evidence: ${item.evidenceType}; confidence: ${item.confidence}; scope: ${item.scope}; source: ${item.source}`,
    renderRawEvidence(item)
  ].filter((line) => line.length > 0).join("\n");
}

function renderSection(section: OperationalContextSectionViewModel): string {
  const evidence = section.evidence.length > 0
    ? section.evidence.map(renderEvidence).join("\n")
    : "_No operational context evidence was returned for this provider._";
  const hasAccessTopology = section.evidence.some((item) => item.evidenceType === "AccessTopology" && accessContextFromEvidence(item));

  return [
    "<details open>",
    `<summary><strong>${escapeMarkdown(section.label)}</strong></summary>`,
    "",
    ...(hasAccessTopology ? [] : [`_${escapeMarkdown(section.summary)}_`, ""]),
    evidence,
    "",
    "</details>"
  ].join("\n");
}

export function renderOperationalContextMarkdown(context: OperationalContextViewModel): string {
  const subject = context.subject.displayName ?? context.subject.logicalName ?? context.subject.id ?? context.subject.type;

  return [
    "## Operational Context",
    "",
    `**Subject:** ${escapeMarkdown(subject)}`,
    "",
    ...context.sections.map(renderSection).flatMap((section) => [section, ""]),
    "### Operational Context Guardrails",
    "",
    ...context.guardrails.map((item) => `- ${escapeMarkdown(item)}`)
  ].join("\n").trimEnd();
}
