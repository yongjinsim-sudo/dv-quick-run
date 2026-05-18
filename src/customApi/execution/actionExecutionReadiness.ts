import type { CustomApiDefinition, CustomApiRequestParameter } from "../models/customApiTypes.js";
import { evaluateAiExecutionPolicy, type AiExecutionPolicyOptions } from "./aiExecutionPolicy.js";
import type { BoundActionTargetValidationResult } from "./boundActionTargetValidation.js";

export type ActionExecutionReadinessState =
  | "ready"
  | "readyWithCaution"
  | "blockedByPolicy"
  | "inspectOnlyInternal"
  | "inspectOnlyNotODataExposed"
  | "inspectOnlyUnsupportedParameters"
  | "inspectOnlyUnsupportedBinding"
  | "staleEnvironmentAuthority"
  | "notAction";

export type ActionExecutionReasonCode =
  | "PublicODataAction"
  | "SimplePreviewReadyParameters"
  | "ComplexParameterShape"
  | "EntityReferenceParameter"
  | "CollectionParameter"
  | "UnknownParameterType"
  | "BoundEntityAction"
  | "CollectionBoundAction"
  | "BoundRouteResolved"
  | "BoundRouteUnavailable"
  | "BoundTargetRequired"
  | "BoundTargetEntityMismatch"
  | "BoundTargetInvalidGuid"
  | "BoundTargetEnvironmentMismatch"
  | "EntityBoundActionRequiresTarget"
  | "CollectionBoundActionDeferred"
  | "BoundActionDeferred"
  | "PrivateCustomApi"
  | "MissingActionImport"
  | "ValidationUnavailable"
  | "EnvironmentChanged"
  | "AiPolicyDenied"
  | "GeneratedContentAdvisoryRequired"
  | "PotentialDestructiveOperation"
  | "PotentialBusinessStateChange"
  | "PotentialExternalSideEffect"
  | "NotAnAction";

export type ActionParameterTrustState =
  | "supportedPrimitive"
  | "supportedNullablePrimitive"
  | "supportedEnumLike"
  | "unsupportedComplexObject"
  | "unsupportedEntityReference"
  | "unsupportedCollection"
  | "unknownType";

export interface ActionParameterTrustClassification {
  parameterName: string;
  typeLabel: string;
  state: ActionParameterTrustState;
  supported: boolean;
  reasonCode: ActionExecutionReasonCode;
  reason: string;
}

export interface ActionExecutionReadinessOptions extends AiExecutionPolicyOptions {
  readonly boundTargetValidation?: BoundActionTargetValidationResult;
}

export interface ActionExecutionReadiness {
  state: ActionExecutionReadinessState;
  label: string;
  reason: string;
  reasonCodes: ActionExecutionReasonCode[];
  canPreview: boolean;
  canExecute: boolean;
  caution: boolean;
  requiresTypedConfirmation: boolean;
  confirmationPhrase?: string;
  parameterTrust: ActionParameterTrustClassification[];
}

const DESTRUCTIVE_PATTERN = /(^|[_\s-])(delete|remove|purge|destroy|erase|terminate)([_\s-]|$)/i;
const BUSINESS_STATE_PATTERN = /(^|[_\s-])(cancel|close|approve|reject|submit|post|publish|deactivate|activate|merge|assign|share|grant|revoke|void|refund|payment|pay|provision)([_\s-]|$)/i;
const EXTERNAL_SIDE_EFFECT_PATTERN = /(^|[_\s-])(send|email|notify|dispatch|sync|trigger|execute|callout|webhook|export)([_\s-]|$)/i;

function normalizeType(parameter: CustomApiRequestParameter): string {
  return (parameter.typeLabel || parameter.type || "").trim().toLowerCase();
}

function classifyParameterTrust(parameter: CustomApiRequestParameter): ActionParameterTrustClassification {
  const normalizedType = normalizeType(parameter);
  const typeLabel = parameter.typeLabel || parameter.type || "Unknown";
  const isOptional = parameter.isOptional === true;

  if (["boolean", "datetime", "decimal", "float", "guid", "integer", "string"].includes(normalizedType)) {
    return {
      parameterName: parameter.uniqueName,
      typeLabel,
      state: isOptional ? "supportedNullablePrimitive" : "supportedPrimitive",
      supported: parameter.executionSupport === "preview-ready",
      reasonCode: "SimplePreviewReadyParameters",
      reason: isOptional
        ? "Optional primitive parameter can be safely omitted or represented in the preview payload."
        : "Primitive parameter can be safely represented in the preview payload."
    };
  }

  if (["picklist", "choice", "optionset", "option set"].includes(normalizedType)) {
    return {
      parameterName: parameter.uniqueName,
      typeLabel,
      state: "supportedEnumLike",
      supported: parameter.executionSupport === "preview-ready",
      reasonCode: "SimplePreviewReadyParameters",
      reason: "Enum-like parameter is only executable when metadata marks it preview-ready."
    };
  }

  if (["entityreference", "entity reference", "lookup"].includes(normalizedType)) {
    return {
      parameterName: parameter.uniqueName,
      typeLabel,
      state: "unsupportedEntityReference",
      supported: false,
      reasonCode: "EntityReferenceParameter",
      reason: "Entity reference parameters need explicit record-binding semantics before execution support."
    };
  }

  if (["entitycollection", "stringarray", "collection", "array"].includes(normalizedType)) {
    return {
      parameterName: parameter.uniqueName,
      typeLabel,
      state: "unsupportedCollection",
      supported: false,
      reasonCode: "CollectionParameter",
      reason: "Collection parameters need a dedicated payload workspace before execution support."
    };
  }

  if (["entity", "money", "complex"].includes(normalizedType)) {
    return {
      parameterName: parameter.uniqueName,
      typeLabel,
      state: "unsupportedComplexObject",
      supported: false,
      reasonCode: "ComplexParameterShape",
      reason: "Complex parameters need explicit payload shaping before execution support."
    };
  }

  return {
    parameterName: parameter.uniqueName,
    typeLabel,
    state: "unknownType",
    supported: false,
    reasonCode: "UnknownParameterType",
    reason: "Unknown parameter types remain inspect-only until DV Quick Run can preview them deterministically."
  };
}

function mapBoundTargetValidationReasonCode(code: BoundActionTargetValidationResult["reasonCodes"][number]): ActionExecutionReasonCode {
  if (code === "BoundCollectionActionDeferred") {
    return "CollectionBoundActionDeferred";
  }

  return code;
}

function mapBoundTargetValidationReasonCodes(
  reasonCodes: readonly BoundActionTargetValidationResult["reasonCodes"][number][]
): ActionExecutionReasonCode[] {
  return reasonCodes.map(mapBoundTargetValidationReasonCode);
}

function uniqueReasonCodes(reasonCodes: readonly ActionExecutionReasonCode[]): ActionExecutionReasonCode[] {
  return [...new Set(reasonCodes)];
}

function operationSearchText(definition: CustomApiDefinition): string {
  return [definition.uniqueName, definition.displayName, definition.description].filter(Boolean).join(" ");
}

function getCautionReasonCodes(definition: CustomApiDefinition): ActionExecutionReasonCode[] {
  const text = operationSearchText(definition);
  const reasonCodes: ActionExecutionReasonCode[] = [];

  if (DESTRUCTIVE_PATTERN.test(text)) {
    reasonCodes.push("PotentialDestructiveOperation");
  }

  if (BUSINESS_STATE_PATTERN.test(text)) {
    reasonCodes.push("PotentialBusinessStateChange");
  }

  if (EXTERNAL_SIDE_EFFECT_PATTERN.test(text)) {
    reasonCodes.push("PotentialExternalSideEffect");
  }

  return reasonCodes;
}

function confirmationPhrase(definition: CustomApiDefinition): string {
  return definition.uniqueName.toUpperCase();
}

export function resolveActionExecutionReadiness(
  definition: CustomApiDefinition,
  options: ActionExecutionReadinessOptions = {}
): ActionExecutionReadiness {
  const parameterTrust = definition.requestParameters.map(classifyParameterTrust);

  if (definition.operationKind !== "Action") {
    return {
      state: "notAction",
      label: "Not an Action",
      reason: "This operation is not an Action and uses Function execution semantics.",
      reasonCodes: ["NotAnAction"],
      canPreview: true,
      canExecute: false,
      caution: false,
      requiresTypedConfirmation: false,
      parameterTrust
    };
  }

  if (definition.executionCapability?.state === "stale") {
    return {
      state: "staleEnvironmentAuthority",
      label: "Stale environment authority",
      reason: "The Action preview was created for a previous environment and must be regenerated before execution.",
      reasonCodes: ["EnvironmentChanged"],
      canPreview: false,
      canExecute: false,
      caution: true,
      requiresTypedConfirmation: false,
      parameterTrust
    };
  }

  const policy = evaluateAiExecutionPolicy(definition, options);
  if (policy.classification === "ai-related" && !policy.allowed) {
    return {
      state: "blockedByPolicy",
      label: "Blocked by AI policy",
      reason: policy.reason,
      reasonCodes: ["AiPolicyDenied"],
      canPreview: true,
      canExecute: false,
      caution: true,
      requiresTypedConfirmation: false,
      parameterTrust
    };
  }

  if (definition.isPrivate === true || definition.executionEligibility?.state === "preview-only-private") {
    return {
      state: "inspectOnlyInternal",
      label: "Inspect only — internal/private Action",
      reason: definition.executionEligibility?.reason || "Private or internal Actions remain inspect-only.",
      reasonCodes: ["PrivateCustomApi"],
      canPreview: true,
      canExecute: false,
      caution: false,
      requiresTypedConfirmation: false,
      parameterTrust
    };
  }

  if (definition.bindingKind === "Bound" || definition.executionEligibility?.state === "preview-only-bound-context-required") {
    const isCollectionBound = definition.boundTargetKind === "collection"
      || definition.executionEligibility?.odataBoundTargetKind === "collection";
    const isEntityBound = definition.boundTargetKind === "entity"
      || definition.executionEligibility?.odataBoundTargetKind === "entity";
    const targetValidation = options.boundTargetValidation;

    if (isEntityBound && targetValidation) {
      if (targetValidation.valid) {
        const unsupportedParameterReasons = parameterTrust
          .filter((parameter) => !parameter.supported)
          .map((parameter) => parameter.reasonCode);

        if (definition.executionReadiness !== "preview-ready" || unsupportedParameterReasons.length > 0) {
          return {
            state: "inspectOnlyUnsupportedParameters",
            label: "Inspect only — unsupported parameters",
            reason: definition.executionReadinessReason || "This bound Action has parameter shapes that cannot be previewed deterministically yet.",
            reasonCodes: uniqueReasonCodes(unsupportedParameterReasons.length > 0 ? unsupportedParameterReasons : ["ComplexParameterShape"]),
            canPreview: true,
            canExecute: false,
            caution: false,
            requiresTypedConfirmation: false,
            parameterTrust
          };
        }

        const cautionReasonCodes = getCautionReasonCodes(definition);
        if (policy.classification === "ai-related" && policy.allowed) {
          cautionReasonCodes.push("GeneratedContentAdvisoryRequired");
        }

        const caution = cautionReasonCodes.length > 0;
        return {
          state: caution ? "readyWithCaution" : "ready",
          label: caution ? "Run bound Action with caution" : "Ready to run bound Action",
          reason: caution
            ? "The target row id, binding entity, and entity set are valid for execution. Operational-impact signals detected; review recommended."
            : "The target row id, binding entity, entity set, and preview-ready payload are valid. This bound Action can run after explicit confirmation.",
          reasonCodes: uniqueReasonCodes([
            "BoundEntityAction",
            "BoundRouteResolved",
            "SimplePreviewReadyParameters",
            ...mapBoundTargetValidationReasonCodes(targetValidation.reasonCodes),
            ...cautionReasonCodes
          ]),
          canPreview: true,
          canExecute: true,
          caution,
          requiresTypedConfirmation: cautionReasonCodes.includes("PotentialDestructiveOperation"),
          confirmationPhrase: cautionReasonCodes.includes("PotentialDestructiveOperation") ? confirmationPhrase(definition) : undefined,
          parameterTrust
        };
      }

      return {
        state: targetValidation.reasonCodes.includes("BoundTargetEnvironmentMismatch") ? "staleEnvironmentAuthority" : "inspectOnlyUnsupportedBinding",
        label: targetValidation.label,
        reason: targetValidation.reason,
        reasonCodes: mapBoundTargetValidationReasonCodes(targetValidation.reasonCodes),
        canPreview: true,
        canExecute: false,
        caution: targetValidation.reasonCodes.includes("BoundTargetEnvironmentMismatch"),
        requiresTypedConfirmation: false,
        parameterTrust
      };
    }

    if (isCollectionBound) {
      const unsupportedParameterReasons = parameterTrust
        .filter((parameter) => !parameter.supported)
        .map((parameter) => parameter.reasonCode);
      const entitySetName = definition.boundEntitySetName || definition.executionEligibility?.odataBoundEntitySetName || "";
      const hasResolvedCollectionRoute = entitySetName.trim().length > 0 && entitySetName !== "<entity-set-unresolved>";

      if (!hasResolvedCollectionRoute) {
        return {
          state: "inspectOnlyUnsupportedBinding",
          label: "Inspect only — collection route unavailable",
          reason: "The collection-bound entity set could not be resolved from OData metadata, so DV Quick Run cannot create an executable route.",
          reasonCodes: ["BoundRouteUnavailable"],
          canPreview: true,
          canExecute: false,
          caution: false,
          requiresTypedConfirmation: false,
          parameterTrust
        };
      }

      if (definition.executionReadiness !== "preview-ready" || unsupportedParameterReasons.length > 0) {
        return {
          state: "inspectOnlyUnsupportedParameters",
          label: "Inspect only — unsupported parameters",
          reason: definition.executionReadinessReason || "This collection-bound Action has parameter shapes that cannot be previewed deterministically yet.",
          reasonCodes: uniqueReasonCodes(unsupportedParameterReasons.length > 0 ? unsupportedParameterReasons : ["ComplexParameterShape"]),
          canPreview: true,
          canExecute: false,
          caution: false,
          requiresTypedConfirmation: false,
          parameterTrust
        };
      }

      const cautionReasonCodes = getCautionReasonCodes(definition);
      if (policy.classification === "ai-related" && policy.allowed) {
        cautionReasonCodes.push("GeneratedContentAdvisoryRequired");
      }

      const caution = cautionReasonCodes.length > 0;
      return {
        state: caution ? "readyWithCaution" : "ready",
        label: caution ? "Run collection-bound Action with caution" : "Ready to run collection-bound Action",
        reason: caution
          ? "The collection-bound entity set route and preview-ready payload are valid for execution. Operational-impact signals detected; review recommended."
          : "The collection-bound entity set route and preview-ready payload are valid. This Action can run after explicit confirmation.",
        reasonCodes: uniqueReasonCodes([
          "CollectionBoundAction",
          "BoundRouteResolved",
          "SimplePreviewReadyParameters",
          ...cautionReasonCodes
        ]),
        canPreview: true,
        canExecute: true,
        caution,
        requiresTypedConfirmation: cautionReasonCodes.includes("PotentialDestructiveOperation"),
        confirmationPhrase: cautionReasonCodes.includes("PotentialDestructiveOperation") ? confirmationPhrase(definition) : undefined,
        parameterTrust
      };
    }

    return {
      state: "inspectOnlyUnsupportedBinding",
      label: isEntityBound
        ? "Inspect only — target row required"
        : "Inspect only — bound Action deferred",
      reason: definition.executionEligibility?.reason || definition.boundTargetReason || "Bound Action execution needs selected row/entity context and is deferred.",
      reasonCodes: isEntityBound ? ["EntityBoundActionRequiresTarget"] : ["BoundActionDeferred"],
      canPreview: true,
      canExecute: false,
      caution: false,
      requiresTypedConfirmation: false,
      parameterTrust
    };
  }

  const unsupportedParameterReasons = parameterTrust
    .filter((parameter) => !parameter.supported)
    .map((parameter) => parameter.reasonCode);
  if (definition.executionReadiness !== "preview-ready" || unsupportedParameterReasons.length > 0) {
    return {
      state: "inspectOnlyUnsupportedParameters",
      label: "Inspect only — unsupported parameters",
      reason: definition.executionReadinessReason || "This Action has parameter shapes that cannot be previewed deterministically yet.",
      reasonCodes: uniqueReasonCodes(unsupportedParameterReasons.length > 0 ? unsupportedParameterReasons : ["ComplexParameterShape"]),
      canPreview: true,
      canExecute: false,
      caution: false,
      requiresTypedConfirmation: false,
      parameterTrust
    };
  }

  if (definition.executionEligibility?.state === "unknown-validation-unavailable") {
    return {
      state: "inspectOnlyNotODataExposed",
      label: "Inspect only — validation unavailable",
      reason: definition.executionEligibility.reason,
      reasonCodes: ["ValidationUnavailable"],
      canPreview: true,
      canExecute: false,
      caution: false,
      requiresTypedConfirmation: false,
      parameterTrust
    };
  }

  if (definition.executionEligibility?.state !== "executable") {
    return {
      state: "inspectOnlyNotODataExposed",
      label: "Inspect only — not OData-exposed",
      reason: definition.executionEligibility?.reason || "This Action was not matched to an ActionImport in the active environment.",
      reasonCodes: ["MissingActionImport"],
      canPreview: true,
      canExecute: false,
      caution: false,
      requiresTypedConfirmation: false,
      parameterTrust
    };
  }

  const cautionReasonCodes = getCautionReasonCodes(definition);
  if (policy.classification === "ai-related" && policy.allowed) {
    cautionReasonCodes.push("GeneratedContentAdvisoryRequired");
  }

  const caution = cautionReasonCodes.length > 0;
  return {
    state: caution ? "readyWithCaution" : "ready",
    label: caution ? "Run with caution" : "Ready to run",
    reason: caution
      ? "Metadata-valid and executable. Operational-impact signals detected; review recommended."
      : "This public unbound Action is OData-exposed, preview-ready, and executable after explicit confirmation.",
    reasonCodes: uniqueReasonCodes(["PublicODataAction", "SimplePreviewReadyParameters", ...cautionReasonCodes]),
    canPreview: true,
    canExecute: true,
    caution,
    requiresTypedConfirmation: cautionReasonCodes.includes("PotentialDestructiveOperation"),
    confirmationPhrase: cautionReasonCodes.includes("PotentialDestructiveOperation") ? confirmationPhrase(definition) : undefined,
    parameterTrust
  };
}
