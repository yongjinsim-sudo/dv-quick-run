import { renderOperationalBulletList } from "../rendering/index.js";
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

type RenderableBusinessUnitRoleGroup = {
  groupName?: string;
  roles?: RenderableAccessRole[];
};

type RenderableAccessEvidence = {
  sourceDisplayName?: string;
  relationshipType?: string;
  evidenceDescription?: string;
};

type RenderableAccessContext = {
  subjectKind?: "systemuser" | "applicationuser" | "team" | "role" | "businessunit";
  principalSummary?: {
    displayName?: string;
    uniqueName?: string;
    principalType?: string;
    isDisabled?: boolean;
    accessMode?: string;
    businessUnitName?: string;
    applicationId?: string;
  };
  businessUnitSummary?: {
    businessUnitId?: string;
    name?: string;
    parentBusinessUnitId?: string;
    parentBusinessUnitName?: string;
    childBusinessUnitCount?: number;
    userParticipationCount?: number;
    teamParticipationCount?: number;
    applicationUserParticipationCount?: number;
    roleParticipationCount?: number;
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
  keySignals?: string[];
  businessUnitRoleGroups?: RenderableBusinessUnitRoleGroup[];
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

function renderBusinessUnitRoleGroups(groups: RenderableBusinessUnitRoleGroup[] | undefined, fallbackRoles: RenderableAccessRole[] = []): string {
  if ((!groups || groups.length === 0) && fallbackRoles.length === 0) {
    return "_No observed business unit roles in this bounded lookup._";
  }

  const renderGroups = (groups && groups.length > 0)
    ? groups.map((group) => ({ groupName: group.groupName ?? "Observed Role Group", groupedRoles: group.roles ?? [] })).filter((group) => group.groupedRoles.length > 0)
    : [{ groupName: "Observed Roles", groupedRoles: fallbackRoles }];

  const roles = renderGroups.flatMap((group) => group.groupedRoles);
  const lines: string[] = [
    "> Provider-supplied operational grouping for orientation only. Grouping does not imply privilege equivalence.",
    ""
  ];

  for (const { groupName, groupedRoles } of renderGroups) {

    const examples = groupedRoles.slice(0, 3).map((role) => escapeMarkdown(role.roleName ?? "Unnamed role")).join(", ");
    const suffix = groupedRoles.length > 3 ? `, +${groupedRoles.length - 3} more` : "";
    lines.push("<details>");
    lines.push(`<summary>${escapeMarkdown(groupName)} (${groupedRoles.length}) — ${examples}${suffix}</summary>`);
    lines.push("");

    for (const role of groupedRoles.slice(0, 5)) {
      lines.push(renderAccessRole(role));
    }

    if (groupedRoles.length > 5) {
      lines.push(`- ... and ${groupedRoles.length - 5} more`);
      lines.push("");
      lines.push("<details>");
      lines.push(`<summary>Full ${escapeMarkdown(groupName.toLowerCase())}</summary>`);
      lines.push("");

      for (const role of groupedRoles) {
        lines.push(renderAccessRole(role));
      }

      lines.push("");
      lines.push("</details>");
    }

    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  lines.push("<details>");
  lines.push(`<summary>Full observed role list (${roles.length})</summary>`);
  lines.push("");

  for (const role of roles) {
    lines.push(renderAccessRole(role));
  }

  lines.push("");
  lines.push("</details>");

  return lines.join("\n");
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
  const isBusinessUnitContext = accessContext.subjectKind === "businessunit" || principal.principalType === "Business Unit Context";
  const isApplicationUserContext = accessContext.subjectKind === "applicationuser";
  const summaryLabel = isBusinessUnitContext ? "#### Business Unit Summary" : (isRoleContext ? "#### Role Summary" : (isTeamContext ? "#### Team Summary" : (isApplicationUserContext ? "#### Application User Summary" : "#### Principal Summary")));
  return [
    "",
    "<details>",
    "<summary>Observed access signals</summary>",
    "",
    summaryLabel,
    `- Name: ${escapeMarkdown(principal.displayName ?? principal.uniqueName ?? "Not returned")}`,
    `- Principal type: ${escapeMarkdown(principal.principalType ?? "Unknown Principal")}`,
    ...(isTeamContext || isRoleContext || isBusinessUnitContext ? [] : [`- State: ${escapeMarkdown(disabled)}`, `- Access mode: ${escapeMarkdown(principal.accessMode ?? "Not returned")}`]),
    `- Business unit: ${escapeMarkdown(principal.businessUnitName ?? "Not returned")}`,
    ...(isTeamContext && principal.businessUnitName ? ["- Business unit hierarchy is not expanded in this Team Access Context; this keeps the lookup one-hop and bounded."] : []),
    ...(isRoleContext && principal.businessUnitName ? ["- Business unit hierarchy is not expanded in this Role Access Context; this keeps the lookup one-hop and bounded."] : []),
    ...(isBusinessUnitContext ? [`- Parent business unit: ${escapeMarkdown(accessContext.businessUnitSummary?.parentBusinessUnitName ?? "Not returned")}`, `- Bounded child business units returned: ${escapeMarkdown(String(accessContext.businessUnitSummary?.childBusinessUnitCount ?? 0))}`, `- User participants returned: ${escapeMarkdown(String(accessContext.businessUnitSummary?.userParticipationCount ?? 0))}`, `- Team participants returned: ${escapeMarkdown(String(accessContext.businessUnitSummary?.teamParticipationCount ?? 0))}`, `- Application/service identity participants returned: ${escapeMarkdown(String(accessContext.businessUnitSummary?.applicationUserParticipationCount ?? 0))}`, `- Role participants returned: ${escapeMarkdown(String(accessContext.businessUnitSummary?.roleParticipationCount ?? 0))}`, "- Business unit hierarchy is not recursively expanded; this keeps the lookup structural, one-hop, and bounded."] : []),
    ...(principal.applicationId ? [`- Application id: \`${escapeMarkdown(principal.applicationId)}\``] : []),
    "",
    ...(isBusinessUnitContext
      ? [
        "#### Key Signals",
        renderBusinessUnitKeySignals(accessContext.keySignals),
        "",
        "#### Business Unit Participation",
        "##### Users in Business Unit",
        renderTeamMemberParticipation(accessContext.teamMembers),
        "",
        "##### Teams in Business Unit",
        renderAccessArray(accessContext.teamMemberships, renderAccessTeam, "teams in this business unit"),
        "",
        "##### Roles in Business Unit",
        renderBusinessUnitRoleGroups(accessContext.businessUnitRoleGroups, accessContext.directRoles ?? []),
        ""
      ]
      : isRoleContext
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
    isBusinessUnitContext
      ? renderGroupedBusinessUnitAccessEvidence(accessContext.evidence ?? [])
      : isRoleContext
        ? renderGroupedRoleAccessEvidence(accessContext.evidence)
      : isTeamContext
        ? renderGroupedTeamAccessEvidence(accessContext.evidence)
        : renderAccessArray(accessContext.evidence, renderAccessEvidenceDetail, "access evidence"),
    "",
    "</details>"
  ].join("\n");
}


function renderBusinessUnitKeySignals(keySignals: readonly string[] | undefined): string {
  return renderOperationalBulletList(
    keySignals?.map((signal) => escapeMarkdown(signal)),
    "No standout bounded operational signals detected beyond the summary counts."
  );
}


function renderGroupedBusinessUnitAccessEvidence(evidence: RenderableAccessEvidence[]): string {
  if (!evidence || evidence.length === 0) {
    return "_No observed business unit access evidence in this bounded lookup._";
  }

  const subjectEvidence = evidence.filter((item) => isEvidenceMatch(item, ["principal summary", "business unit summary"]));
  const roleEvidence = evidence.filter((item) => isEvidenceMatch(item, ["role assignment", "role participation"]));
  const teamEvidence = evidence.filter((item) => isEvidenceMatch(item, ["team membership"]));
  const identityEvidence = evidence.filter((item) => isEvidenceMatch(item, ["team member participation", "identity participation", "member participation"]));
  const grouped = new Set<RenderableAccessEvidence>([
    ...subjectEvidence,
    ...roleEvidence,
    ...teamEvidence,
    ...identityEvidence
  ]);
  const otherEvidence = evidence.filter((item) => !grouped.has(item));

  const lines: string[] = [
    "> Evidence is grouped for operational readability. Grouping preserves the original evidence entries and does not imply access authority.",
    ""
  ];

  lines.push(...renderAccessEvidenceDetailsGroup("Subject summary evidence", subjectEvidence, 5));

  if (roleEvidence.length > 0) {
    lines.push("<details>");
    lines.push(`<summary>Direct role participation evidence (${roleEvidence.length})</summary>`);
    lines.push("");
    lines.push(renderGroupedBusinessUnitRoleEvidence(roleEvidence));
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  lines.push(...renderAccessEvidenceDetailsGroup("Team participation evidence", teamEvidence, 5));
  lines.push(...renderAccessEvidenceDetailsGroup("Application/service identity participation evidence", identityEvidence, 5));
  lines.push(...renderAccessEvidenceDetailsGroup("Other bounded evidence", otherEvidence, 8));

  lines.push("<details>");
  lines.push(`<summary>Audit/debug: full flat evidence list (${evidence.length})</summary>`);
  lines.push("");

  for (const item of evidence) {
    lines.push(renderAccessEvidenceDetail(item));
  }

  lines.push("");
  lines.push("</details>");

  return lines.join("\n");
}

function isEvidenceMatch(item: RenderableAccessEvidence, tokens: string[]): boolean {
  const text = `${item.sourceDisplayName ?? ""} ${item.relationshipType ?? ""} ${item.evidenceDescription ?? ""}`.toLowerCase();
  return tokens.some((token) => text.includes(token));
}

function renderAccessEvidenceDetailsGroup(label: string, evidence: RenderableAccessEvidence[], previewLimit: number): string[] {
  if (!evidence || evidence.length === 0) {
    return [];
  }

  const lines: string[] = [
    "<details>",
    `<summary>${escapeMarkdown(label)} (${evidence.length})</summary>`,
    ""
  ];

  for (const item of evidence.slice(0, previewLimit)) {
    lines.push(renderAccessEvidenceDetail(item));
  }

  if (evidence.length > previewLimit) {
    lines.push(`- ... and ${evidence.length - previewLimit} more`);
    lines.push("");
    lines.push("<details>");
    lines.push(`<summary>Full ${escapeMarkdown(label.toLowerCase())}</summary>`);
    lines.push("");

    for (const item of evidence) {
      lines.push(renderAccessEvidenceDetail(item));
    }

    lines.push("");
    lines.push("</details>");
  }

  lines.push("");
  lines.push("</details>");
  lines.push("");

  return lines;
}

function renderGroupedBusinessUnitRoleEvidence(evidence: RenderableAccessEvidence[]): string {
  const groups: Record<string, RenderableAccessEvidence[]> = {
    "Microsoft / Platform Service Role Evidence": [],
    "Automation / Integration Role Evidence": [],
    "AI / Copilot Role Evidence": [],
    "Data / Analytics Role Evidence": [],
    "Human-facing / Business Role Evidence": [],
    "Custom / Organizational Role Evidence": []
  };

  for (const item of evidence) {
    groups[classifyBusinessUnitRoleEvidence(item)].push(item);
  }

  const lines: string[] = [
    "> Role evidence uses heuristic operational grouping for orientation only.",
    ""
  ];

  for (const [groupName, groupEvidence] of Object.entries(groups)) {
    if (groupEvidence.length === 0) {
      continue;
    }

    lines.push("<details>");
    const examples = groupEvidence.slice(0, 3).map((item) => escapeMarkdown(item.sourceDisplayName ?? "Unnamed evidence")).join(", ");
    const suffix = groupEvidence.length > 3 ? `, +${groupEvidence.length - 3} more` : "";
    lines.push(`<summary>${escapeMarkdown(groupName)} (${groupEvidence.length}) — ${examples}${suffix}</summary>`);
    lines.push("");

    for (const item of groupEvidence.slice(0, 3)) {
      lines.push(renderAccessEvidenceDetail(item));
    }

    if (groupEvidence.length > 3) {
      lines.push(`- ... and ${groupEvidence.length - 3} more`);
      lines.push("");
      lines.push("<details>");
      lines.push(`<summary>Full ${escapeMarkdown(groupName.toLowerCase())}</summary>`);
      lines.push("");

      for (const item of groupEvidence) {
        lines.push(renderAccessEvidenceDetail(item));
      }

      lines.push("");
      lines.push("</details>");
    }

    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  return lines.join("\n");
}

function classifyBusinessUnitRoleEvidence(item: RenderableAccessEvidence): string {
  const name = `${item.sourceDisplayName ?? ""} ${item.evidenceDescription ?? ""}`.toLowerCase();

  if (name.includes("copilot")
    || name.includes("ai")
    || name.includes("prompt")
    || name.includes("agent")) {
    return "AI / Copilot Role Evidence";
  }

  if (name.includes("sync")
    || name.includes("flow")
    || name.includes("integration")
    || name.includes("orchestration")
    || name.includes("connector")
    || name.includes("deployment")) {
    return "Automation / Integration Role Evidence";
  }

  if (name.includes("data")
    || name.includes("analytics")
    || name.includes("lake")
    || name.includes("search")
    || name.includes("power bi")
    || name.includes("report")) {
    return "Data / Analytics Role Evidence";
  }

  if (name.includes("service")
    || name.includes("platform")
    || name.includes("app access")
    || name.includes("system")
    || name.includes("dataverse")) {
    return "Microsoft / Platform Service Role Evidence";
  }

  if (name.includes("sales")
    || name.includes("customer")
    || name.includes("knowledge")
    || name.includes("support")
    || name.includes("maker")
    || name.includes("delegate")) {
    return "Human-facing / Business Role Evidence";
  }

  return "Custom / Organizational Role Evidence";
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
      renderRawJsonDetails("Business unit summary raw context", accessContext.businessUnitSummary ?? {}),
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
