## Operational Context

**Subject:** # PowerAutomate-AiFlowsAppUser-Web

<details open>
<summary><strong>Access Context</strong></summary>

> Access Context is bounded operational participation evidence. It is not an RBAC simulator, effective-access proof, privilege-depth analysis, or security-risk score.
### Operational Significance
# PowerAutomate-AiFlowsAppUser-Web participates as Application User with non-interactive access mode, with Power Automate AI Flows Application User role participation observed. This appears aligned to automation or flow-related platform operations rather than broad user-driven access.
### Observed Topology
- # PowerAutomate-AiFlowsAppUser-Web is shown as Application User in business unit org7013c734. Observed access topology includes 1 direct role, 1 team membership, and 0 inherited team roles.
- Evidence: AccessTopology; confidence: direct; scope: currentSubject; source: dataverse

<details>
<summary>Observed access signals</summary>

#### Principal Summary
- Name: # PowerAutomate-AiFlowsAppUser-Web
- Principal type: Application User
- State: Enabled
- Access mode: Non-interactive
- Business unit: org7013c734
- Application id: `57ac09e7-b33a-4d99-86f2-d577c3617d64`

#### Direct Roles
- Power Automate AI Flows Application User

#### Team Memberships
- org7013c734 (Owner team)
  - inherited roles: none observed in this bounded lookup

#### Inherited Team Roles
_No inherited team roles observed in this bounded lookup._

#### Access Evidence
- **# PowerAutomate-AiFlowsAppUser-Web** — principal summary: Application User identity observed.
- **Power Automate AI Flows Application User** — direct role assignment: Observed direct role participation.
- **org7013c734** — team membership: Observed Owner team membership.

</details>
<details>
<summary>Searchable evidence guidance</summary>
> Use the Access Context search box to search within this retrieved evidence. Search is local to the bounded evidence currently loaded; it is not a Dataverse-wide RBAC lookup.
</details>

  <details>
  <summary>Raw evidence</summary>

  > Raw evidence is provided for verification and export. It is not an effective-access proof or security-risk score.

  <details>
  <summary>Executed bounded queries</summary>

  - `/systemusers(f559b088-0814-f111-8341-6045bdc330de)?$select=systemuserid,fullname,domainname,applicationid,azureactivedirectoryobjectid,accessmode,isdisabled,_businessunitid_value`
  - `/businessunits(cae59497-f213-f111-8341-6045bdc330de)?$select=businessunitid,name,_parentbusinessunitid_value`
  - `/systemusers(f559b088-0814-f111-8341-6045bdc330de)/systemuserroles_association?$select=roleid,name,_businessunitid_value&$top=100`
  - `/systemusers(f559b088-0814-f111-8341-6045bdc330de)/teammembership_association?$select=teamid,name,teamtype,_businessunitid_value&$top=100`
  - `/teams(cbe59497-f213-f111-8341-6045bdc330de)/teamroles_association?$select=roleid,name,_businessunitid_value&$top=100`

  </details>

  <details>
  <summary>Principal raw context</summary>

  ```json
{
  "id": "f559b088-0814-f111-8341-6045bdc330de",
  "displayName": "# PowerAutomate-AiFlowsAppUser-Web",
  "uniqueName": "PowerAutomate-AiFlowsAppUser-Web@onmicrosoft.com",
  "principalType": "Application User",
  "isDisabled": false,
  "accessMode": "Non-interactive",
  "applicationId": "57ac09e7-b33a-4d99-86f2-d577c3617d64",
  "businessUnitId": "cae59497-f213-f111-8341-6045bdc330de",
  "businessUnitName": "org7013c734"
}
  ```

  </details>

  <details>
  <summary>Direct roles raw context</summary>

  ```json
[
  {
    "roleId": "84012ef2-00bd-412e-8654-b1e3a90feafc",
    "roleName": "Power Automate AI Flows Application User",
    "businessUnitId": "cae59497-f213-f111-8341-6045bdc330de",
    "source": "direct"
  }
]
  ```

  </details>

  <details>
  <summary>Team memberships raw context</summary>

  ```json
[
  {
    "teamId": "cbe59497-f213-f111-8341-6045bdc330de",
    "teamName": "org7013c734",
    "teamType": "Owner team",
    "businessUnitId": "cae59497-f213-f111-8341-6045bdc330de",
    "inheritedRoles": []
  }
]
  ```

  </details>

  <details>
  <summary>Access evidence raw context</summary>

  ```json
[
  {
    "sourceType": "principal",
    "sourceId": "f559b088-0814-f111-8341-6045bdc330de",
    "sourceDisplayName": "# PowerAutomate-AiFlowsAppUser-Web",
    "relationshipType": "principal summary",
    "evidenceDescription": "Application User identity observed.",
    "rawContext": {
      "id": "f559b088-0814-f111-8341-6045bdc330de",
      "displayName": "# PowerAutomate-AiFlowsAppUser-Web",
      "uniqueName": "PowerAutomate-AiFlowsAppUser-Web@onmicrosoft.com",
      "principalType": "Application User",
      "isDisabled": false,
      "accessMode": "Non-interactive",
      "applicationId": "57ac09e7-b33a-4d99-86f2-d577c3617d64",
      "businessUnitId": "cae59497-f213-f111-8341-6045bdc330de",
      "businessUnitName": "org7013c734"
    }
  },
  {
    "sourceType": "directRole",
    "sourceId": "84012ef2-00bd-412e-8654-b1e3a90feafc",
    "sourceDisplayName": "Power Automate AI Flows Application User",
    "relationshipType": "direct role assignment",
    "evidenceDescription": "Observed direct role participation.",
    "rawContext": {
      "roleId": "84012ef2-00bd-412e-8654-b1e3a90feafc",
      "roleName": "Power Automate AI Flows Application User",
      "businessUnitId": "cae59497-f213-f111-8341-6045bdc330de",
      "source": "direct"
    }
  },
  {
    "sourceType": "teamMembership",
    "sourceId": "cbe59497-f213-f111-8341-6045bdc330de",
    "sourceDisplayName": "org7013c734",
    "relationshipType": "team membership",
    "evidenceDescription": "Observed Owner team membership.",
    "rawContext": {
      "teamId": "cbe59497-f213-f111-8341-6045bdc330de",
      "teamName": "org7013c734",
      "teamType": "Owner team",
      "businessUnitId": "cae59497-f213-f111-8341-6045bdc330de",
      "inheritedRoles": []
    }
  }
]
  ```

  </details>

  <details>
  <summary>Full raw JSON</summary>

  ```json
{
  "accessContext": {
    "principalSummary": {
      "id": "f559b088-0814-f111-8341-6045bdc330de",
      "displayName": "# PowerAutomate-AiFlowsAppUser-Web",
      "uniqueName": "PowerAutomate-AiFlowsAppUser-Web@onmicrosoft.com",
      "principalType": "Application User",
      "isDisabled": false,
      "accessMode": "Non-interactive",
      "applicationId": "57ac09e7-b33a-4d99-86f2-d577c3617d64",
      "businessUnitId": "cae59497-f213-f111-8341-6045bdc330de",
      "businessUnitName": "org7013c734"
    },
    "directRoles": [
      {
        "roleId": "84012ef2-00bd-412e-8654-b1e3a90feafc",
        "roleName": "Power Automate AI Flows Application User",
        "businessUnitId": "cae59497-f213-f111-8341-6045bdc330de",
        "source": "direct"
      }
    ],
    "teamMemberships": [
      {
        "teamId": "cbe59497-f213-f111-8341-6045bdc330de",
        "teamName": "org7013c734",
        "teamType": "Owner team",
        "businessUnitId": "cae59497-f213-f111-8341-6045bdc330de",
        "inheritedRoles": []
      }
    ],
    "inheritedRoles": [],
    "evidence": [
      {
        "sourceType": "principal",
        "sourceId": "f559b088-0814-f111-8341-6045bdc330de",
        "sourceDisplayName": "# PowerAutomate-AiFlowsAppUser-Web",
        "relationshipType": "principal summary",
        "evidenceDescription": "Application User identity observed.",
        "rawContext": {
          "id": "f559b088-0814-f111-8341-6045bdc330de",
          "displayName": "# PowerAutomate-AiFlowsAppUser-Web",
          "uniqueName": "PowerAutomate-AiFlowsAppUser-Web@onmicrosoft.com",
          "principalType": "Application User",
          "isDisabled": false,
          "accessMode": "Non-interactive",
          "applicationId": "57ac09e7-b33a-4d99-86f2-d577c3617d64",
          "businessUnitId": "cae59497-f213-f111-8341-6045bdc330de",
          "businessUnitName": "org7013c734"
        }
      },
      {
        "sourceType": "directRole",
        "sourceId": "84012ef2-00bd-412e-8654-b1e3a90feafc",
        "sourceDisplayName": "Power Automate AI Flows Application User",
        "relationshipType": "direct role assignment",
        "evidenceDescription": "Observed direct role participation.",
        "rawContext": {
          "roleId": "84012ef2-00bd-412e-8654-b1e3a90feafc",
          "roleName": "Power Automate AI Flows Application User",
          "businessUnitId": "cae59497-f213-f111-8341-6045bdc330de",
          "source": "direct"
        }
      },
      {
        "sourceType": "teamMembership",
        "sourceId": "cbe59497-f213-f111-8341-6045bdc330de",
        "sourceDisplayName": "org7013c734",
        "relationshipType": "team membership",
        "evidenceDescription": "Observed Owner team membership.",
        "rawContext": {
          "teamId": "cbe59497-f213-f111-8341-6045bdc330de",
          "teamName": "org7013c734",
          "teamType": "Owner team",
          "businessUnitId": "cae59497-f213-f111-8341-6045bdc330de",
          "inheritedRoles": []
        }
      }
    ],
    "operationalSignificance": "# PowerAutomate-AiFlowsAppUser-Web participates as Application User with non-interactive access mode, with Power Automate AI Flows Application User role participation observed. This appears aligned to automation or flow-related platform operations rather than broad user-driven access.",
    "topologySummary": "# PowerAutomate-AiFlowsAppUser-Web is shown as Application User in business unit org7013c734. Observed access topology includes 1 direct role, 1 team membership, and 0 inherited team roles.",
    "queryLog": [
      "/systemusers(f559b088-0814-f111-8341-6045bdc330de)?$select=systemuserid,fullname,domainname,applicationid,azureactivedirectoryobjectid,accessmode,isdisabled,_businessunitid_value",
      "/businessunits(cae59497-f213-f111-8341-6045bdc330de)?$select=businessunitid,name,_parentbusinessunitid_value",
      "/systemusers(f559b088-0814-f111-8341-6045bdc330de)/systemuserroles_association?$select=roleid,name,_businessunitid_value&$top=100",
      "/systemusers(f559b088-0814-f111-8341-6045bdc330de)/teammembership_association?$select=teamid,name,teamtype,_businessunitid_value&$top=100",
      "/teams(cbe59497-f213-f111-8341-6045bdc330de)/teamroles_association?$select=roleid,name,_businessunitid_value&$top=100"
    ],
    "limits": {
      "roleTop": 100,
      "teamTop": 100,
      "teamRoleTop": 100,
      "displayedByDefault": 8
    },
    "searchHint": "Use the Access Context search box to search within this retrieved evidence. Search is local to the bounded evidence currently loaded; it is not a Dataverse-wide RBAC lookup."
  },
  "searchableText": "# powerautomate-aiflowsappuser-web powerautomate-aiflowsappuser-web@onmicrosoft.com application user non-interactive power automate ai flows application user org7013c734 owner team # powerautomate-aiflowsappuser-web principal summary application user identity observed. power automate ai flows application user direct role assignment observed direct role participation. org7013c734 team membership observed owner team membership.",
  "progressiveDisclosure": "Principal Summary, Business Unit, Direct Roles, Team Memberships, Inherited Team Roles, and Access Evidence should remain collapsed/expandable and searchable within the currently retrieved bounded evidence.",
  "runnable": false,
  "note": "Access Context is bounded operational participation evidence, not effective-access proof or security-risk scoring."
}
  ```

  </details>

  </details>

</details>

### Operational Context Guardrails

- Operational Context is scoped to the current investigation subject.
- Default context remains one-hop; curated semantic expansions must be explicit and provider-owned.
- Participation does not imply causality.
- Runtime actor identities are preserved as observed and are not collapsed.
- Audit timelines, chronology reconstruction, behavioural drift, and RCA narratives are out of scope for v0.11.x.