import { DVQR_PROMPT_CATEGORIES } from "../../product/promptLibrary/promptCategories.js";
import { DVQR_PROMPT_CATALOGUE } from "../../product/promptLibrary/promptCatalogue.js";
import type {
  DvqrPromptCategoryId,
  DvqrPromptJourneyStage,
  DvqrPromptParameterDefinition,
  DvqrPromptTier
} from "../../product/promptLibrary/promptLibraryTypes.js";

export interface PromptLibraryCategoryViewModel {
  readonly id: DvqrPromptCategoryId;
  readonly title: string;
  readonly description: string;
  readonly promptCount: number;
}

export interface PromptLibraryPromptViewModel {
  readonly id: string;
  readonly categoryId: DvqrPromptCategoryId;
  readonly categoryTitle: string;
  readonly journeyStage: DvqrPromptJourneyStage;
  readonly title: string;
  readonly description: string;
  readonly template: string;
  readonly parameters: readonly DvqrPromptParameterDefinition[];
  readonly capabilityTool: string;
  readonly tier: DvqrPromptTier;
  readonly available: boolean;
  readonly followUpPromptIds: readonly string[];
  readonly prerequisitePromptIds: readonly string[];
  readonly tags: readonly string[];
}

export interface PromptLibraryViewModel {
  readonly title: string;
  readonly subtitle: string;
  readonly currentPlan: "free" | "pro";
  readonly categories: readonly PromptLibraryCategoryViewModel[];
  readonly prompts: readonly PromptLibraryPromptViewModel[];
  readonly promptCount: number;
  readonly freePromptCount: number;
  readonly proPromptCount: number;
  readonly quickStartPromptIds: readonly string[];
}

export function buildPromptLibraryViewModel(plan: "free" | "pro"): PromptLibraryViewModel {
  const categoryTitles = new Map(DVQR_PROMPT_CATEGORIES.map((category) => [category.id, category.title]));
  const categories = [...DVQR_PROMPT_CATEGORIES]
    .sort((left, right) => left.order - right.order)
    .map((category) => ({
      id: category.id,
      title: category.title,
      description: category.description,
      promptCount: DVQR_PROMPT_CATALOGUE.filter((prompt) => prompt.categoryId === category.id).length
    }));

  const prompts = DVQR_PROMPT_CATALOGUE.map((prompt) => ({
    id: prompt.id,
    categoryId: prompt.categoryId,
    categoryTitle: categoryTitles.get(prompt.categoryId) ?? prompt.categoryId,
    journeyStage: prompt.journeyStage,
    title: prompt.title,
    description: prompt.description,
    template: prompt.template,
    parameters: prompt.parameters,
    capabilityTool: prompt.capabilityTool,
    tier: prompt.tier,
    available: prompt.tier === "free" || plan === "pro",
    followUpPromptIds: prompt.followUpPromptIds,
    prerequisitePromptIds: prompt.prerequisitePromptIds,
    tags: prompt.tags
  }));

  return {
    title: "DV Quick Run Prompt Library",
    subtitle: "Browse guided, parameterised prompts that teach DVQR capabilities without requiring MCP tool-name knowledge.",
    currentPlan: plan,
    categories,
    prompts,
    promptCount: prompts.length,
    freePromptCount: prompts.filter((prompt) => prompt.tier === "free").length,
    proPromptCount: prompts.filter((prompt) => prompt.tier === "pro").length,
    quickStartPromptIds: [
      "search-metadata",
      "how-are-tables-related",
      "validate-path-from-record",
      "profile-table",
      "discover-custom-apis",
      "where-to-start-investigation",
      "start-investigation",
      "investigation-resume-context"
    ]
  };
}
