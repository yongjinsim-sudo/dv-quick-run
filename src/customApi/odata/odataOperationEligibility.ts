import type { CustomApiDefinition, CustomApiExecutionEligibility } from "../models/customApiTypes.js";
import type { ODataOperationRegistry } from "./odataMetadataParser.js";
import { findODataOperationForCustomApi } from "./odataOperationMatcher.js";
import { withCustomApiExecutionCapability, type CustomApiExecutionCapabilityResolverOptions } from "../execution/customApiExecutionCapabilityResolver.js";

export function buildUnknownODataEligibility(reason: string): CustomApiExecutionEligibility {
  return {
    state: "unknown-validation-unavailable",
    label: "Validation unavailable",
    reason
  };
}

export function resolveCustomApiExecutionEligibility(
  definition: CustomApiDefinition,
  registry: ODataOperationRegistry | undefined
): CustomApiExecutionEligibility {
  if (!registry) {
    return buildUnknownODataEligibility("OData $metadata could not be loaded, so DV Quick Run cannot confirm whether this operation is executable through the Web API.");
  }

  if (definition.isPrivate === true) {
    return {
      state: "preview-only-private",
      label: "Inspect only — private API",
      reason: "This API is marked private in Custom API metadata. DV Quick Run keeps private operations inspect-only even if similar operation metadata appears in OData."
    };
  }

  if (definition.executionReadiness !== "preview-ready") {
    return {
      state: "preview-only-unsupported-parameters",
      label: "Preview only — unsupported parameters",
      reason: "This API has complex or unknown parameter types. DV Quick Run can inspect the metadata but will not execute it yet."
    };
  }

  if (definition.bindingKind === "Bound") {
    const operation = findODataOperationForCustomApi(registry, definition);
    const isCollectionBound = definition.boundTargetKind === "collection" || operation?.boundTargetKind === "collection";
    const isEntityBound = definition.boundTargetKind === "entity" || operation?.boundTargetKind === "entity";

    return {
      state: "preview-only-bound-context-required",
      label: isCollectionBound
        ? "Preview-ready — collection-bound Action"
        : isEntityBound
          ? "Inspect only — target row required"
          : "Inspect only — bound context required",
      reason: operation
        ? isCollectionBound
          ? "This operation appears in OData metadata as collection-bound. Collection-bound execution does not require a target row and can run after explicit preview confirmation when parameters are supported."
          : isEntityBound
            ? "This operation appears in OData metadata as entity-bound. Bound execution requires explicit target row context before it can run."
            : "This operation appears in OData metadata, but DV Quick Run could not classify the bound target shape deterministically."
        : "This operation is bound and was not confirmed as a callable OData operation for the current metadata snapshot.",
      odataName: operation?.name,
      odataQualifiedName: operation?.qualifiedName,
      odataInvocationName: operation?.importName || operation?.qualifiedName,
      odataKind: operation?.kind,
      odataBindingKind: operation?.bindingKind,
      odataBoundTargetKind: operation?.boundTargetKind,
      odataBoundEntityLogicalName: operation?.boundEntityLogicalName,
      odataBoundEntitySetName: operation?.boundEntitySetName,
      odataBindingParameterName: operation?.bindingParameterName
    };
  }

  const operation = findODataOperationForCustomApi(registry, definition);
  if (!operation) {
    return {
      state: "preview-only-not-found",
      label: "Preview only — not found in OData metadata",
      reason: "This API exists in Custom API metadata, but DV Quick Run did not find a matching FunctionImport/ActionImport or operation definition in $metadata. It may be internal, feature-gated, SDK-only, or not exposed through Web API."
    };
  }

  if (operation.bindingKind === "Unbound" && !operation.importName) {
    return {
      state: "preview-only-not-found",
      label: "Preview only — no OData import route",
      reason: "This operation definition appears in $metadata, but DV Quick Run did not find a matching FunctionImport/ActionImport route. It may not be directly callable through the Web API import surface.",
      odataName: operation.name,
      odataQualifiedName: operation.qualifiedName,
      odataKind: operation.kind,
      odataBindingKind: operation.bindingKind,
      odataBoundTargetKind: operation.boundTargetKind,
      odataBoundEntityLogicalName: operation.boundEntityLogicalName,
      odataBoundEntitySetName: operation.boundEntitySetName,
      odataBindingParameterName: operation.bindingParameterName
    };
  }

  return {
    state: "executable",
    label: "Executable via OData metadata",
    reason: "This API was matched against the OData $metadata operation surface for the active environment.",
    odataName: operation.importName || operation.name,
    odataQualifiedName: operation.qualifiedName,
    odataInvocationName: operation.importName || operation.qualifiedName,
    odataKind: operation.kind,
    odataBindingKind: operation.bindingKind,
    odataBoundTargetKind: operation.boundTargetKind,
    odataBoundEntityLogicalName: operation.boundEntityLogicalName,
    odataBoundEntitySetName: operation.boundEntitySetName,
    odataBindingParameterName: operation.bindingParameterName
  };
}

export function applyCustomApiExecutionEligibility(
  definitions: CustomApiDefinition[],
  registry: ODataOperationRegistry | undefined,
  unavailableReason?: string,
  options: CustomApiExecutionCapabilityResolverOptions = {}
): CustomApiDefinition[] {
  const unknown = unavailableReason ? buildUnknownODataEligibility(unavailableReason) : undefined;
  return definitions.map((definition) => withCustomApiExecutionCapability({
    ...definition,
    executionEligibility: unknown ?? resolveCustomApiExecutionEligibility(definition, registry)
  }, options));
}
