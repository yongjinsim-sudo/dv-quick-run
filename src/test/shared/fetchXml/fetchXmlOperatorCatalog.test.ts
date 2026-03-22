import * as assert from "assert";
import {
    findFetchXmlOperator,
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

    test("resolved operators expose valueContract for new v0.6.1 logic", () => {
        const operators = getAllFetchXmlOperators();

        operators.forEach((operator) => {
            assert.ok(
                ["none", "single", "multi", "range"].includes(operator.valueContract),
                `${operator.key} has invalid valueContract`
            );
        });
    });

    test("legacy multiple valueCount maps to multi valueContract", () => {
        const operator = findFetchXmlOperator("in");

        assert.ok(operator);
        assert.strictEqual(operator!.valueCount, "multiple");
        assert.strictEqual(operator!.valueContract, "multi");
    });

    test("legacy none valueCount maps to none valueContract", () => {
        const operator = findFetchXmlOperator("null");

        assert.ok(operator);
        assert.strictEqual(operator!.valueCount, "none");
        assert.strictEqual(operator!.valueContract, "none");
    });

    test("like operator exposes enriched diagnostics metadata", () => {
        const like = findFetchXmlOperator("like");

        assert.ok(like);
        assert.strictEqual(like!.valueContract, "single");
        assert.deepStrictEqual(like!.supportedContexts, ["condition"]);
        assert.ok((like!.diagnostics.commonMistakes?.length ?? 0) > 0);
        assert.ok((like!.diagnostics.examples?.length ?? 0) > 0);
    });

    test("eq operator exposes supported condition context", () => {
        const eq = findFetchXmlOperator("eq");

        assert.ok(eq);
        assert.strictEqual(eq!.valueContract, "single");
        assert.deepStrictEqual(eq!.supportedContexts, ["condition"]);
    });

    test("null operator uses no-value contract", () => {
        const operator = findFetchXmlOperator("null");

        assert.ok(operator);
        assert.strictEqual(operator!.requiresValue, false);
        assert.strictEqual(operator!.valueCount, "none");
        assert.strictEqual(operator!.valueContract, "none");
        assert.deepStrictEqual(operator!.supportedContexts, ["condition"]);
    });

    test("not-null operator uses no-value contract", () => {
        const operator = findFetchXmlOperator("not-null");

        assert.ok(operator);
        assert.strictEqual(operator!.requiresValue, false);
        assert.strictEqual(operator!.valueCount, "none");
        assert.strictEqual(operator!.valueContract, "none");
        assert.deepStrictEqual(operator!.supportedContexts, ["condition"]);
    });

    test("in operator uses multi value contract", () => {
        const operator = findFetchXmlOperator("in");

        assert.ok(operator);
        assert.strictEqual(operator!.valueCount, "multiple");
        assert.strictEqual(operator!.valueContract, "multi");
        assert.deepStrictEqual(operator!.supportedContexts, ["condition"]);
        assert.ok((operator!.diagnostics.examples?.length ?? 0) > 0);
    });

});