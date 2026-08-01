import type { CustomApiDefinition } from "../customApi/models/customApiTypes.js";
import type { McpCustomApiDecisionSupport, McpCustomApiRelatedRecommendation, McpCustomApiUsageGuidance } from "./mcpCustomApiKnowledgeService.js";

export interface McpCustomApiInvocationModel {
  readonly method?: unknown;
  readonly routeTemplate?: unknown;
  readonly bindingKind?: unknown;
  readonly bodyTemplate?: unknown;
  readonly functionParameters?: unknown;
  readonly executionEligibility?: unknown;
}

export interface McpCustomApiExplainParameter {
  readonly uniqueName: string;
  readonly displayName?: string;
  readonly type: string;
  readonly required: boolean;
  readonly explanation: string;
  readonly evidenceSource: "metadata" | "deterministic-interpretation";
}

export interface McpCustomApiExplainResponseProperty {
  readonly uniqueName: string;
  readonly displayName?: string;
  readonly type: string;
  readonly explanation: string;
  readonly evidenceSource: "metadata" | "deterministic-interpretation";
}

export interface McpCustomApiExplainModel {
  readonly uniqueName: string;
  readonly displayName?: string;
  readonly purpose: {
    readonly text: string;
    readonly evidenceSource: "metadata" | "deterministic-fallback";
  };
  readonly operation: {
    readonly kind: CustomApiDefinition["operationKind"];
    readonly explanation: string;
    readonly evidenceSource: "metadata-and-deterministic-interpretation";
  };
  readonly binding: {
    readonly kind: string;
    readonly targetTable?: string;
    readonly explanation: string;
    readonly evidenceSource: "metadata-and-deterministic-interpretation";
  };
  readonly requestParameters: readonly McpCustomApiExplainParameter[];
  readonly responseProperties: readonly McpCustomApiExplainResponseProperty[];
  readonly invocation: {
    readonly method: string;
    readonly route: string;
    readonly bodyTemplate?: unknown;
    readonly functionParameters?: unknown;
    readonly explanation: string;
    readonly evidenceSource: "metadata-derived-scaffold";
  };
  readonly practicalGuidance: readonly string[];
  readonly usageGuidance: McpCustomApiUsageGuidance;
  readonly relatedApis: readonly McpCustomApiRelatedRecommendation[];
  readonly decisionSupport: McpCustomApiDecisionSupport;
  readonly safety: readonly string[];
}

function publicBindingKind(definition: CustomApiDefinition): string {
  if (definition.bindingKind === "Unbound" || definition.boundTargetKind === "none") return "Global";
  if (definition.boundTargetKind === "entity") return "Entity";
  if (definition.boundTargetKind === "collection") return "EntityCollection";
  return "Unresolved";
}

function typeLabel(value: { readonly typeLabel?: string; readonly typeCategory?: string; readonly type?: string }): string {
  return value.typeLabel ?? value.typeCategory ?? value.type ?? "Unknown";
}

function operationExplanation(definition: CustomApiDefinition): string {
  return definition.operationKind === "Function"
    ? "Dataverse metadata classifies this operation as a Function, so the metadata-derived invocation scaffold uses GET. This classification does not by itself verify OData exposure or safe execution in the connected environment."
    : "Dataverse metadata classifies this operation as an Action, so the metadata-derived invocation scaffold uses POST. Actions represent an operation request, but metadata alone does not prove its side effects, OData exposure or execution safety.";
}

function bindingExplanation(definition: CustomApiDefinition): string {
  const binding = publicBindingKind(definition);
  if (binding === "Global") {
    return "This is a global operation. Its metadata does not require a row or table collection to appear before the operation name in the route.";
  }
  if (binding === "Entity") {
    return `This operation is bound to one ${definition.boundEntityLogicalName ?? "target"} row. A verified entity-set name and row ID are required before an executable route can be formed.`;
  }
  if (binding === "EntityCollection") {
    return `This operation is bound to the ${definition.boundEntityLogicalName ?? "target"} table collection. A verified entity-set name is required before an executable route can be formed.`;
  }
  return "The available metadata does not resolve the operation binding confidently enough to describe an executable route.";
}

function parameterExplanation(parameter: CustomApiDefinition["requestParameters"][number]): string {
  const requirement = parameter.isOptional === true ? "optional" : "required";
  const logicalTarget = parameter.logicalEntityName ? ` It refers to the ${parameter.logicalEntityName} table.` : "";
  return `${parameter.uniqueName} is a ${requirement} ${typeLabel(parameter)} input.${logicalTarget}`;
}

function responseExplanation(property: CustomApiDefinition["responseProperties"][number]): string {
  return `${property.uniqueName} is returned as ${typeLabel(property)} according to the Custom API response metadata.`;
}

export function buildMcpCustomApiExplainModel(
  definition: CustomApiDefinition,
  invocation: McpCustomApiInvocationModel,
  usageGuidance: McpCustomApiUsageGuidance,
  relatedApis: readonly McpCustomApiRelatedRecommendation[],
  decisionSupport: McpCustomApiDecisionSupport
): McpCustomApiExplainModel {
  const binding = publicBindingKind(definition);
  const method = typeof invocation.method === "string" ? invocation.method : "Unknown";
  const route = typeof invocation.routeTemplate === "string" ? invocation.routeTemplate : "Unavailable";
  const purpose = definition.description?.trim();

  return {
    uniqueName: definition.uniqueName,
    displayName: definition.displayName,
    purpose: purpose
      ? { text: purpose, evidenceSource: "metadata" }
      : {
          text: `${definition.displayName ?? definition.uniqueName} is a ${binding} Dataverse Custom API ${definition.operationKind.toLowerCase()}.`,
          evidenceSource: "deterministic-fallback"
        },
    operation: {
      kind: definition.operationKind,
      explanation: operationExplanation(definition),
      evidenceSource: "metadata-and-deterministic-interpretation"
    },
    binding: {
      kind: binding,
      ...(definition.boundEntityLogicalName ? { targetTable: definition.boundEntityLogicalName } : {}),
      explanation: bindingExplanation(definition),
      evidenceSource: "metadata-and-deterministic-interpretation"
    },
    requestParameters: definition.requestParameters.map((parameter) => ({
      uniqueName: parameter.uniqueName,
      displayName: parameter.displayName,
      type: typeLabel(parameter),
      required: parameter.isOptional !== true,
      explanation: parameterExplanation(parameter),
      evidenceSource: "deterministic-interpretation"
    })),
    responseProperties: definition.responseProperties.map((property) => ({
      uniqueName: property.uniqueName,
      displayName: property.displayName,
      type: typeLabel(property),
      explanation: responseExplanation(property),
      evidenceSource: "deterministic-interpretation"
    })),
    invocation: {
      method,
      route,
      ...(invocation.bodyTemplate !== undefined ? { bodyTemplate: invocation.bodyTemplate } : {}),
      ...(invocation.functionParameters !== undefined ? { functionParameters: invocation.functionParameters } : {}),
      explanation: `The ${method} ${route} shape is derived from Custom API definition metadata and is provided for understanding and preview preparation only.`,
      evidenceSource: "metadata-derived-scaffold"
    },
    practicalGuidance: [
      `Use ${definition.uniqueName} only when its metadata-described purpose matches the business operation you intend to perform.`,
      definition.requestParameters.length
        ? "Supply every required parameter using the exact Custom API parameter unique name and the expected Dataverse type."
        : "The Custom API metadata declares no request parameters beyond any binding context.",
      definition.responseProperties.length
        ? "Treat the declared response properties as the expected result shape, while allowing for normal Dataverse response annotations."
        : "The metadata declares no response properties, so a successful call may complete without a business payload."
    ],
    usageGuidance,
    relatedApis,
    decisionSupport,
    safety: [
      "This explanation separates metadata facts from deterministic DVQR interpretation.",
      "The invocation shape is metadata-derived only and is not proof that the operation is exposed through OData.",
      "DVQR has not yet verified the qualified operation name, bound entity-set route, parameter serialisation, privileges, side effects or execution policy for this operation."
    ]
  };
}

export function renderMcpCustomApiExplainText(model: McpCustomApiExplainModel): string {
  const lines = [
    model.uniqueName,
    "Purpose",
    model.purpose.text,
    "",
    "Operation",
    `${model.operation.kind}: ${model.operation.explanation}`,
    "",
    "Binding",
    `${model.binding.kind}${model.binding.targetTable ? ` (${model.binding.targetTable})` : ""}: ${model.binding.explanation}`,
    "",
    "Inputs",
    ...(model.requestParameters.length
      ? model.requestParameters.map((parameter) => `- ${parameter.uniqueName} — ${parameter.type}, ${parameter.required ? "required" : "optional"}. ${parameter.explanation}`)
      : ["- None declared"]),
    "",
    "Outputs",
    ...(model.responseProperties.length
      ? model.responseProperties.map((property) => `- ${property.uniqueName} — ${property.type}. ${property.explanation}`)
      : ["- None declared"]),
    "",
    "Metadata-derived HTTP shape",
    `${model.invocation.method} ${model.invocation.route}`,
    model.invocation.explanation,
    "",
    "Decision summary",
    `Purpose: ${model.decisionSupport.summary.purpose}`,
    ...(model.decisionSupport.summary.primaryInput ? [`Primary input: ${model.decisionSupport.summary.primaryInput}`] : []),
    ...(model.decisionSupport.summary.primaryOutput ? [`Primary output: ${model.decisionSupport.summary.primaryOutput}`] : []),
    `Best for: ${model.decisionSupport.summary.bestFor}`,
    `Avoid for: ${model.decisionSupport.summary.avoidFor}`,
    ...(model.decisionSupport.summary.alternatives.length ? [`Alternatives to compare: ${model.decisionSupport.summary.alternatives.join(", ")}`] : []),
    "",
    "Best used for",
    ...model.decisionSupport.bestUsedFor.map((item) => `- ${item}`),
    "",
    "Not ideal for",
    ...model.decisionSupport.notIdealFor.map((item) => `- ${item}`),
    "",
    "Instead consider",
    ...(model.decisionSupport.alternatives.length
      ? model.decisionSupport.alternatives.map((item) => `- ${item.uniqueName} — consider when ${item.betterFitWhen}. ${item.purpose ? `Purpose: ${item.purpose}. ` : ""}${item.reasons.join(" ")}`)
      : ["- No clearly differentiated public alternative was identified deterministically from the current catalogue."]),
    "",
    "Typical workflow",
    ...model.decisionSupport.typicalWorkflow.map((item, index) => `${index + 1}. ${item}`),
    "",
    "Concepts",
    `- ${model.decisionSupport.conceptTags.join(" · ")}`,
    "",
    "Related Custom APIs",
    ...(model.relatedApis.length
      ? model.relatedApis.map((item) => `- ${item.uniqueName} — ${item.operationKind}, ${item.bindingKind}; relevance ${item.score}/100. ${item.reasons.join(" ")}${item.purpose ? ` Purpose: ${item.purpose}` : ""}`)
      : ["- No sufficiently related public Custom APIs were identified deterministically from the current catalogue."]),
    "",
    "Practical guidance",
    ...model.practicalGuidance.map((item) => `- ${item}`),
    "",
    "Safety and evidence boundary",
    ...model.safety.map((item) => `- ${item}`)
  ];
  return lines.join("\n");
}
