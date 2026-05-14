import type { CustomApiDefinition, CustomApiExecutionEligibility } from "../models/customApiTypes.js";
import type { ODataOperationRegistry } from "./odataMetadataParser.js";
import { findODataOperationForCustomApi } from "./odataOperationMatcher.js";
import { withCustomApiExecutionCapability } from "../execution/customApiExecutionCapabilityResolver.js";

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

  if (definition.executionReadiness !== "preview-ready") {
    return {
      state: "preview-only-unsupported-parameters",
      label: "Preview only — unsupported parameters",
      reason: "This API has complex or unknown parameter types. DV Quick Run can inspect the metadata but will not execute it yet."
    };
  }

  if (definition.bindingKind === "Bound") {
    const operation = findODataOperationForCustomApi(registry, definition);
    return {
      state: "preview-only-bound-context-required",
      label: "Preview only — bound context required",
      reason: operation
        ? "This operation appears in OData metadata, but bound execution needs selected row/entity context and remains preview-only."
        : "This operation is bound and was not confirmed as a callable OData operation for the current metadata snapshot.",
      odataName: operation?.name,
      odataQualifiedName: operation?.qualifiedName,
      odataInvocationName: operation?.importName || operation?.qualifiedName,
      odataKind: operation?.kind,
      odataBindingKind: operation?.bindingKind
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
      odataBindingKind: operation.bindingKind
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
    odataBindingKind: operation.bindingKind
  };
}

export function applyCustomApiExecutionEligibility(
  definitions: CustomApiDefinition[],
  registry: ODataOperationRegistry | undefined,
  unavailableReason?: string
): CustomApiDefinition[] {
  const unknown = unavailableReason ? buildUnknownODataEligibility(unavailableReason) : undefined;
  return definitions.map((definition) => withCustomApiExecutionCapability({
    ...definition,
    executionEligibility: unknown ?? resolveCustomApiExecutionEligibility(definition, registry)
  }));
}
