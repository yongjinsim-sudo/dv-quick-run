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

type RenderableTeamMember = {
  displayName?: string;
  uniqueName?: string;
  principalType?: string;
  isDisabled?: boolean;
  accessMode?: string;
  businessUnitName?: string;
};

type TeamMemberGroup = {
  key: string;
  members: RenderableTeamMember[];
};

type RenderableAccessEvidence = {
  sourceDisplayName?: string;
  relationshipType?: string;
  evidenceDescription?: string;
};

type RenderableAccessContext = {
  subjectKind?: "systemuser" | "team" | "role";
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
  teamMembers?: RenderableTeamMember[];
  roleUsers?: RenderableTeamMember[];
  roleTeams?: RenderableTeamMembership[];
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

function teamMemberState(member: RenderableTeamMember): string {
  return typeof member.isDisabled === "boolean" ? (member.isDisabled ? "disabled" : "enabled") : "state not returned";
}

function teamMemberGroupKey(member: RenderableTeamMember): string {
  const principalType = member.principalType ?? "Unknown principal type";
  const accessMode = member.accessMode ?? "access mode not returned";
  return `${principalType} / ${accessMode} / ${teamMemberState(member)}`;
}

function renderTeamMember(member: RenderableTeamMember, indent = ""): string {
  const uniqueName = member.uniqueName ? ` — ${member.uniqueName}` : "";
  return `${indent}- ${escapeMarkdown(member.displayName ?? "Unnamed team member")}${escapeMarkdown(uniqueName)}`;
}

function teamMemberGroups(items: readonly RenderableTeamMember[]): TeamMemberGroup[] {
  const groups = new Map<string, RenderableTeamMember[]>();
  for (const member of items) {
    const key = teamMemberGroupKey(member);
    const group = groups.get(key) ?? [];
    group.push(member);
    groups.set(key, group);
  }

  return Array.from(groups.entries())
    .map(([key, members]) => ({ key, members: members.slice().sort((left, right) => (left.displayName ?? "").localeCompare(right.displayName ?? "")) }))
    .sort((left, right) => right.members.length - left.members.length || left.key.localeCompare(right.key));
}

function countBy(items: readonly RenderableTeamMember[], keySelector: (item: RenderableTeamMember) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keySelector(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function summarizeCounts(counts: Map<string, number>): string {
  return Array.from(counts.entries())
    .sort(([leftKey, leftCount], [rightKey, rightCount]) => rightCount - leftCount || leftKey.localeCompare(rightKey))
    .map(([key, count]) => `${count} ${key}`)
    .join(", ");
}

function notableTeamMembers(items: readonly RenderableTeamMember[]): RenderableTeamMember[] {
  return items
    .filter((member) => {
      const principalType = (member.principalType ?? "").toLowerCase();
      const accessMode = (member.accessMode ?? "").toLowerCase();
      return member.isDisabled === true || principalType.includes("human") || accessMode.includes("read-write") || !accessMode.includes("non-interactive");
    })
    .slice()
    .sort((left, right) => {
      const leftDisabled = left.isDisabled === true ? 0 : 1;
      const rightDisabled = right.isDisabled === true ? 0 : 1;
      if (leftDisabled !== rightDisabled) {
        return leftDisabled - rightDisabled;
      }
      return (left.displayName ?? "").localeCompare(right.displayName ?? "");
    });
}

function renderTeamMemberSummary(items: readonly RenderableTeamMember[]): string[] {
  const principalCounts = countBy(items, (member) => member.principalType ?? "Unknown principal type");
  const accessModeCounts = countBy(items, (member) => member.accessMode ?? "access mode not returned");
  const disabledCount = items.filter((member) => member.isDisabled === true).length;
  const enabledCount = items.filter((member) => member.isDisabled === false).length;
  const appUserCount = Array.from(principalCounts.entries())
    .filter(([key]) => key.toLowerCase().includes("application"))
    .reduce((total, [, count]) => total + count, 0);
  const nonInteractiveCount = Array.from(accessModeCounts.entries())
    .filter(([key]) => key.toLowerCase().includes("non-interactive"))
    .reduce((total, [, count]) => total + count, 0);
  const posture = appUserCount > 0 && appUserCount / items.length >= 0.75
    ? "Observed member participation is mostly application/service identity based."
    : "Observed member participation has mixed identity composition.";

  return [
    `- ${countLabel(items.length, "observed member")}`,
    `- Identity composition: ${escapeMarkdown(summarizeCounts(principalCounts))}`,
    `- Access mode composition: ${escapeMarkdown(summarizeCounts(accessModeCounts))}`,
    ...(enabledCount + disabledCount > 0 ? [`- State composition: ${countLabel(enabledCount, "enabled member")}${disabledCount > 0 ? `, ${countLabel(disabledCount, "disabled member")}` : ""}`] : []),
    `- ${escapeMarkdown(posture)}`,
    ...(nonInteractiveCount === items.length ? ["- All observed members are non-interactive identities in this bounded lookup."] : [])
  ];
}

function renderTeamMemberGroupSummary(groups: readonly TeamMemberGroup[]): string[] {
  return groups.map((group) => `- ${escapeMarkdown(group.key)} — ${countLabel(group.members.length, "member")}`);
}

function renderFullTeamMemberList(groups: readonly TeamMemberGroup[]): string {
  return [
    "<details>",
    "<summary>Full observed member list</summary>",
    "",
    ...groups.flatMap((group) => [
      `- ${escapeMarkdown(group.key)} — ${countLabel(group.members.length, "member")}`,
      ...group.members.map((member) => renderTeamMember(member, "  "))
    ]),
    "",
    "</details>"
  ].join("\n");
}

function renderTeamMemberParticipation(items: readonly RenderableTeamMember[] | undefined): string {
  if (!items || items.length === 0) {
    return "_No team members observed in this bounded lookup._";
  }

  const groups = teamMemberGroups(items);
  const notable = notableTeamMembers(items);
  const notableLimit = 8;

  return [
    "**Summary**",
    ...renderTeamMemberSummary(items),
    "",
    "**Observed groups**",
    ...renderTeamMemberGroupSummary(groups),
    "",
    "**Notable participation**",
    ...(notable.length > 0
      ? notable.slice(0, notableLimit).map((member) => renderTeamMember(member))
      : ["_No notable outliers observed beyond the grouped member composition._"]),
    ...(notable.length > notableLimit ? [`- ${notable.length - notableLimit} additional notable member${notable.length - notableLimit === 1 ? "" : "s"} available in the full observed member list.`] : []),
    "",
    renderFullTeamMemberList(groups)
  ].join("\n");
}


function renderRoleTeam(team: RenderableTeamMembership): string {
  const teamType = team.teamType ? ` (${team.teamType})` : "";
  return `- ${escapeMarkdown(team.teamName ?? "Unnamed team")}${escapeMarkdown(teamType)}`;
}

function renderRoleParticipationSummary(roleUsers: readonly RenderableTeamMember[] | undefined, roleTeams: readonly RenderableTeamMembership[] | undefined): string {
  const users = roleUsers ?? [];
  const teams = roleTeams ?? [];
  if (users.length === 0 && teams.length === 0) {
    return "_No direct user or team participation observed for this role in this bounded lookup._";
  }

  const userPrincipalCounts = countBy(users, (member) => member.principalType ?? "Unknown principal type");
  const accessModeCounts = countBy(users, (member) => member.accessMode ?? "access mode not returned");
  const teamTypeCounts = new Map<string, number>();
  for (const team of teams) {
    const key = team.teamType ?? "team type not returned";
    teamTypeCounts.set(key, (teamTypeCounts.get(key) ?? 0) + 1);
  }

  const notableUsers = notableTeamMembers(users);
  const lines = [
    "**Summary**",
    `- ${countLabel(users.length, "direct user participant")}`,
    `- ${countLabel(teams.length, "team participant")}`,
    ...(users.length > 0 ? [`- Direct user identity composition: ${escapeMarkdown(summarizeCounts(userPrincipalCounts))}`] : []),
    ...(users.length > 0 ? [`- Direct user access mode composition: ${escapeMarkdown(summarizeCounts(accessModeCounts))}`] : []),
    ...(teams.length > 0 ? [`- Team composition: ${escapeMarkdown(summarizeCounts(teamTypeCounts))}`] : []),
    "",
    "**Notable participation**",
    ...(notableUsers.length > 0
      ? notableUsers.slice(0, 8).map((member) => renderTeamMember(member))
      : ["_No notable (e.g. Read-write) direct user participants observed._"]),
    "",
    "<details>",
    "<summary>Full observed role participation</summary>",
    "",
    "**Direct user participants**",
    ...(users.length > 0 ? teamMemberGroups(users).flatMap((group) => [
      `- ${escapeMarkdown(group.key)} — ${countLabel(group.members.length, "participant")}`,
      ...group.members.map((member) => renderTeamMember(member, "  "))
    ]) : ["_No direct user participants observed._"]),
    "",
    "**Team participants**",
    ...(teams.length > 0 ? teams.slice().sort((left, right) => (left.teamName ?? "").localeCompare(right.teamName ?? "")).map(renderRoleTeam) : ["_No team participants observed._"]),
    "",
    "</details>"
  ];

  return lines.join("\n");
}

function renderAccessEvidenceDetail(detail: RenderableAccessEvidence, indent = ""): string {
  const relationship = detail.relationshipType ? ` — ${detail.relationshipType}` : "";
  const description = detail.evidenceDescription ? `: ${detail.evidenceDescription}` : "";
  return `${indent}- **${escapeMarkdown(detail.sourceDisplayName ?? "Observed evidence")}**${escapeMarkdown(relationship)}${escapeMarkdown(description)}`;
}

function renderGroupedTeamAccessEvidence(items: readonly RenderableAccessEvidence[] | undefined): string {
  if (!items || items.length === 0) {
    return "_No access evidence observed in this bounded lookup._";
  }

  const principalEvidence = items.filter((item) => item.relationshipType !== "team member participation");
  const memberEvidence = items.filter((item) => item.relationshipType === "team member participation");
  const lines: string[] = [];

  for (const item of principalEvidence) {
    lines.push(renderAccessEvidenceDetail(item));
  }

  if (memberEvidence.length > 0) {
    lines.push(`- Team member participation evidence — ${memberEvidence.length} observed record${memberEvidence.length === 1 ? "" : "s"}. Details are summarized under Member Participation; full raw evidence remains available below.`);
  }

  return lines.join("\n");
}


function renderGroupedRoleAccessEvidence(items: readonly RenderableAccessEvidence[] | undefined): string {
  if (!items || items.length === 0) {
    return "_No access evidence observed in this bounded lookup._";
  }

  const principalEvidence = items.filter((item) => item.relationshipType !== "direct user role participation" && item.relationshipType !== "team role participation");
  const userEvidence = items.filter((item) => item.relationshipType === "direct user role participation");
  const teamEvidence = items.filter((item) => item.relationshipType === "team role participation");
  const lines: string[] = [];

  for (const item of principalEvidence) {
    lines.push(renderAccessEvidenceDetail(item));
  }

  if (userEvidence.length > 0) {
    lines.push(`- Direct user role participation evidence — ${userEvidence.length} observed record${userEvidence.length === 1 ? "" : "s"}. Details are summarized under Role Participation; full raw evidence remains available below.`);
  }

  if (teamEvidence.length > 0) {
    lines.push(`- Team role participation evidence — ${teamEvidence.length} observed record${teamEvidence.length === 1 ? "" : "s"}. Details are summarized under Role Participation; full raw evidence remains available below.`);
  }

  return lines.join("\n");
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
  const isTeamContext = accessContext.subjectKind === "team" || principal.principalType === "Team Context";
  const isRoleContext = accessContext.subjectKind === "role" || principal.principalType === "Role Context";
  const summaryLabel = isRoleContext ? "#### Role Summary" : (isTeamContext ? "#### Team Summary" : "#### Principal Summary");
  return [
    "",
    "<details>",
    "<summary>Observed access signals</summary>",
    "",
    summaryLabel,
    `- Name: ${escapeMarkdown(principal.displayName ?? principal.uniqueName ?? "Not returned")}`,
    `- Principal type: ${escapeMarkdown(principal.principalType ?? "Unknown Principal")}`,
    ...(isTeamContext || isRoleContext ? [] : [`- State: ${escapeMarkdown(disabled)}`, `- Access mode: ${escapeMarkdown(principal.accessMode ?? "Not returned")}`]),
    `- Business unit: ${escapeMarkdown(principal.businessUnitName ?? "Not returned")}`,
    ...(isTeamContext && principal.businessUnitName ? ["- Business unit hierarchy is not expanded in this Team Access Context; this keeps the lookup one-hop and bounded."] : []),
    ...(isRoleContext && principal.businessUnitName ? ["- Business unit hierarchy is not expanded in this Role Access Context; this keeps the lookup one-hop and bounded."] : []),
    ...(principal.applicationId ? [`- Application id: \`${escapeMarkdown(principal.applicationId)}\``] : []),
    "",
    ...(isRoleContext
      ? [
        "#### Role Participation",
        renderRoleParticipationSummary(accessContext.roleUsers, accessContext.roleTeams),
        ""
      ]
      : [
        isTeamContext ? "#### Direct Team Roles" : "#### Direct Roles",
        renderAccessArray(accessContext.directRoles, renderAccessRole, isTeamContext ? "direct team roles" : "direct roles"),
        "",
        ...(isTeamContext
          ? [
            "#### Member Participation",
            renderTeamMemberParticipation(accessContext.teamMembers),
            ""
          ]
          : [
            "#### Team Memberships",
            renderAccessArray(accessContext.teamMemberships, renderAccessTeam, "team memberships"),
            "",
            "#### Inherited Team Roles",
            renderAccessArray(accessContext.inheritedRoles, renderAccessRole, "inherited team roles"),
            ""
          ])
      ]),
    "#### Access Evidence",
    isRoleContext
      ? renderGroupedRoleAccessEvidence(accessContext.evidence)
      : isTeamContext
        ? renderGroupedTeamAccessEvidence(accessContext.evidence)
        : renderAccessArray(accessContext.evidence, renderAccessEvidenceDetail, "access evidence"),
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
      renderRawJsonDetails("Team members raw context", accessContext.teamMembers ?? []),
      "",
      renderRawJsonDetails("Role users raw context", accessContext.roleUsers ?? []),
      "",
      renderRawJsonDetails("Role teams raw context", accessContext.roleTeams ?? []),
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
