# DV Quick Run v0.15.5 — Release Polish Implementation Notes

## Implemented

### Hub alignment

- Replaced the stale `What's New in v0.15.4` section with `What's New in v0.15.5`.
- Reframed the release cards around Talk to Dataverse, Relationship Intelligence, Navigation Resolution, Relationship Query Generation, Bounded Runtime Probing, and the Strict Safety Boundary.
- Removed the stale `Nine Free Tools` release card.

### Evidence-first unresolved relationship behaviour

- Navigation resolution now returns `UnknownNavigationProperty` when a supplied guessed property does not match verified metadata.
- The structured result explicitly declares `queryGenerated: false` and `placeholderQueryAllowed: false`.
- The response instructs MCP clients not to construct or present a query using the unresolved name.
- Relationship query generation now states that an unmatched relationship hint produced no query and must not be replaced by an invented placeholder query.
- Tool descriptions reinforce this contract for model routing and response construction.

### Confidence and category polish

- Added `ratingStars` and `confidenceDisplay`, for example `★★★★★ Very High`.
- Retained numeric confidence and score fields for compatibility and deterministic diagnostics.
- Added human-readable category labels: `Activity Relationship`, `CRM Relationship`, `Security Relationship`, `Hierarchy Relationship`, and `Dataverse Relationship`.

### Documentation and tests

- Updated Hub unit-test expectations to v0.15.5.
- Extended relationship explainability tests for category labels and compact confidence presentation.
- Updated README and CHANGELOG.
- Added a focused release-polish verification guide.

## Local verification note

The full repository dependency tree is not included in the supplied archive, so the container could not run the complete extension compile/test gate. Run the normal local `npm install`/existing dependency setup, `npm run compile`, and unit-test suite before acceptance.
