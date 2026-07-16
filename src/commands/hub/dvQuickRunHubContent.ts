
import type { CapabilityInfo, InvestigationPlaybook, ProductDirectionInfo } from "./dvQuickRunHubTypes.js";
import type { EntitlementPlan } from "../../product/capabilities/entitlementTypes.js";

export const investigationPlaybooks: readonly InvestigationPlaybook[] = [
  {
    id: "runtime-behaviour",
    title: "Investigate runtime behaviour",
    summary: "Start from a query result, inspect runtime evidence, and continue into related operational context without treating signals as root cause proof.",
    whenToUse: [
      "A query behaves unexpectedly or slowly.",
      "You need to inspect plugin, async, workflow, or Flow evidence.",
      "You want evidence before changing data or queries."
    ],
    flow: [
      { label: "Run a focused query", description: "Start with the smallest useful Dataverse query that reproduces the operational context.", relatedSurface: "Editor" },
      { label: "Inspect the Result Viewer", description: "Review rows, shape, entity context, and available investigation pivots.", relatedSurface: "Result Viewer" },
      { label: "Open Execution Insights", description: "Review observed runtime evidence and raw details where available.", relatedSurface: "Execution Insights" },
      { label: "Continue to Profile or evidence", description: "Use profile or raw evidence pivots to inspect related operational participation.", relatedSurface: "Operational Profile" }
    ],
    relatedCapabilities: ["result-viewer", "execution-insights", "operational-profiles"],
    safetyNotes: ["Runtime evidence is an investigation signal, not a root-cause conclusion."]
  },
  {
    id: "entity-relationships",
    title: "Understand entity relationships",
    summary: "Use Guided Traversal to restore relationship orientation before writing complex expands or manual queries.",
    whenToUse: [
      "You know the business entities but not the Dataverse relationship path.",
      "You need to move from one table to related operational data.",
      "A route returned no data and you need a recoverable path forward."
    ],
    flow: [
      { label: "Choose source and target", description: "Start from the entities that represent the operational question.", commandId: "dvQuickRun.findPathToTable", relatedSurface: "Guided Traversal" },
      { label: "Review route families", description: "Compare high-signal routes without treating confidence as certainty.", relatedSurface: "Guided Traversal" },
      { label: "Use graph or list orientation", description: "Pick the route that best matches the investigation context.", relatedSurface: "Traversal Graph" },
      { label: "Run and recover", description: "Continue, go back, or change route when evidence suggests a better path.", relatedSurface: "Result Viewer" }
    ],
    relatedCapabilities: ["guided-traversal", "result-viewer"]
  },
  {
    id: "environment-differences",
    title: "Investigate environment differences",
    summary: "Use Cross-Diff to identify evidence-backed differences between environments while preserving investigation boundaries.",
    whenToUse: [
      "Production behaves differently from UAT.",
      "A deployment may have introduced changes.",
      "A configuration exists in one environment but not another.",
      "You need evidence before escalating a release concern."
    ],
    flow: [
      { label: "Capture source snapshot", description: "Create a source-side Operational Profile snapshot for the entity or subject under investigation.", relatedSurface: "Snapshot Library" },
      { label: "Capture target snapshot", description: "Create the target-side snapshot so the comparison preserves environment and capture-time context.", relatedSurface: "Snapshot Library" },
      { label: "Run Cross-Diff", description: "Compare the selected snapshots without treating observed drift as deployment authority.", relatedSurface: "Snapshot Library" },
      { label: "Review high-signal drift", description: "Inspect provider-owned differences, significance, and evidence references first.", relatedSurface: "Cross-Diff" },
      { label: "Verify with audit evidence", description: "Use Check Audit Evidence where available to enrich the bounded finding context.", relatedSurface: "Cross-Diff" },
      { label: "Generate reconstruction artifacts", description: "Export supported source-side reconstruction intent only when external DVAF, DVIM, DVCE, or DVEVM preview is needed.", relatedSurface: "Cross-Diff" }
    ],
    relatedCapabilities: ["cross-environment-comparison"],
    safetyNotes: [
      "Cross-Diff identifies observed evidence differences; it does not prove the source is correct, the target is wrong, or that remediation should be applied.",
      "Reconstruction artifacts are external-review handoffs, not deployment authority."
    ]
  },
  {
    id: "change-over-time",
    title: "Reconstruct change over time",
    summary: "Use Timeline Reconstruction to understand when changes first appeared across a sequence of snapshots.",
    whenToUse: [
      "An issue appeared gradually.",
      "Nobody knows when something changed.",
      "Multiple deployments occurred.",
      "You need timeline-oriented evidence."
    ],
    flow: [
      { label: "Capture multiple snapshots", description: "Preserve a sequence of same-environment snapshots for the entity or subject under investigation.", relatedSurface: "Snapshot Library" },
      { label: "Select timeline sequence", description: "Choose 3+ compatible snapshots so DVQR can reconstruct adjacent evidence intervals.", relatedSurface: "Snapshot Library" },
      { label: "Run Timeline Reconstruction", description: "Build a first-observed timeline from adjacent snapshot comparisons.", relatedSurface: "Timeline Diff" },
      { label: "Review first-observed windows", description: "Inspect when drift first appeared without treating the interval as exact changed-at certainty.", relatedSurface: "Timeline Findings" },
      { label: "Enrich with audit evidence", description: "Use Check Audit Evidence where available to add bounded who/when context.", relatedSurface: "Timeline Findings" },
      { label: "Generate reconstruction artifacts", description: "Export supported source-side reconstruction candidates from eligible timeline events.", relatedSurface: "Timeline Findings" }
    ],
    relatedCapabilities: ["timeline-reconstruction"],
    safetyNotes: [
      "Timeline Reconstruction reports first observed evidence windows, not exact change time or causality.",
      "Timeline reconstruction artifacts use the selected event interval's source-side definition, not latest or merged timeline state."
    ]
  },
  {
    id: "refine-from-results",
    title: "Refine from results",
    summary: "Use observed rows as the canvas for safer, more contextual query narrowing.",
    whenToUse: [
      "Your first query is intentionally broad.",
      "You want to narrow by observed values or columns.",
      "You want to preview refinements before changing the query."
    ],
    flow: [
      { label: "Run a simple query", description: "Start with a small query rather than writing the final shape upfront.", relatedSurface: "Editor" },
      { label: "Inspect rows and columns", description: "Look for meaningful business-status, ownership, or relationship signals.", relatedSurface: "Result Viewer" },
      { label: "Slice or filter", description: "Use cell or column actions to preview a refinement.", relatedSurface: "Result Viewer" },
      { label: "Explain and verify", description: "Use Explain or Query Doctor when the query shape needs review.",  relatedSurface: "Explain" }
    ],
    relatedCapabilities: ["query-by-canvas", "explain-query-doctor", "preview-first-mutation"]
  },
  {
    id: "power-platform-participation",
    title: "Investigate Power Platform participation",
    summary: "Bridge Dataverse evidence with orchestration context while preserving scope honesty.",
    whenToUse: [
      "A Dataverse record appears to participate in workflow or Flow behaviour.",
      "You need to inspect asyncoperation, workflow, or FlowSession evidence.",
      "You want to explain operational participation without dashboard noise."
    ],
    flow: [
      { label: "Start from returned evidence", description: "Use Result Viewer, Execution Insights, or a selected entity as the starting context.", relatedSurface: "Result Viewer" },
      { label: "Inspect runtime providers", description: "Review provider cards and raw evidence when available.", relatedSurface: "Execution Insights" },
      { label: "Open entity profile", description: "Review bounded operational participation for the entity.",  relatedSurface: "Operational Profile" },
      { label: "Continue only where evidence supports it", description: "Use explicit pivots instead of broad hidden scans.", relatedSurface: "Investigation Pivots" }
    ],
    relatedCapabilities: ["execution-insights", "operational-profiles", "batch-workflows"],
    safetyNotes: ["Provider evidence should remain bounded to the current investigation context."]
  },
  {
    id: "production-safe-update",
    title: "Production-safe update workflow",
    summary: "Use preview-first mutation and environment awareness before applying operational changes.",
    whenToUse: [
      "You need to update a Dataverse record intentionally.",
      "You want to verify payload shape before applying a PATCH.",
      "You are working in a sensitive environment."
    ],
    flow: [
      { label: "Inspect current data", description: "Confirm the entity, row identity, and current values first.", relatedSurface: "Result Viewer" },
      { label: "Create a preview", description: "Generate an inspectable Smart PATCH preview before execution.",  relatedSurface: "Preview" },
      { label: "Verify environment", description: "Check environment identity and warning colour semantics before applying.", relatedSurface: "Preview" },
      { label: "Apply and verify", description: "Apply explicitly, then rerun or inspect the record to verify outcome.", relatedSurface: "Result Viewer" }
    ],
    relatedCapabilities: ["smart-patch", "preview-first-mutation", "result-viewer"],
    safetyNotes: ["Mutation workflows must remain preview-first and user-triggered."]
  }
];

export const capabilities: readonly CapabilityInfo[] = [
  {
    id: "odata-fetchxml-execution",
    title: "OData and FetchXML execution",
    group: "Query & Explore",
    summary: "Run common Dataverse query styles directly from VS Code.",
    operationalUseCase: "Use when you need fast operational visibility without switching tools.",
    relatedPlaybooks: ["refine-from-results"],
    contextRequirement: {
      kind: "editorSelection",
      label: "Starts from editor query text",
      unavailableReason: "Open or write an OData or FetchXML query in the editor, then run it from the command palette, CodeLens, or context menu.",
      recommendedSurface: "Editor"
    },
    status: "available",
    sinceVersion: "v0.6.x"
  },
  {
    id: "result-viewer",
    title: "Result Viewer",
    group: "Query & Explore",
    summary: "Inspect table and JSON output with session-backed stability for operational payloads.",
    operationalUseCase: "Use as the central workspace for inspecting, pivoting, refining, and verifying query results.",
    relatedPlaybooks: ["runtime-behaviour", "refine-from-results"],
    contextRequirement: {
      kind: "resultViewer",
      label: "Appears after query execution",
      unavailableReason: "Run an OData, FetchXML, or batch query to open the Result Viewer.",
      recommendedSurface: "Result Viewer"
    },
    status: "available",
    sinceVersion: "v0.5.x"
  },
  {
    id: "query-by-canvas",
    title: "Query-by-Canvas",
    group: "Refine & Understand",
    summary: "Refine queries from observed rows, columns, and metadata-aware actions.",
    operationalUseCase: "Use when the result itself tells you the next narrowing step.",
    relatedPlaybooks: ["refine-from-results"],
    contextRequirement: {
      kind: "resultViewer",
      label: "Requires returned rows",
      unavailableReason: "Run a query and use Result Viewer cell or column actions when observed values suggest the next refinement.",
      recommendedSurface: "Result Viewer"
    },
    status: "available",
    sinceVersion: "v0.7.x"
  },
  {
    id: "explain-query-doctor",
    title: "Investigation Intelligence",
    group: "Refine & Understand",
    summary: "Turn Dataverse query structure into operational investigation understanding.",
    operationalUseCase: "Use when a query needs investigation summaries, confidence assessment, investigation pattern teaching, verification guidance, or evidence-backed recommendations.",
    relatedPlaybooks: ["refine-from-results"],
    contextRequirement: {
      kind: "query",
      label: "Requires active query context",
      unavailableReason: "Open an OData or FetchXML query in the editor, then run Explain from the editor, CodeLens, or Result Viewer context.",
      recommendedSurface: "Editor or Result Viewer"
    },
    status: "available",
    sinceVersion: "v0.7.x"
  },
  {
    id: "guided-traversal",
    title: "Guided Traversal",
    group: "Navigate Relationships",
    summary: "Find metadata-backed relationship paths and continue investigations across related tables.",
    operationalUseCase: "Use when you know where you want to go operationally but not which Dataverse relationship path to take.",
    relatedPlaybooks: ["entity-relationships"],
    commandId: "dvQuickRun.findPathToTable",
    actionLabel: "Start Guided Traversal",
    launchNote: "This workflow can start from the Hub because it asks for source and target context.",
    contextRequirement: {
      kind: "selfContained",
      label: "Can start from the Hub",
      unavailableReason: "Guided Traversal asks for source and target context when launched.",
      recommendedSurface: "Guided Traversal"
    },
    status: "available",
    sinceVersion: "v0.7.x"
  },
  {
    id: "execution-insights",
    title: "Execution Insights",
    group: "Investigate Runtime",
    summary: "Surface bounded runtime evidence from providers such as plugin traces, async operations, workflows, and FlowSession direction where available.",
    operationalUseCase: "Use when returned data needs runtime context or orchestration evidence.",
    relatedPlaybooks: ["runtime-behaviour", "power-platform-participation"],
    contextRequirement: {
      kind: "runtimeEvidence",
      label: "Requires runtime evidence",
      unavailableReason: "Run a query and open Execution Insights where provider evidence is available.",
      recommendedSurface: "Result Viewer / Execution Insights"
    },
    status: "available",
    sinceVersion: "v0.9.x"
  },
  {
    id: "operational-profiles",
    title: "Operational Profiles",
    group: "Understand Entities",
    summary: "Review bounded entity-scoped operational participation without turning it into a dashboard or root-cause claim.",
    operationalUseCase: "Use when an entity appears operationally central and you need context about participation signals.",
    relatedPlaybooks: ["runtime-behaviour", "power-platform-participation"],
    contextRequirement: {
      kind: "entity",
      label: "Requires entity context",
      unavailableReason: "Open from a known entity or selected Result Viewer context so the profile remains entity-scoped.",
      recommendedSurface: "Operational Profile"
    },
    status: "available",
    sinceVersion: "v0.9.x"
  },
  {
    id: "preview-first-mutation",
    title: "Preview-first mutation",
    group: "Act Safely",
    summary: "Review proposed changes before applying or executing operational mutations.",
    operationalUseCase: "Use whenever a workflow may change query text or Dataverse data.",
    relatedPlaybooks: ["production-safe-update", "refine-from-results"],
    contextRequirement: {
      kind: "selectedRow",
      label: "Requires previewable change context",
      unavailableReason: "Start from a query refinement or selected record where DV Quick Run can show the exact preview before apply.",
      recommendedSurface: "Preview"
    },
    status: "available"
  },
  {
    id: "smart-patch",
    title: "Smart PATCH",
    group: "Act Safely",
    summary: "Prepare explicit, inspectable PATCH workflows with environment-aware safety cues.",
    operationalUseCase: "Use when you need a deliberate record update and a verification path.",
    relatedPlaybooks: ["production-safe-update"],
    contextRequirement: {
      kind: "selectedRow",
      label: "Requires selected record context",
      unavailableReason: "Start from a Result Viewer row or record context so the PATCH payload can be previewed safely.",
      recommendedSurface: "Result Viewer / Preview"
    },
    status: "available",
    sinceVersion: "v0.9.x"
  },
  {
    id: "capability-explorer",
    title: "Capability Explorer",
    group: "Explore Capabilities",
    summary: "Discover Custom APIs and other operational capabilities available in the current Dataverse environment.",
    operationalUseCase: "Use when you need to understand what executable Custom APIs exist before testing or wiring operational actions.",
    howToUse: [
      "Open Capability Explorer from the Hub or command palette.",
      "Filter Custom APIs by name, binding, type, or visibility.",
      "Use the catalogue to understand bound entities, parameter complexity, execution readiness, and OData eligibility before execution.",
      "Preview Function requests safely before execution and inspect structured execution diagnostics after completion.",
      "Use execution results as investigation pivots for future operational diagnostics and runtime analysis."
    ],
    relatedPlaybooks: ["runtime-behaviour", "power-platform-participation"],
    commandId: "dvQuickRun.openCapabilityExplorer",
    actionLabel: "Open Capability Explorer",
    contextRequirement: {
      kind: "selfContained",
      label: "Can start from the Hub",
      unavailableReason: "Capability Explorer discovers environment metadata after it opens.",
      recommendedSurface: "Capability Explorer"
    },
    status: "available",
    sinceVersion: "v0.10.0"
  },

  {
    id: "cross-environment-comparison",
    title: "🔒 Evidence Workspace, Timeline Understanding & Reconstruction Preview",
    group: "Future Workflows",
    summary: "Capture, organise, compare, timeline-explain, audit-enrich, and understand reconstruction artifact workflows using Snapshot Library and Evidence Workspace previews.",
    operationalUseCase: "Use this preview to understand operational drift investigation, Timeline Understanding, audit context, and reconstruction artifact handoff before unlocking real snapshot comparison workflows.",
    howToUse: [
      "Open the Snapshot Library preview from the Hub.",
      "Use Evidence Workspace orientation to understand capture, selection, and comparison workflows.",
      "Compare DEV-MOCK and SIT-MOCK snapshots to inspect the Pro comparison surface.",
      "Use rebalanced TIMELINE-MOCK snapshots to understand Timeline Reconstruction, Timeline Understanding Markdown, and adjacent-interval investigation workflows.",
      "Upgrade to Pro to import, manage, compare, export real operational snapshots, and generate reconstruction artifacts from real evidence.",
      "Use Share Feedback when you want to send private product feedback, bugs, or workflow ideas."
    ],
    relatedPlaybooks: ["environment-differences", "change-over-time", "runtime-behaviour", "power-platform-participation"],
    commandId: "dvQuickRun.openSnapshotLibrary",
    actionLabel: "Open Pro Preview",
    contextRequirement: {
      kind: "selfContained",
      label: "Pro Preview",
      unavailableReason: "Free can explore mock snapshots; Pro unlocks real operational snapshot workflows.",
      recommendedSurface: "Snapshot Library"
    },
    status: "preview",
    sinceVersion: "v0.12.0"
  },

  {
    id: "community-feedback",
    title: "Share Feedback",
    group: "Community",
    summary: "Send private feedback, bug reports, feature requests, commercial questions, or workflow suggestions through the DV Quick Run feedback form.",
    operationalUseCase: "Use when you want to send product feedback without opening a public GitHub discussion.",
    howToUse: [
      "Open the DV Quick Run feedback form.",
      "Share bugs, feature ideas, workflow feedback, or commercial questions.",
      "The form includes DV Quick Run and the current extension version for easier follow-up."
    ],
    relatedPlaybooks: [],
    commandId: "dvQuickRun.openFeedback",
    actionLabel: "Share Feedback",
    status: "available",
    sinceVersion: "v0.12.5"
  },

  {
    id: "community-discussions",
    title: "DV Quick Run GitHub Discussions",
    group: "Community",
    summary: "Open the public GitHub Discussions board for community questions, workflow discussion, and broader DVQR roadmap conversation.",
    operationalUseCase: "Use when you want to discuss DV Quick Run publicly with the community.",
    howToUse: [
      "Open the DV Quick Run GitHub Discussions board.",
      "Ask questions, share workflow ideas, or follow upcoming roadmap discussions.",
      "Use Share Feedback instead when you want to send private product feedback."
    ],
    relatedPlaybooks: [],
    commandId: "dvQuickRun.openDiscussions",
    actionLabel: "Open Discussions",
    status: "available",
    sinceVersion: "v0.12.0"
  },

  {
    id: "batch-workflows",
    title: "$batch workflows",
    group: "Advanced Workflows",
    summary: "Run related queries together and inspect individual sub-results with investigation context preserved.",
    operationalUseCase: "Use when related operational queries should be executed and reviewed as one workflow.",
    howToUse: [
      "Open a document with two or more OData GET queries.",
      "Highlight the queries you want to run together.",
      "Right-click the selection and choose: DV Quick Run: Run Selected Queries as $batch.",
      "Inspect individual sub-results in the Result Viewer."
    ],
    relatedPlaybooks: ["power-platform-participation"],
    contextRequirement: {
      kind: "editorSelection",
      label: "Requires selected queries",
      unavailableReason: "Select two or more OData GET queries in the editor, then run the batch command from the context menu.",
      recommendedSurface: "Editor selection"
    },
    status: "available",
    sinceVersion: "v0.9.0"
  }
];

export const productDirection: readonly ProductDirectionInfo[] = [
  { title: "Investigation Intelligence", summary: "Convert operational artefacts into structured observations, synthesized understanding, evidence-backed confidence, and verification guidance." },
  { title: "Continuous Investigation Understanding", summary: "Preserve context across query results, traversal, runtime evidence, profiles, and preview workflows." },
  { title: "Runtime and Power Platform visibility", summary: "Continue bridging Dataverse execution evidence with orchestration participation where evidence supports it." },
  { title: "Metadata-aware guidance", summary: "Use schema and relationship context to reduce orientation cost without inventing unsupported meaning." },
  { title: "Safe operational actions", summary: "Keep mutation workflows preview-first, explicit, and environment-aware." },
  { title: "DV ForgeLab ecosystem handoffs", summary: "Let DVQR export bounded reconstruction artifacts to focused companion utilities: DVAF for attributes, DVIM for identity participation, DVCE for choices, and DVEVM for environment variables." },
  { title: "Future persistence and collaboration", summary: "Longer-term hosted work may preserve investigations for replay and handoff, but not as autonomous orchestration." },
  { title: "Evidence Workspace", summary: "Local workspace-backed evidence capture and Snapshot Library workflows give investigations a Git-friendly home without turning DVQR into Git tooling or hosted persistence." },
  { title: "Timeline Reconstruction and operational comparison", summary: "Timeline Reconstruction is available for same-environment snapshot sequences, while broader comparison remains bounded to drift investigation without remediation or deployment tooling." },
  { title: "Reconstruction Artifacts", summary: "Generate source-side DVAF, DVIM, DVCE, and DVEVM reconstruction artifacts from eligible drift while keeping DVQR observational and companion utilities responsible for validation, preview, and apply." }
];


function buildProComparisonCapability(): CapabilityInfo {
  return {
    id: "cross-environment-comparison",
    title: "Evidence Workspace, Snapshot Library & Reconstruction Artifacts",
    group: "Operational Comparison Workflows",
    summary: "Capture, organise, compare, reconstruct, audit-enrich, and export source-side reconstruction artifacts using Evidence Workspace and Snapshot Library workflows.",
    operationalUseCase: "Investigate what changed, when it first appeared, supporting audit evidence, and generate reconstruction artifacts for external review.",
    howToUse: [
      "Create or open an Evidence Workspace from the Hub or Snapshot Library.",
      "Capture Operational Profile snapshots into the workspace.",
      "Select source and target snapshots, or compare latest and previous snapshots from the library.",
      "Use Timeline Reconstruction for 3+ same-environment snapshots, Timeline Diff for two same-environment snapshots, and Cross-Environment Diff for different-environment comparison.",
      "Query Audit Evidence on supported findings when you need snapshot-bounded who/when context.",
      "Export DVAF, DVIM, DVCE, and DVEVM artifacts from eligible source-side drift when external preview-first reconstruction is needed.",
      "Export HTML/PDF reports when you need to preserve or share investigation context, including any audit evidence and reconstruction artifacts explicitly generated before export."
    ],
    relatedPlaybooks: ["environment-differences", "change-over-time", "runtime-behaviour", "power-platform-participation"],
    commandId: "dvQuickRun.openSnapshotLibrary",
    actionLabel: "Open Snapshot Library",
    contextRequirement: {
      kind: "selfContained",
      label: "Snapshot Library",
      unavailableReason: "Snapshot Library can start from the Hub and coordinates operational comparison workflows.",
      recommendedSurface: "Snapshot Library"
    },
    status: "available",
    sinceVersion: "v0.12.0"
  };
}

export function getHubCapabilities(plan: EntitlementPlan = "free"): CapabilityInfo[] {
  const isProEnabled = plan === "pro";

  return capabilities.map((capability) => capability.id === "cross-environment-comparison" && isProEnabled
    ? buildProComparisonCapability()
    : { ...capability });
}

export const whatsNew: readonly string[] = [
  "v0.15.0 adds Cross-Diff Bundle Input for Mini RCA through investigation-input-v1.",
  "Cross-Diff reports can now generate deterministic Mini RCA HTML and Markdown without rerunning the comparison.",
  "Non-dominant outcomes, provider-execution awareness, sparse-input handling, and calibrated correlation coverage keep conclusions bounded.",
  "Evidence relationships now show how existing findings support, reinforce, limit, contradict, or remain missing or neutral without creating new evidence or asserting causation.",
  "Mini RCA reports now include a first-class Evidence Correlation section, an Evidence Relationships appendix, contributor availability counts, and a responsive two-column Supporting Evidence Appendix.",
  "Relationship cards use consistent semantic treatment for supporting, limiting, missing, conflicting, and neutral relationships.",
  "The Understanding Bundle remains the stable investigation contract for Timeline, Audit, Metadata, Identity, Relationship, Configuration, Cross Diff, and Query contributors.",
  "Existing Timeline Reconstruction, reconstruction workflows, provider-owned comparison semantics, and Dataverse mutation behaviour remain unchanged in v0.15.0.",
  "Explain assists. Evidence decides. Correlation connects evidence; it does not prove causation.",
  "v0.14.6 simplified the Mini RCA report and moved detailed contributor internals into the appendix.",
  "v0.14.5 introduced Understanding Bundle v1, evidence-aware confidence, and consultant-style Mini RCA reporting.",
  "DV Quick Run investigates. DV ForgeLab utilities reconstruct. Investigation and reconstruction remain separate concerns. Companion utilities are available at dvforgelab.com/products."
];

export const philosophy: readonly string[] = [
  "Evidence first, bounded interpretation second, user judgement always.",
  "Understanding and evidence stay visible; future shortcuts should not hide operational context.",
  "Mutation workflows remain preview-first and explicitly applied.",
  "Runtime and profile signals are investigation pivots, not root-cause conclusions.",
  "Guidance should stay calm, low-noise, and operationally useful."
];
