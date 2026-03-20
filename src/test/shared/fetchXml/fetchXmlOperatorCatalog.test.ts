import * as assert from "assert";
import {
    getAllFetchXmlOperators,
    getFetchXmlOperatorCatalog,
    getFetchXmlOperatorLabel,
    getFetchXmlOperatorsForCategory,
    getOfficialFetchXmlOperators
} from "../../../shared/fetchXml/fetchXmlOperatorCatalog.js";

suite("fetchXmlOperatorCatalog", () => {
    test("catalog exposes supported presentation modes", () => {
        const catalog = getFetchXmlOperatorCatalog();

        assert.deepStrictEqual(catalog.presentationModes, ["polished", "raw", "grouped"]);
    });

    test("official operators shown in UI are marked official", () => {
        const operators = getOfficialFetchXmlOperators();

        assert.ok(operators.length > 0);
        assert.ok(operators.every((operator) => operator.supportTier === "official"));
        assert.ok(operators.every((operator) => operator.visibleInFetchXmlUi));
    });

    test("string category returns like operator", () => {
        const operators = getFetchXmlOperatorsForCategory("string", "official");
        const keys = operators.map((operator) => operator.key);

        assert.ok(keys.includes("like"));
    });

    test("label resolver returns polished and raw labels correctly", () => {
        const eq = getAllFetchXmlOperators().find((operator) => operator.key === "eq");

        assert.ok(eq);
        assert.strictEqual(getFetchXmlOperatorLabel(eq, "polished"), "Equals");
        assert.strictEqual(getFetchXmlOperatorLabel(eq, "raw"), "eq");
        assert.strictEqual(getFetchXmlOperatorLabel(eq, "grouped"), "Equality");
    });

    test("official operators require basic diagnostics and description", () => {
        const operators = getOfficialFetchXmlOperators();

        operators.forEach((operator) => {
            assert.ok(operator.description.trim().length > 0);
            assert.ok(operator.diagnostics.summary.trim().length > 0);
        });
    });

    test("all operator keys are unique", () => {
        const operators = getAllFetchXmlOperators();
        const keys = operators.map((operator) => operator.key);
        const uniqueKeys = new Set(keys);

        assert.strictEqual(uniqueKeys.size, keys.length);
    });

    test("all operators provide all presentation labels", () => {
        const operators = getAllFetchXmlOperators();

        operators.forEach((operator) => {
            assert.ok(operator.labels.raw.trim().length > 0);
            assert.ok(operator.labels.polished.trim().length > 0);
            assert.ok(operator.labels.grouped.trim().length > 0);
        });
    });
});