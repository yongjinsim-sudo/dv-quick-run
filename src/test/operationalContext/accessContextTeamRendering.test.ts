import * as assert from "assert";
import { renderOperationalContextMarkdown } from "../../product/operationalContext/operationalContextMarkdownRenderer.js";
import type { OperationalContextViewModel } from "../../product/operationalContext/operationalContextTypes.js";

suite("Access Context team rendering", () => {
  test("renders team roles and bounded member participation without permission certainty wording", () => {
    const model: OperationalContextViewModel = {
      subject: {
        type: "principal",
        logicalName: "team",
        id: "11111111-1111-1111-1111-111111111111",
        displayName: "CONTOSO - Data Admin"
      },
      sections: [{
        id: "accessContext",
        label: "Access Context",
        summary: "Observed team access topology participation.",
        evidence: [{
          subject: {
            type: "principal",
            logicalName: "team",
            id: "11111111-1111-1111-1111-111111111111",
            displayName: "CONTOSO - Data Admin"
          },
          evidenceType: "AccessTopology",
          title: "Observed access topology participation",
          summary: "CONTOSO - Data Admin is shown as Team Context with observed role participation.",
          source: "dataverse",
          scope: "currentSubject",
          confidence: "direct",
          raw: {
            accessContext: {
              subjectKind: "team",
              principalSummary: {
                id: "11111111-1111-1111-1111-111111111111",
                displayName: "CONTOSO - Data Admin",
                principalType: "Team Context",
                businessUnitName: "Contoso Health Services"
              },
              directRoles: [{ roleName: "Data Admin", source: "team", sourceTeamName: "CONTOSO - Data Admin" }],
              teamMemberships: [],
              teamMembers: [{
                displayName: "Jane Smith",
                uniqueName: "jane.smith@example.com",
                principalType: "Human User",
                isDisabled: false,
                accessMode: "Read-Write"
              }, {
                displayName: "DV App User",
                uniqueName: "dv-app@example.com",
                principalType: "Application User",
                isDisabled: false,
                accessMode: "Non-interactive"
              }],
              inheritedRoles: [],
              evidence: [{
                sourceDisplayName: "CONTOSO - Data Admin",
                relationshipType: "principal summary",
                evidenceDescription: "Team Context identity observed."
              }, {
                sourceDisplayName: "Jane Smith",
                relationshipType: "team member participation",
                evidenceDescription: "Observed Human User participation in the selected team."
              }, {
                sourceDisplayName: "DV App User",
                relationshipType: "team member participation",
                evidenceDescription: "Observed Application User participation in the selected team."
              }],
              operationalSignificance: "CONTOSO - Data Admin provides team access-topology orientation without proving effective access.",
              topologySummary: "Observed team access topology includes one direct team role and one bounded member participation record.",
              queryLog: ["/teams(11111111-1111-1111-1111-111111111111)"],
              searchHint: "Search is local to the Team Access Context evidence currently loaded."
            }
          }
        }]
      }],
      guardrails: ["Participation does not imply causality."]
    };

    const markdown = renderOperationalContextMarkdown(model);

    assert.ok(markdown.includes("#### Team Summary"));
    assert.ok(markdown.includes("#### Direct Team Roles"));
    assert.ok(markdown.includes("#### Member Participation"));
    assert.ok(markdown.includes("**Summary**"));
    assert.ok(markdown.includes("Identity composition: 1 Application User, 1 Human User"));
    assert.ok(markdown.includes("Access mode composition: 1 Non-interactive, 1 Read-Write"));
    assert.ok(markdown.includes("**Observed groups**"));
    assert.ok(markdown.includes("Application User / Non-interactive / enabled — 1 member"));
    assert.ok(markdown.includes("Human User / Read-Write / enabled — 1 member"));
    assert.ok(markdown.includes("**Notable participation**"));
    assert.ok(markdown.includes("Jane Smith"));
    assert.ok(markdown.includes("jane.smith@example.com"));
    assert.ok(markdown.includes("Full observed member list"));
    assert.ok(markdown.includes("DV App User"));
    assert.ok(markdown.includes("Team member participation evidence — 2 observed records. Details are summarized under Member Participation"));
    assert.ok(markdown.includes("does not prove effective access"));
    assert.ok(!markdown.toLowerCase().includes("guaranteed access"));
    assert.ok(!markdown.toLowerCase().includes("permission certainty"));
  });
});
