import type { DvqrPromptCategory } from "./promptLibraryTypes.js";

export const DVQR_PROMPT_CATEGORIES: readonly DvqrPromptCategory[] = [
  {
    id: "environment-understanding",
    title: "Understand Dataverse",
    description: "Discover capabilities, business surfaces and sensible starting points before choosing a deeper investigation path.",
    order: 10
  },
  {
    id: "metadata-query",
    title: "Metadata & Queries",
    description: "Find tables, inspect schema, understand query shape and run bounded read-only Dataverse reads.",
    order: 20
  },
  {
    id: "relationships-traversal",
    title: "Relationships & Traversal",
    description: "Understand lookups, navigation properties, metadata paths and runtime-validated business traversal.",
    order: 30
  },
  {
    id: "custom-apis",
    title: "Custom APIs",
    description: "Discover, understand, compare, design, pre-flight, preview and interpret Custom API usage.",
    order: 40
  },
  {
    id: "operational-profile",
    title: "Operational Profile",
    description: "Understand operational density, DVQR Score contributors and the boundaries of what profile evidence proves.",
    order: 50
  },
  {
    id: "managed-investigation",
    title: "Managed Investigation",
    description: "Start, advance, inspect, verify and hand off a persisted Professional Investigation with bounded evidence.",
    order: 60
  }
];
