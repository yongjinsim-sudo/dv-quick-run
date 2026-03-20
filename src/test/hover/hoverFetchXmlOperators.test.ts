import * as assert from "assert";
import {
    getOfficialFetchXmlOperators,
    getFetchXmlOperatorLabel,
    getFetchXmlOperatorsGroupedByClassification
} from "../../shared/fetchXml/fetchXmlOperatorCatalog.js";

suite("hoverFetchXmlOperators", () => {
    test("official operators exposed to standard FetchXML UX are available", () => {
        const operators = getOfficialFetchXmlOperators();

        assert.ok(operators.length > 0);
        assert.ok(operators.every((operator) => operator.supportTier === "official"));
        assert.ok(operators.every((operator) => operator.visibleInFetchXmlUi));
    });

    test("official operators provide polished labels for standard UX", () => {
        const operators = getOfficialFetchXmlOperators();

        operators.forEach((operator) => {
            const label = getFetchXmlOperatorLabel(operator, "polished");

            assert.ok(label.trim().length > 0, `${operator.key} missing polished label`);
        });
    });

    test("official operators provide raw labels for advanced UX modes", () => {
        const operators = getOfficialFetchXmlOperators();

        operators.forEach((operator) => {
            const label = getFetchXmlOperatorLabel(operator, "raw");

            assert.ok(label.trim().length > 0, `${operator.key} missing raw label`);
        });
    });

    test("official operators provide grouped labels for grouped presentation mode", () => {
        const operators = getOfficialFetchXmlOperators();

        operators.forEach((operator) => {
            const label = getFetchXmlOperatorLabel(operator, "grouped");

            assert.ok(label.trim().length > 0, `${operator.key} missing grouped label`);
        });
    });

    test("official operators have descriptions and diagnostic summaries for user-facing help", () => {
        const operators = getOfficialFetchXmlOperators();

        operators.forEach((operator) => {
            assert.ok(operator.description.trim().length > 0, `${operator.key} missing description`);
            assert.ok(
                operator.diagnostics.summary.trim().length > 0,
                `${operator.key} missing diagnostics summary`
            );
        });
    });

    test("official operators can be grouped by classification", () => {
        const grouped = getFetchXmlOperatorsGroupedByClassification("official");
        const groupKeys = Object.keys(grouped);

        assert.ok(groupKeys.length > 0);

        for (const groupKey of groupKeys) {
            const operators = grouped[groupKey];

            assert.ok(operators.length > 0, `classification '${groupKey}' should not be empty`);
            assert.ok(
                operators.every((operator) => operator.supportTier === "official"),
                `classification '${groupKey}' contains non-official operators`
            );
        }
    });

    test("official operators declare valid user-facing value contracts", () => {
        const operators = getOfficialFetchXmlOperators();

        operators.forEach((operator) => {
            assert.ok(
                ["none", "single", "multiple"].includes(operator.valueCount),
                `${operator.key} has invalid valueCount`
            );

            assert.strictEqual(
                operator.requiresValue,
                operator.valueCount !== "none",
                `${operator.key} has inconsistent requiresValue/valueCount`
            );
        });
    });
});