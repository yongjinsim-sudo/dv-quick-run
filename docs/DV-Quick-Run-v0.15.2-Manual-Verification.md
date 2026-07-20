# DV Quick Run v0.15.2 — Manual Verification

## 1. Launch the implementation

1. Open the `dv-quick-run` folder in VS Code.
2. Run `npm ci`, then `npm run compile`.
3. Press `F5` and choose **Run Extension** if prompted.
4. In the Extension Development Host, select a Dataverse environment with metadata access.
5. Open a text file and place the cursor on one of the queries below.

The canonical public verification scenario uses the standard Contact `parentcustomerid` Customer lookup. Its Web API value property is `_parentcustomerid_value`, and standard Dataverse metadata normally exposes Account and Contact target-specific navigation properties. If the schema differs, use the names returned by the active environment's metadata.

## 2. Automatic polymorphic lookup understanding

Start first with a bare entity-set query:

```http
contacts
```

Run **DV Quick Run: Show Metadata-Aware Query Suggestions** and verify:

- DVQR explains that no lookup is referenced yet and opens a searchable lookup picker.
- Multi-target lookups are listed before single-target lookups.
- Choosing **Company Name (`parentcustomerid`)** offers an identifier-only preview plus Account and Contact target-specific previews.
- The same action list includes **Copy lookup reference**; choosing it copies the value property, targets, navigation properties, annotations, and limitations without opening a query preview or modifying the editor.
- The identifier-only preview is `contacts?$select=_parentcustomerid_value`.
- The Account and Contact previews add the same value property plus the exact navigation property and target primary-name field supplied by current-environment metadata.
- Cancelling either picker or the preview leaves `contacts` unchanged and does not execute a query.

Then choose the standard **Owner (`ownerid`)** lookup and verify:

- The identifier preview is `contacts?$select=_ownerid_value`.
- The generic Owner navigation preview is `contacts?$select=_ownerid_value&$expand=ownerid`.
- DVQR does not append `($select=name)` or guess another common display field for the abstract Dataverse Principal target.
- The preview explains the Owner/Principal limitation. The `_ownerid_value` formatted-value annotation remains the metadata-safe common display value.

Start with this bounded Contact query:

```http
contacts?$select=fullname,_parentcustomerid_value&$filter=statecode eq 0&$orderby=createdon desc&$top=10
```

Run **DV Quick Run: Explain Query**.

Verify:

- **Lookup & Relationship Understanding** lists every supported target and the navigation property returned by current-environment metadata.
- In a standard environment, the expected target/navigation pairs are Account (`parentcustomerid_account`) and Contact (`parentcustomerid_contact`). Treat current-environment metadata as canonical.
- Metadata confidence, environment, evidence references, runtime annotations, and the supported-target-versus-current-row limitation are visible.
- One suggested query is present for each metadata-valid target.
- `$filter`, `$orderby`, `$top`, the entity set, and unrelated clauses remain unchanged in each suggestion.

Then add the intentionally invalid direct expansion:

```http
contacts?$select=fullname,_parentcustomerid_value&$filter=statecode eq 0&$orderby=createdon desc&$top=10&$expand=parentcustomerid
```

Run **Explain Query** again and verify Query Doctor reports that the lookup requires a target-specific navigation property. DVQR must suggest metadata-valid alternatives before the invalid query is executed.

## 3. Preview-first rewrite safety

Return to the successful base query without `$expand`, then run **DV Quick Run: Show Metadata-Aware Query Suggestions**.

Verify:

- A target picker appears when more than one valid target exists.
- The preview shows the original and suggested query before any editor change.
- **Copy Suggested Query** and **Cancel** remain visible at the bottom of the preview while the report sections scroll independently; Pro also keeps **Apply Suggested Query** visible.
- Choosing **Cancel** leaves the source text byte-for-byte unchanged and does not execute the query.
- Free mode offers **Copy Suggested Query** only.
- Pro mode offers **Apply Suggested Query** and **Copy Suggested Query**.
- Applying in Pro changes only the detected selection/logical query after confirmation.

Repeat the safety check with the earlier **DV Quick Run: Explore Available Lookups** command using a bare `contacts` query.

Verify:

- The action labels say **Preview value property**, **Preview target-specific expand**, or **Preview value + expand**.
- Choosing any query-producing action opens the shared preview and does not immediately change `contacts`.
- Cancelling leaves the editor unchanged.
- Free offers **Copy Suggested Query** only; Pro offers **Apply Suggested Query** and **Copy Suggested Query**.
- **Copy lookup reference** remains clipboard-only and does not open a query preview.

## 4. Valid target with possible null result

Use a navigation property actually shown by metadata, for example:

```http
contacts?$select=fullname,_parentcustomerid_value&$filter=statecode eq 0&$orderby=createdon desc&$top=10&$expand=parentcustomerid_account($select=name)
```

Run **Explain Query** and verify that DVQR describes the expansion as metadata-valid but warns that rows referencing Contact may return null expansion data. It must not claim that Account is the target used by every row.

## 5. Unsupported target

Use a target-like property that is not present in the resolved lookup metadata, for example:

```http
contacts?$select=fullname&$expand=parentcustomerid_systemuser($select=fullname)
```

Run **Explain Query** and verify that Query Doctor reports an unsupported or unknown navigation property, lists the actual supported targets when it can associate the name with the lookup, and never invents a replacement navigation name.

## 6. Lookup scalar-property corrections

Use intentionally incorrect lookup selection and filtering:

```http
contacts?$select=fullname,parentcustomerid&$filter=parentcustomerid eq 00000000-0000-0000-0000-000000000001&$top=5
```

Verify that Query Doctor recommends `_parentcustomerid_value` for `$select` and the GUID filter, while preserving `$top` and all unrelated query text.

## 7. Full URL preservation

Repeat a correction with a full Web API URL:

```http
https://YOUR-ORG.crm.dynamics.com/api/data/v9.2/contacts?$select=fullname,parentcustomerid&$filter=statecode%20eq%200&$top=5
```

Verify that DVQR resolves `contacts`, understands the encoded filter, and preserves the scheme, host, API version, entity set, filter, and top value in the preview.

## 8. Single-target lookup

Use a known single-target lookup, such as Account `primarycontactid`:

```http
accounts?$select=name,_primarycontactid_value&$expand=primarycontactid($select=fullname)&$top=5
```

Verify that the lookup is described as standard/single-target, its one navigation property is accepted, and no polymorphic-target error is emitted.

## 9. Refresh and environment isolation

1. Run **DV Quick Run: Refresh Metadata Context** and verify the confirmation includes resolution state plus lookup/navigation counts.
2. Switch to a second configured environment and explain the same query.
3. Verify the report names the second environment and reflects its metadata rather than reusing target/navigation results from the first environment.
4. Switch back and confirm the first environment's metadata remains independent.

## 10. Final regression gates

From the repository root, run:

```bash
npm run compile
npm run lint
npm test
```

The VS Code integration test command needs a graphical display (or Xvfb) on Linux. The pure v0.15.2 regression subset can also be run without a display:

```bash
node node_modules/@vscode/test-cli/node_modules/mocha/bin/mocha.js --ui tdd \
  out/test/explain/explainQueryParser.test.js \
  out/test/explain/metadataQueryIntelligence.test.js \
  out/test/metadata/metadataSessionCache.test.js
```
