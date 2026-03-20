import * as assert from "assert";
import { getOfficialFetchXmlOperators, getAllFetchXmlOperators } from "../../../shared/fetchXml/fetchXmlOperatorCatalog.js";

suite("fetchXmlOfficialOperatorContract", () => {
    test("official operators are all visible in standard FetchXML UX", () => {
        const operators = getOfficialFetchXmlOperators();

        assert.ok(operators.length > 0);
        assert.ok(operators.every((operator) => operator.visibleInFetchXmlUi));
    });

    test("official operators must not be seeded or candidate", () => {
        const operators = getOfficialFetchXmlOperators();

        assert.ok(operators.every((operator) => operator.supportTier === "official"));
    });

    test("official operators declare value requirements clearly", () => {
        const operators = getOfficialFetchXmlOperators();

        operators.forEach((operator) => {
            assert.ok(["none", "single", "multiple"].includes(operator.valueCount));
            assert.strictEqual(operator.requiresValue, operator.valueCount !== "none");
        });
    });

    test("only official operators may be visible in standard FetchXML UX", () => {
        const operators = getAllFetchXmlOperators();
        const visibleOperators = operators.filter((operator) => operator.visibleInFetchXmlUi);

        assert.ok(visibleOperators.every((operator) => operator.supportTier === "official"));
    });
});