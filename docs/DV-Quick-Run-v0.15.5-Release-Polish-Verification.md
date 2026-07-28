# DV Quick Run v0.15.5 — Release Polish Verification

## Scope

- Hub refreshed from v0.15.4 to v0.15.5.
- Unresolved navigation names return no query and explicitly forbid placeholder query construction.
- Confidence has a concise display such as `★★★★★ Very High`.
- Relationship categories expose human-readable labels such as `CRM Relationship` and `Activity Relationship`.

## Verification prompts

1. `Generate a query from Contact to Account through abc123lookup. Do not substitute another relationship and do not generate a placeholder query.`
   - Expect an `UnknownNavigationProperty` or no-verified-path result.
   - Expect `No query was generated`.
   - No `$expand=abc123lookup` query should appear.

2. `Find relationship paths from Contact to Task. Present confidence compactly and explain why alternatives rank lower.`
   - Expect `★★★★★ Very High` for the direct path.
   - Numeric confidence may remain in structured content for compatibility, but the summary should prefer the compact display.

3. Open the DV Quick Run Hub.
   - Expect `What's New in v0.15.5`.
   - Expect cards for Talk to Dataverse, Relationship Intelligence, Navigation Resolution, Relationship Query Generation, Bounded Runtime Probing, and Strict Safety Boundary.
