import operatorCatalogJson from "./fetchXmlOperators.json";
import type {
    FetchXmlOperatorCatalog,
    FetchXmlOperatorCategory,
    FetchXmlOperatorDef,
    FetchXmlOperatorPresentationMode,
    FetchXmlOperatorSupportTier
} from "./fetchXmlOperatorTypes.js";

const operatorCatalog = operatorCatalogJson as FetchXmlOperatorCatalog;

export function getFetchXmlOperatorCatalog(): FetchXmlOperatorCatalog {
    return operatorCatalog;
}

export function getAllFetchXmlOperators(): FetchXmlOperatorDef[] {
    return [...operatorCatalog.operators].sort((a, b) => a.order - b.order);
}

export function getFetchXmlOperatorsByTier(
    supportTier: FetchXmlOperatorSupportTier
): FetchXmlOperatorDef[] {
    return getAllFetchXmlOperators().filter((operator) => operator.supportTier === supportTier);
}

export function getOfficialFetchXmlOperators(): FetchXmlOperatorDef[] {
    return getFetchXmlOperatorsByTier("official").filter((operator) => operator.visibleInFetchXmlUi);
}

export function getFetchXmlOperatorsForCategory(
    category: FetchXmlOperatorCategory,
    supportTier?: FetchXmlOperatorSupportTier
): FetchXmlOperatorDef[] {
    return getAllFetchXmlOperators().filter((operator) => {
        const tierMatches = supportTier ? operator.supportTier === supportTier : true;

        return tierMatches && operator.supportedCategories.includes(category);
    });
}

export function getFetchXmlOperatorLabel(
    operator: FetchXmlOperatorDef,
    presentationMode: FetchXmlOperatorPresentationMode
): string {
    return operator.labels[presentationMode];
}

export function getFetchXmlOperatorsGroupedByClassification(
    supportTier: FetchXmlOperatorSupportTier = "official"
): Record<string, FetchXmlOperatorDef[]> {
    return getAllFetchXmlOperators()
        .filter((operator) => operator.supportTier === supportTier)
        .reduce<Record<string, FetchXmlOperatorDef[]>>((groups, operator) => {
            const classification = operator.classification;

            if (!groups[classification]) {
                groups[classification] = [];
            }

            groups[classification].push(operator);

            return groups;
        }, {});
}