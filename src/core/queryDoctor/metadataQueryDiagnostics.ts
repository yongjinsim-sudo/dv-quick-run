import {
  buildLookupReferenceText,
  isMultiTargetLookup,
  type LookupUnderstanding,
  type QueryMetadataContext
} from "../metadata/lookupUnderstanding.js";
import type { QuerySemanticModel } from "../query/querySemanticModel.js";
import {
  addExpand,
  addSelectField,
  replaceExpandNavigation,
  replaceFilterField,
  replaceSelectField
} from "../query/queryRewrite.js";
import { buildStableRecommendationId, dedupeAndRankRecommendations } from "../recommendations/recommendationEngine.js";

export type MetadataQueryDiagnosticCode =
  | "LookupDirectExpand"
  | "PolymorphicTargetRequired"
  | "UnsupportedLookupTarget"
  | "UnknownNavigationProperty"
  | "NavigationPropertyWrongEntity"
  | "LookupValueUsedAsNavigation"
  | "NavigationUsedAsScalarField"
  | "LookupMetadataUnavailable"
  | "AmbiguousRelationshipDirection"
  | "ValidTargetMayReturnNull"
  | "MalformedQueryOption"
  | "DuplicateQueryOption"
  | "LookupIdentifierSelected";

export interface MetadataSuggestedQuery {
  readonly label: string;
  readonly query: string;
  readonly targetEntityLogicalName?: string;
}

export type MetadataLookupDiscoveryAction =
  | { readonly actionType: "query"; readonly suggestion: MetadataSuggestedQuery }
  | { readonly actionType: "copyReference"; readonly referenceText: string };

export interface MetadataQueryDiagnostic {
  readonly id: string;
  readonly ruleId: string;
  readonly code: MetadataQueryDiagnosticCode;
  readonly severity: "info" | "warning" | "error";
  readonly title: string;
  readonly message: string;
  readonly field?: string;
  readonly navigationProperty?: string;
  readonly supportedTargets?: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly limitations: readonly string[];
  readonly suggestedQueries: readonly MetadataSuggestedQuery[];
}

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function stableId(ruleId: string, semanticKey: string): string {
  return buildStableRecommendationId("metadata-diagnostic", ruleId, semanticKey);
}

function navigationEntries(lookup: LookupUnderstanding) {
  return lookup.targetEntities.flatMap((target) =>
    target.navigationProperties.map((navigation) => ({ target, navigation }))
  );
}

function targetSuggestions(source: string, lookup: LookupUnderstanding, replaceNavigation?: string): MetadataSuggestedQuery[] {
  return navigationEntries(lookup).map(({ target, navigation }) => {
    const primaryFields = target.primaryNameAttributeState === "Validated" && target.primaryNameAttribute
      ? [target.primaryNameAttribute]
      : undefined;
    const query = replaceNavigation
      ? replaceExpandNavigation(source, replaceNavigation, navigation.name, primaryFields)
      : addExpand(addSelectField(source, lookup.lookupValueProperty), navigation.name, primaryFields);
    return {
      label: `Use ${target.displayName ?? target.entityLogicalName} navigation \`${navigation.name}\``,
      query,
      targetEntityLogicalName: target.entityLogicalName
    };
  });
}

export function buildLookupDiscoverySuggestions(
  source: string,
  lookup: LookupUnderstanding
): MetadataSuggestedQuery[] {
  return [
    {
      label: `Add ${lookup.displayName ?? lookup.attributeLogicalName} identifier \`${lookup.lookupValueProperty}\``,
      query: addSelectField(source, lookup.lookupValueProperty)
    },
    ...targetSuggestions(source, lookup)
  ];
}

export function buildLookupDiscoveryActions(
  source: string,
  lookup: LookupUnderstanding
): MetadataLookupDiscoveryAction[] {
  return [
    ...buildLookupDiscoverySuggestions(source, lookup).map((suggestion) => ({
      actionType: "query" as const,
      suggestion
    })),
    {
      actionType: "copyReference",
      referenceText: buildLookupReferenceText(lookup)
    }
  ];
}

function findByAttribute(context: QueryMetadataContext, token: string): LookupUnderstanding | undefined {
  const normalized = normalize(token);
  return context.lookupUnderstandings.find((lookup) =>
    normalize(lookup.attributeLogicalName) === normalized || normalize(lookup.lookupValueProperty) === normalized
  );
}

function findByNavigation(context: QueryMetadataContext, token: string): LookupUnderstanding | undefined {
  const normalized = normalize(token);
  return context.lookupUnderstandings.find((lookup) =>
    navigationEntries(lookup).some(({ navigation }) => normalize(navigation.name) === normalized)
  );
}

function likelyLookup(context: QueryMetadataContext, navigation: string): LookupUnderstanding | undefined {
  const normalized = normalize(navigation).replace(/[^a-z0-9]/g, "");
  return context.lookupUnderstandings.find((lookup) => {
    const attribute = normalize(lookup.attributeLogicalName).replace(/[^a-z0-9]/g, "");
    return normalized.includes(attribute) || attribute.includes(normalized);
  });
}

function diagnostic(input: Omit<MetadataQueryDiagnostic, "id"> & { semanticKey: string }): MetadataQueryDiagnostic {
  const { semanticKey, ...value } = input;
  return { ...value, id: stableId(value.ruleId, semanticKey) };
}

export function buildMetadataQueryDiagnostics(
  model: QuerySemanticModel,
  context: QueryMetadataContext
): MetadataQueryDiagnostic[] {
  const findings: MetadataQueryDiagnostic[] = [];

  for (const parseDiagnostic of model.parseDiagnostics) {
    if (parseDiagnostic.code !== "MalformedQueryOption" && parseDiagnostic.code !== "DuplicateQueryOption") {
      continue;
    }
    const code = parseDiagnostic.code;
    findings.push(diagnostic({
      semanticKey: `${code}:${parseDiagnostic.optionName ?? parseDiagnostic.message}`,
      ruleId: code === "MalformedQueryOption" ? "query-shape.malformed-option" : "query-shape.duplicate-option",
      code,
      severity: code === "MalformedQueryOption" ? "error" : "warning",
      title: code === "MalformedQueryOption" ? "Correct the malformed query option" : "Review the duplicate query option",
      message: parseDiagnostic.message,
      evidenceRefs: [],
      limitations: [],
      suggestedQueries: []
    }));
  }

  const hasMetadataSensitiveShape = model.selectedFields.some((item) => /^_.+_value$/i.test(item.fieldName))
    || model.expandedProperties.length > 0;
  if (context.state !== "Resolved" && hasMetadataSensitiveShape) {
    findings.push(diagnostic({
      semanticKey: `${context.entityLogicalName}:${context.state}`,
      ruleId: "metadata.lookup-context-unavailable",
      code: "LookupMetadataUnavailable",
      severity: "info",
      title: "Refresh metadata context",
      message: `Lookup metadata is ${context.state.toLowerCase()} for \`${context.entityLogicalName}\`; DVQR can parse the query but cannot fully validate target or navigation semantics.`,
      evidenceRefs: [],
      limitations: context.limitations,
      suggestedQueries: []
    }));
  }

  for (const selected of model.selectedFields) {
    const lookup = findByAttribute(context, selected.fieldName);
    if (lookup && normalize(selected.fieldName) === normalize(lookup.attributeLogicalName)) {
      findings.push(diagnostic({
        semanticKey: `select:${lookup.attributeLogicalName}`,
        ruleId: "lookup.use-value-property-in-select",
        code: "LookupValueUsedAsNavigation",
        severity: "error",
        title: "Select the lookup identifier property",
        message: `\`${lookup.attributeLogicalName}\` is the Dataverse lookup attribute, not its Web API scalar value property. Use \`${lookup.lookupValueProperty}\` in \`$select\`.`,
        field: selected.fieldName,
        supportedTargets: lookup.targetEntities.map((target) => target.entityLogicalName),
        evidenceRefs: lookup.evidenceRefs,
        limitations: lookup.limitations,
        suggestedQueries: [{
          label: `Replace with ${lookup.lookupValueProperty}`,
          query: replaceSelectField(model.sourceText, selected.raw, lookup.lookupValueProperty)
        }]
      }));
      continue;
    }

    const navigationLookup = findByNavigation(context, selected.fieldName);
    if (navigationLookup) {
      findings.push(diagnostic({
        semanticKey: `navigation-in-select:${selected.fieldName}`,
        ruleId: "navigation.not-scalar-select",
        code: "NavigationUsedAsScalarField",
        severity: "error",
        title: "Move the navigation property to $expand",
        message: `\`${selected.fieldName}\` is a navigation property and cannot be selected as a scalar field. Select \`${navigationLookup.lookupValueProperty}\` for the identifier or expand the navigation property for target fields.`,
        field: selected.fieldName,
        evidenceRefs: navigationLookup.evidenceRefs,
        limitations: navigationLookup.limitations,
        suggestedQueries: [
          {
            label: `Select ${navigationLookup.lookupValueProperty}`,
            query: replaceSelectField(model.sourceText, selected.raw, navigationLookup.lookupValueProperty)
          },
          {
            label: `Select the identifier and expand ${selected.fieldName}`,
            query: addExpand(replaceSelectField(model.sourceText, selected.raw, navigationLookup.lookupValueProperty), selected.fieldName)
          }
        ]
      }));
      continue;
    }

    if (lookup && normalize(selected.fieldName) === normalize(lookup.lookupValueProperty) && isMultiTargetLookup(lookup)) {
      findings.push(diagnostic({
        semanticKey: `identifier:${lookup.attributeLogicalName}`,
        ruleId: "lookup.multi-target-identifier-selected",
        code: "LookupIdentifierSelected",
        severity: "info",
        title: "Choose a target only when target fields are needed",
        message: `\`${lookup.lookupValueProperty}\` retrieves the ${lookup.displayName ?? lookup.attributeLogicalName} identifier. This is a multi-target lookup, so target fields require a target-specific navigation property.`,
        field: selected.fieldName,
        supportedTargets: lookup.targetEntities.map((target) => target.entityLogicalName),
        evidenceRefs: lookup.evidenceRefs,
        limitations: lookup.limitations,
        suggestedQueries: targetSuggestions(model.sourceText, lookup)
      }));
    }
  }

  for (const filter of model.filterReferences) {
    const lookup = findByAttribute(context, filter.fieldName);
    if (lookup && normalize(filter.fieldName) === normalize(lookup.attributeLogicalName)) {
      findings.push(diagnostic({
        semanticKey: `filter:${lookup.attributeLogicalName}`,
        ruleId: "lookup.filter-on-value-property",
        code: "LookupValueUsedAsNavigation",
        severity: "error",
        title: "Filter using the lookup value property",
        message: `Filter \`${filter.raw}\` uses the lookup attribute name. Dataverse lookup GUID filters should use \`${lookup.lookupValueProperty}\`.`,
        field: filter.fieldName,
        evidenceRefs: lookup.evidenceRefs,
        limitations: lookup.limitations,
        suggestedQueries: [{
          label: `Filter using ${lookup.lookupValueProperty}`,
          query: replaceFilterField(model.sourceText, filter.raw, lookup.lookupValueProperty)
        }]
      }));
    }
  }

  for (const expand of model.expandedProperties) {
    const navigationLookup = findByNavigation(context, expand.navigationProperty);
    if (navigationLookup) {
      if (isMultiTargetLookup(navigationLookup)) {
        const entry = navigationEntries(navigationLookup).find(({ navigation }) => normalize(navigation.name) === normalize(expand.navigationProperty));
        findings.push(diagnostic({
          semanticKey: `valid-target:${expand.navigationProperty}`,
          ruleId: "lookup.valid-target-may-return-null",
          code: "ValidTargetMayReturnNull",
          severity: "warning",
          title: "Verify the runtime lookup target",
          message: `\`${expand.navigationProperty}\` is valid for the ${entry?.target.displayName ?? entry?.target.entityLogicalName ?? "selected"} target. Rows referencing another supported target may return null expansion data.`,
          navigationProperty: expand.navigationProperty,
          supportedTargets: navigationLookup.targetEntities.map((target) => target.entityLogicalName),
          evidenceRefs: navigationLookup.evidenceRefs,
          limitations: ["A metadata-valid target is not proof of the target used by a particular row."],
          suggestedQueries: []
        }));
      }
      continue;
    }

    const directLookup = findByAttribute(context, expand.navigationProperty);
    if (directLookup) {
      findings.push(diagnostic({
        semanticKey: `direct-expand:${directLookup.attributeLogicalName}`,
        ruleId: "lookup.require-target-navigation",
        code: isMultiTargetLookup(directLookup) ? "PolymorphicTargetRequired" : "LookupDirectExpand",
        severity: "error",
        title: isMultiTargetLookup(directLookup) ? "Choose a target-specific navigation property" : "Use the metadata navigation property",
        message: `\`${expand.navigationProperty}\` is a lookup attribute/value property and is not a valid navigation property for \`$expand\`.`,
        navigationProperty: expand.navigationProperty,
        supportedTargets: directLookup.targetEntities.map((target) => target.entityLogicalName),
        evidenceRefs: directLookup.evidenceRefs,
        limitations: directLookup.limitations,
        suggestedQueries: targetSuggestions(model.sourceText, directLookup, expand.navigationProperty)
      }));
      continue;
    }

    if (context.state === "Resolved" && !context.knownNavigationProperties.some((item) => normalize(item) === normalize(expand.navigationProperty))) {
      const likely = likelyLookup(context, expand.navigationProperty);
      findings.push(diagnostic({
        semanticKey: `unknown-navigation:${expand.navigationProperty}`,
        ruleId: "navigation.unknown-for-source-table",
        code: likely ? "UnsupportedLookupTarget" : "UnknownNavigationProperty",
        severity: "error",
        title: "Use a navigation property from current environment metadata",
        message: `\`${expand.navigationProperty}\` is not a recognised navigation property on \`${context.entityLogicalName}\` in ${context.environmentLabel ?? "the active environment"}.`,
        navigationProperty: expand.navigationProperty,
        supportedTargets: likely?.targetEntities.map((target) => target.entityLogicalName),
        evidenceRefs: likely?.evidenceRefs ?? [],
        limitations: [],
        suggestedQueries: likely ? targetSuggestions(model.sourceText, likely, expand.navigationProperty) : []
      }));
    }
  }

  const weight = { error: 3, warning: 2, info: 1 } as const;
  return dedupeAndRankRecommendations(findings.map((finding) => ({
    ...finding,
    rank: weight[finding.severity] * 100
  }))).map(({ rank: _rank, ...finding }) => finding);
}
