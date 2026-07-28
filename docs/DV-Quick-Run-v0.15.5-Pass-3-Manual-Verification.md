# DV Quick Run v0.15.5 — Pass 3 Manual Verification

## 1. Explicit lookup intent preservation

Prompt:

> Generate a query from Contact to Account through parentcustomerid.

Expected:

- The MCP call supplies `relationshipHint: "parentcustomerid"`.
- Selected navigation property is `parentcustomerid_account`.
- Selected referencing attribute is `parentcustomerid`.
- `relationshipHintHonoured` is `true`.
- DVQR does not silently select `account_primary_contact`.

## 2. Explicit reverse relationship

Prompt:

> Generate a query from Contact to Account through account_primary_contact.

Expected:

- Selected navigation property is `account_primary_contact`.
- The explanation makes clear that this is the reverse Account primary-contact relationship.

## 3. Unknown relationship hint

Prompt:

> Generate a query from Contact to Account through madeup_lookup.

Expected:

- Structured `InvalidArguments` result.
- Message states no verified path matched `madeup_lookup`.
- No fallback to another valid Contact → Account path.

## 4. Query variants

For Contact → Task, inspect `generated.variants`.

Expected:

- `minimal`: direct navigation endpoint with bounded `$select` and `$top`.
- `recommended`: root record query with bounded `$select` and `$expand`.
- `staged`: ordered per-hop templates.

## 5. Relationship discovery with a hint

Prompt:

> Find paths from Contact to Account through parentcustomerid.

Expected:

- The parent-customer path is presented first.
- `relationshipHintMatched` is `true`.
- `whySelected` explicitly says the requested relationship was honoured.
- Other valid paths remain alternatives rather than being misrepresented as equivalent business meaning.
