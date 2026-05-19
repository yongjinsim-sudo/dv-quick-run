export function getCapabilityExplorerScript(modelJson: string): string {
  return `(() => {
  const vscode = acquireVsCodeApi();
  const model = ${modelJson};
  const rows = Array.isArray(model.customApis) ? model.customApis : [];
  const definitions = Array.isArray(model.definitions) ? model.definitions : [];
  const definitionsByUniqueName = new Map(definitions.map((definition) => [definition.uniqueName, definition]));
  const tbody = document.querySelector('[data-role="custom-api-rows"]');
  const emptyState = document.querySelector('[data-role="empty-state"]');
  const filterSummary = document.querySelector('[data-role="filter-summary"]');
  const textFilter = document.querySelector('[data-filter="text"]');
  const bindingFilter = document.querySelector('[data-filter="binding"]');
  const typeFilter = document.querySelector('[data-filter="type"]');
  const privateFilter = document.querySelector('[data-filter="private"]');
  const pageSizeControl = document.querySelector('[data-role="page-size"]');
  const pagination = document.querySelector('[data-role="pagination"]');
  const table = document.querySelector('[data-role="custom-api-table"]');
  const explorerLayout = document.querySelector('.dvqr-explorer-layout');
  const detailDrawer = document.querySelector('[data-role="detail-drawer"]');
  const detailContent = document.querySelector('[data-role="detail-content"]');
  const columnWidthsKey = 'dvqr.capabilityExplorer.columnWidths.v1';
  let currentPage = 1;
  let selectedUniqueName = '';
  let pageSize = pageSizeControl instanceof HTMLSelectElement ? Number(pageSizeControl.value) : 20;
  let latestExecutionInsightUniqueName = '';
  const boundTargetRowIds = new Map();

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }


  function cssEscape(value) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(String(value || ''));
    }

    return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function display(value) {
    const text = String(value ?? '').trim();
    return text || '—';
  }

  function displayBoolean(value) {
    if (value === true) {
      return 'Yes';
    }

    if (value === false) {
      return 'No';
    }

    return '—';
  }

  function pillClass(prefix, value) {
    return 'dvqr-pill dvqr-pill-' + prefix + '-' + String(value || '').toLowerCase();
  }

  function typeLabel(item) {
    return display(item && item.typeLabel ? item.typeLabel : item && item.type);
  }

  function typeTitle(item) {
    const rawType = item && item.type ? 'Raw Dataverse type: ' + item.type : '';
    const description = item && item.typeDescription ? item.typeDescription : '';
    return [typeLabel(item), rawType, description].filter(Boolean).join(' • ');
  }

  function supportLabel(parameter) {
    return parameter && parameter.executionSupportLabel ? parameter.executionSupportLabel : 'Inspect only';
  }

  function supportClass(parameter) {
    return parameter && parameter.executionSupport === 'preview-ready' ? 'dvqr-supported' : 'dvqr-muted-cell';
  }

  function readFilters() {
    return {
      text: textFilter instanceof HTMLInputElement ? textFilter.value.trim().toLowerCase() : '',
      binding: bindingFilter instanceof HTMLSelectElement ? bindingFilter.value : 'all',
      type: typeFilter instanceof HTMLSelectElement ? typeFilter.value : 'all',
      visibility: privateFilter instanceof HTMLSelectElement ? privateFilter.value : 'all'
    };
  }

  function matches(row) {
    const filters = readFilters();
    const searchable = [row.displayName, row.uniqueName, row.description, row.boundTargetLabel, row.boundEntityLogicalName, row.executePrivilegeName]
      .join(' ')
      .toLowerCase();

    return (!filters.text || searchable.includes(filters.text))
      && (filters.binding === 'all' || row.bindingKind === filters.binding)
      && (filters.type === 'all' || row.operationKind === filters.type)
      && (filters.visibility === 'all' || row.isPrivate === filters.visibility);
  }

  function getFilteredRows() {
    return rows.filter(matches);
  }

  function clampPage(totalPages) {
    if (currentPage > totalPages) {
      currentPage = totalPages;
    }

    if (currentPage < 1) {
      currentPage = 1;
    }
  }

  function renderPageButton(label, page, options) {
    const isActive = options && options.active;
    const isDisabled = options && options.disabled;
    return '<button class="dvqr-page-button' + (isActive ? ' dvqr-page-button-active' : '') + '" type="button" data-page="' + escapeHtml(page) + '"' + (isDisabled ? ' disabled' : '') + '>' + escapeHtml(label) + '</button>';
  }

  function buildPaginationItems(totalPages) {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_unused, index) => index + 1);
    }

    const items = [1];
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    if (start > 2) {
      items.push('ellipsis-start');
    }

    for (let page = start; page <= end; page += 1) {
      items.push(page);
    }

    if (end < totalPages - 1) {
      items.push('ellipsis-end');
    }

    items.push(totalPages);
    return items;
  }

  function renderPagination(totalRows) {
    if (!pagination) {
      return;
    }

    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    clampPage(totalPages);

    const items = buildPaginationItems(totalPages).map((item) => {
      if (typeof item === 'string') {
        return '<span class="dvqr-page-ellipsis">…</span>';
      }

      return renderPageButton(String(item), item, { active: item === currentPage });
    });

    pagination.innerHTML = renderPageButton('‹', currentPage - 1, { disabled: currentPage === 1 })
      + items.join('')
      + renderPageButton('›', currentPage + 1, { disabled: currentPage === totalPages });
  }

  function renderParameterRows(parameters) {
    if (parameters.length === 0) {
      return '<div class="dvqr-drawer-empty">No request parameters discovered.</div>';
    }

    const rowsHtml = parameters.map((parameter) => {
      const required = parameter.isOptional === true ? 'No' : 'Yes';
      const supported = supportLabel(parameter);
      const supportedClass = supportClass(parameter);
      return '<tr>'
        + '<td title="' + escapeHtml(parameter.uniqueName) + '">' + escapeHtml(display(parameter.displayName || parameter.uniqueName)) + '</td>'
        + '<td title="' + escapeHtml(typeTitle(parameter)) + '">' + escapeHtml(typeLabel(parameter)) + '</td>'
        + '<td class="' + (required === 'Yes' ? 'dvqr-private' : '') + '">' + required + '</td>'
        + '<td class="' + supportedClass + '" title="' + escapeHtml(parameter.executionSupportReason || '') + '">' + escapeHtml(supported) + '</td>'
        + '</tr>';
    }).join('');

    return '<table class="dvqr-drawer-table" data-role="parameter-table">'
      + '<colgroup>'
      + '<col data-column="name" style="width: 36%;" />'
      + '<col data-column="type" style="width: 26%;" />'
      + '<col data-column="required" style="width: 18%;" />'
      + '<col data-column="supported" style="width: 20%;" />'
      + '</colgroup>'
      + '<thead><tr>'
      + '<th>Name<span class="dvqr-column-resizer" data-resize-column="name"></span></th>'
      + '<th>Type<span class="dvqr-column-resizer" data-resize-column="type"></span></th>'
      + '<th>Required<span class="dvqr-column-resizer" data-resize-column="required"></span></th>'
      + '<th>Supported<span class="dvqr-column-resizer" data-resize-column="supported"></span></th>'
      + '</tr></thead><tbody>' + rowsHtml + '</tbody></table>';
  }

  function renderResponseRows(properties) {
    if (properties.length === 0) {
      return '<div class="dvqr-drawer-empty">No response properties discovered.</div>';
    }

    const rowsHtml = properties.map((property) => '<tr>'
      + '<td title="' + escapeHtml(property.uniqueName) + '">' + escapeHtml(display(property.displayName || property.uniqueName)) + '</td>'
      + '<td title="' + escapeHtml(typeTitle(property)) + '">' + escapeHtml(typeLabel(property)) + '</td>'
      + '<td title="' + escapeHtml(property.logicalName || '') + '">' + escapeHtml(display(property.logicalName)) + '</td>'
      + '</tr>').join('');

    return '<table class="dvqr-drawer-table" data-role="response-table">'
      + '<colgroup>'
      + '<col data-column="name" style="width: 42%;" />'
      + '<col data-column="type" style="width: 24%;" />'
      + '<col data-column="logicalName" style="width: 34%;" />'
      + '</colgroup>'
      + '<thead><tr>'
      + '<th>Name<span class="dvqr-column-resizer" data-resize-column="name"></span></th>'
      + '<th>Type<span class="dvqr-column-resizer" data-resize-column="type"></span></th>'
      + '<th>Logical Name<span class="dvqr-column-resizer" data-resize-column="logicalName"></span></th>'
      + '</tr></thead><tbody>' + rowsHtml + '</tbody></table>';
  }


  function shouldShowAiExecutionAdvisory(definition) {
    const policy = definition && (definition.executionPolicy || (definition.executionCapability && definition.executionCapability.executionPolicy));
    return policy && policy.classification === 'ai-related' && policy.allowed === true;
  }

  function renderAiExecutionAdvisory(definition) {
    if (!shouldShowAiExecutionAdvisory(definition)) {
      return '';
    }

    return '<div class="dvqr-readiness-card dvqr-readiness-advisory">'
      + '<strong>AI-generated content warning</strong>'
      + '<span>Generated output may be inaccurate, incomplete, or non-deterministic.</span>'
      + '<span>Human validation is recommended before operational use.</span>'
      + '</div>';
  }

  function compactActionReasonCode(reasonCode) {
    const labels = {
      PublicODataAction: 'Metadata-valid',
      SimplePreviewReadyParameters: 'Preview-ready',
      ComplexParameterShape: 'Complex parameter',
      EntityReferenceParameter: 'Entity reference',
      PrimitiveArrayParameter: 'Primitive array',
      EntityReferenceArrayParameter: 'EntityReference array',
      CollectionParameter: 'Collection parameter',
      UnknownParameterType: 'Unknown parameter',
      BoundActionDeferred: 'Bound Action deferred',
      PrivateCustomApi: 'Private/internal',
      MissingActionImport: 'Missing ActionImport',
      ValidationUnavailable: 'Validation unavailable',
      EnvironmentChanged: 'Environment changed',
      AiPolicyDenied: 'AI policy denied',
      GeneratedContentAdvisoryRequired: 'AI advisory',
      PotentialDestructiveOperation: 'Destructive signal',
      PotentialBusinessStateChange: 'Business-state signal',
      PotentialExternalSideEffect: 'External side-effect signal',
      NotAnAction: 'Function semantics'
    };

    return labels[reasonCode] || reasonCode;
  }

  function compactActionReasonCodes(reasonCodes) {
    const codes = Array.isArray(reasonCodes) ? reasonCodes : [];
    if (codes.length === 0) {
      return '—';
    }

    return codes.map(compactActionReasonCode).join(' • ');
  }


  function isEntityBoundAction(definition) {
    return definition
      && definition.operationKind === 'Action'
      && definition.bindingKind === 'Bound'
      && (definition.boundTargetKind === 'entity' || definition.executionEligibility && definition.executionEligibility.odataBoundTargetKind === 'entity');
  }

  function normalizeGuid(value) {
    const trimmed = String(value || '').trim();
    const match = trimmed.match(/^\{?([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\}?$/);
    return match ? match[1].toLowerCase() : '';
  }

  function isValidGuid(value) {
    return normalizeGuid(value).length > 0;
  }

  function getBoundTargetRowId(definition) {
    return boundTargetRowIds.get(definition.uniqueName) || '';
  }

  function getBoundEntitySetName(definition) {
    return definition.boundEntitySetName || definition.executionEligibility && definition.executionEligibility.odataBoundEntitySetName || '';
  }

  function isBoundEntitySetResolved(definition) {
    const entitySet = getBoundEntitySetName(definition).trim();
    return entitySet.length > 0 && entitySet !== '<entity-set-unresolved>';
  }

  function renderBoundTargetInput(definition) {
    if (!isEntityBoundAction(definition)) {
      return '';
    }

    const entity = definition.boundEntityLogicalName || definition.executionEligibility && definition.executionEligibility.odataBoundEntityLogicalName || '—';
    const entitySet = getBoundEntitySetName(definition) || '—';

    return '<section class="dvqr-drawer-section dvqr-bound-target-section"><h3>Bound Target</h3>'
      + '<div class="dvqr-bound-target-summary">'
      + '<span>Required entity</span><strong>' + escapeHtml(entity) + '</strong>'
      + '<span>Entity set</span><strong>' + escapeHtml(entitySet) + '</strong>'
      + '<span>Input source</span><strong>manualInput</strong>'
      + '</div>'
      + '<div class="dvqr-target-validation">Target entity is fixed from metadata. Enter the target row GUID in the execution preview section below.</div>'
      + '</section>';
  }

  function getBoundTargetValidationHtml(definition, currentValue) {
    if (!isBoundEntitySetResolved(definition)) {
      return '<div class="dvqr-target-validation dvqr-target-validation-error">The bound entity set could not be resolved from metadata. DV Quick Run cannot create an executable bound route for this operation.</div>';
    }

    if (currentValue && !isValidGuid(currentValue)) {
      return '<div class="dvqr-target-validation dvqr-target-validation-error">Enter a valid target row GUID before generating preview.</div>';
    }

    return '<div class="dvqr-target-validation">Required for entity-bound Actions. DV Quick Run does not infer this from the Result Viewer.</div>';
  }

  function renderBoundTargetFooterInput(definition) {
    if (!isEntityBoundAction(definition)) {
      return '';
    }

    const currentValue = getBoundTargetRowId(definition);
    const hint = getBoundTargetValidationHtml(definition, currentValue);

    return '<div class="dvqr-footer-target-input">'
      + '<label class="dvqr-target-input-label" for="dvqr-bound-target-row-id-footer-' + escapeHtml(definition.uniqueName) + '">Target row GUID</label>'
      + '<input class="dvqr-target-input" id="dvqr-bound-target-row-id-footer-' + escapeHtml(definition.uniqueName) + '" data-role="bound-target-row-id" data-api-unique-name="' + escapeHtml(definition.uniqueName) + '" type="text" value="' + escapeHtml(currentValue) + '" placeholder="00000000-0000-0000-0000-000000000000" />'
      + hint
      + '</div>';
  }

  function renderExecutionReadiness(definition) {
    const readiness = definition.executionReadinessLabel || 'Inspect only';
    const readinessClass = definition.executionReadiness === 'preview-ready' ? 'dvqr-readiness-good' : definition.executionReadiness === 'partial' ? 'dvqr-readiness-partial' : 'dvqr-readiness-muted';
    const readyCount = Number(definition.previewReadyParameterCount || 0);
    const inspectOnlyCount = Number(definition.inspectOnlyParameterCount || 0);
    const reason = definition.executionReadinessReason || 'Execution preview has not been implemented yet; this classification only describes parameter readiness.';
    const eligibility = definition.executionEligibility || { label: 'Validation unavailable', reason: 'OData execution validation has not been loaded for this environment.', state: 'unknown-validation-unavailable' };
    const capability = definition.executionCapability || { mode: 'validation-unavailable', label: 'Preview request only', reason: eligibility.reason, canPreview: true, canExecute: false };
    const eligibilityClass = capability.canExecute ? 'dvqr-readiness-good' : capability.mode === 'validation-unavailable' || eligibility.state === 'preview-only-not-found' ? 'dvqr-readiness-muted' : 'dvqr-readiness-partial';
    const odataLine = eligibility.odataQualifiedName ? '<div class="dvqr-readiness-counts"><span>OData definition: ' + escapeHtml(eligibility.odataQualifiedName) + '</span></div>' : '';
    const routeLine = eligibility.odataInvocationName ? '<div class="dvqr-readiness-counts"><span>Invocation route: /' + escapeHtml(eligibility.odataInvocationName) + (definition.operationKind === 'Function' ? '()' : '') + '</span></div>' : '';
    const actionReadiness = definition.actionReadiness || (definition.executionCapability && definition.executionCapability.actionReadiness);
    const actionReadinessClass = actionReadiness && actionReadiness.canExecute
      ? (actionReadiness.caution ? 'dvqr-readiness-partial' : 'dvqr-readiness-good')
      : 'dvqr-readiness-muted';
    const actionReasonSummary = actionReadiness ? compactActionReasonCodes(actionReadiness.reasonCodes) : '—';
    const actionReadinessHtml = actionReadiness ? '<div class="dvqr-readiness-card dvqr-action-readiness-card ' + actionReadinessClass + '">'
      + '<strong>Action readiness: ' + escapeHtml(actionReadiness.label) + '</strong>'
      + '<span>' + escapeHtml(actionReadiness.reason) + '</span>'
      + '<span>' + escapeHtml(actionReasonSummary) + '</span>'
      + (actionReadiness.requiresTypedConfirmation ? '<span>Typed confirmation required: ' + escapeHtml(actionReadiness.confirmationPhrase || definition.uniqueName.toUpperCase()) + '</span>' : '')
      + '</div>' : '';
    const capabilityCardHtml = actionReadiness
      ? ''
      : '<div class="dvqr-readiness-card ' + eligibilityClass + '">'
        + '<strong>' + escapeHtml(capability.label) + '</strong>'
        + '<span>' + escapeHtml(capability.reason) + '</span>'
        + '</div>';
    const advisoryStack = '<div class="dvqr-capability-advisory-stack">'
      + capabilityCardHtml
      + renderAiExecutionAdvisory(definition)
      + actionReadinessHtml
      + '</div>';

    return '<section class="dvqr-drawer-section dvqr-readiness-section"><h3>Execution Support</h3>'
      + '<div class="dvqr-readiness-card ' + readinessClass + '">'
      + '<strong>' + escapeHtml(readiness) + '</strong>'
      + '<span>' + escapeHtml(reason) + '</span>'
      + '</div>'
      + '<div class="dvqr-readiness-counts">'
      + '<span>' + readyCount + ' preview-ready parameter' + (readyCount === 1 ? '' : 's') + '</span>'
      + '<span>' + inspectOnlyCount + ' inspect-only parameter' + (inspectOnlyCount === 1 ? '' : 's') + '</span>'
      + '</div>'
      + advisoryStack
      + odataLine
      + routeLine
      + '</section>';
  }

  function renderOverview(definition) {
    const rowsHtml = [
      ['Unique Name', definition.uniqueName],
      ['Type', definition.operationKind + (definition.operationKind === 'Action' ? ' (POST)' : ' (GET)')],
      ['Binding', definition.bindingKind],
      ['Bound Target', definition.boundTargetLabel || '—'],
      ['Bound Entity', definition.boundEntityLogicalName || '—'],
      ['Is Private', displayBoolean(definition.isPrivate)],
      ['Privilege Name', definition.executePrivilegeName || '—'],
      ['Processing Step Type', definition.allowedCustomProcessingStepType ?? '—'],
      ['Capability', definition.operationKind === 'Action' && (definition.actionReadiness || definition.executionCapability && definition.executionCapability.actionReadiness) ? (definition.actionReadiness ? definition.actionReadiness.label : definition.executionCapability.actionReadiness.label) : definition.executionCapability ? definition.executionCapability.label : 'Preview request only'],
      ['Preview Support', definition.executionReadinessLabel || 'Inspect only'],
      ['OData Eligibility', definition.executionEligibility ? definition.executionEligibility.label : 'Validation unavailable'],
      ['Parameter Support', String(definition.previewReadyParameterCount ?? 0) + ' preview-ready / ' + String(definition.inspectOnlyParameterCount ?? 0) + ' inspect-only'],
      ['Description', definition.description || '—']
    ].map(([label, value]) => '<div class="dvqr-overview-row"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>').join('');

    return '<section class="dvqr-drawer-section"><h3>Overview</h3><div class="dvqr-overview-list">' + rowsHtml + '</div></section>';
  }

  function renderOperationNotes(definition) {
    const notes = [];
    notes.push(definition.operationKind === 'Action'
      ? 'This is a POST operation and may trigger server-side processing.'
      : 'This is a GET-style function where exposed by Dataverse.');

    if (definition.bindingKind === 'Bound') {
      notes.push(definition.boundTargetReason || 'This operation is bound to ' + display(definition.boundEntityLogicalName) + ' records.');
    } else {
      notes.push('This operation is unbound and is not tied to a selected row.');
    }

    if (definition.isPrivate === true) {
      notes.push('Private API — inspect metadata before attempting execution.');
    }

    if (definition.operationKind === 'Action' && definition.executionCapability && definition.executionCapability.executionMethod === 'POST') {
      notes.push('Execution uses a metadata-backed Action route and remains bound to the active environment preview context.');
    }

    const noteHtml = notes.map((note) => '<li>' + escapeHtml(note) + '</li>').join('');
    return '<section class="dvqr-drawer-section"><h3>Operation Notes</h3><ul class="dvqr-notes-list">' + noteHtml + '</ul></section>';
  }


  function getPreviewButtonLabel(definition) {
    if (definition.executionCapability && definition.executionCapability.canExecute) {
      return definition.operationKind === 'Action' ? 'Preview / Run Action' : 'Preview / Run Function';
    }

    if (definition.operationKind === 'Action' && definition.bindingKind === 'Unbound' && definition.executionCapability && definition.executionCapability.executionMethod === 'POST') {
      return 'Preview Action Request';
    }

    if (definition.operationKind === 'Action' && definition.bindingKind === 'Bound') {
      return 'Preview Bound Request';
    }

    return 'Preview Request';
  }

  function getPreviewButtonDescription(definition) {
    if (definition.executionCapability && definition.executionCapability.canExecute) {
      return definition.operationKind === 'Action' ? 'Preview this POST Action request, then run only after explicit confirmation.' : 'Preview this read-oriented Function request, then run only after explicit confirmation.';
    }

    if (definition.operationKind === 'Action' && definition.bindingKind === 'Unbound' && definition.executionCapability && definition.executionCapability.executionMethod === 'POST') {
      return 'Preview the POST Action request shape. No Dataverse operation is executed yet.';
    }

    if (definition.operationKind === 'Action' && definition.bindingKind === 'Bound') {
      return 'Enter an explicit target row GUID, then preview the bound request shape. Execution remains disabled.';
    }

    return 'Generate a preview-only request template. No Dataverse operation will be executed.';
  }

  function renderDetail(uniqueName) {
    const definition = definitionsByUniqueName.get(uniqueName);
    if (!(detailDrawer instanceof HTMLElement) || !(detailContent instanceof HTMLElement) || !definition) {
      return;
    }

    const privateBadge = definition.isPrivate === true ? '<span class="dvqr-detail-badge dvqr-detail-badge-private">Private</span>' : '<span class="dvqr-detail-badge">Public</span>';
    const description = definition.description ? escapeHtml(definition.description) : 'No description discovered.';
    const executionInsightButton = latestExecutionInsightUniqueName === definition.uniqueName
      ? '<div class="dvqr-next-step-row dvqr-execution-insight-row"><button class="dvqr-button dvqr-button-primary" type="button" data-action="open-execution-insights" data-api-unique-name="' + escapeHtml(definition.uniqueName) + '">Execution Insights →</button><span>Continue bounded runtime evidence review from the captured capability execution context.</span></div>'
      : '';

    detailContent.innerHTML = '<div class="dvqr-detail-header">'
      + '<h2 title="' + escapeHtml(definition.displayName || definition.uniqueName) + '">' + escapeHtml(definition.displayName || definition.uniqueName) + '</h2>'
      + '<div class="dvqr-detail-badges">'
      + '<span class="dvqr-detail-badge dvqr-detail-badge-type">' + escapeHtml(definition.operationKind) + '</span>'
      + '<span class="dvqr-detail-badge dvqr-detail-badge-binding">' + escapeHtml(definition.bindingKind) + '</span>'
      + privateBadge
      + '</div>'
      + '<p>' + description + '</p>'
      + '</div>'
      + '<div class="dvqr-detail-body">'
      + renderOverview(definition)
      + renderExecutionReadiness(definition)
      + renderBoundTargetInput(definition)
      + '<section class="dvqr-drawer-section"><h3>Parameters (' + definition.requestParameters.length + ')</h3>' + renderParameterRows(definition.requestParameters || []) + '</section>'
      + '<section class="dvqr-drawer-section"><h3>Response Properties (' + definition.responseProperties.length + ')</h3>' + renderResponseRows(definition.responseProperties || []) + '</section>'
      + renderOperationNotes(definition)
      + '</div>'
      + '<div class="dvqr-detail-footer"><section class="dvqr-drawer-section dvqr-next-steps"><h3>Execution Preview</h3>'
      + renderBoundTargetFooterInput(definition)
      + '<div class="dvqr-next-step-row">'
      + '<button class="dvqr-button dvqr-button-primary" type="button" data-action="preview-execution" data-api-unique-name="' + escapeHtml(definition.uniqueName) + '">' + getPreviewButtonLabel(definition) + '</button>'
      + '<span>' + getPreviewButtonDescription(definition) + '</span></div>'
      + executionInsightButton
      + '</section></div>';

    detailDrawer.hidden = false;
    if (explorerLayout instanceof HTMLElement) {
      explorerLayout.classList.add('dvqr-explorer-layout-with-drawer');
    }

    detailContent.querySelectorAll('table[data-role="parameter-table"], table[data-role="response-table"]').forEach((drawerTable) => {
      setupResizableTable(drawerTable, 'dvqr.capabilityExplorer.drawerColumnWidths.' + definition.uniqueName + '.v1');
    });
  }

  function closeDetail() {
    selectedUniqueName = '';
    if (detailDrawer instanceof HTMLElement) {
      detailDrawer.hidden = true;
    }

    if (explorerLayout instanceof HTMLElement) {
      explorerLayout.classList.remove('dvqr-explorer-layout-with-drawer');
    }

    document.querySelectorAll('tr[data-api-unique-name]').forEach((row) => row.classList.remove('dvqr-selected-row'));
  }

  function renderRows() {
    if (!tbody) {
      return;
    }

    const visibleRows = getFilteredRows();
    const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
    clampPage(totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const pageRows = visibleRows.slice(startIndex, startIndex + pageSize);

    tbody.innerHTML = pageRows.map((row) => {
      const privateClass = row.isPrivate === 'Yes' ? ' class="dvqr-private"' : '';
      const selectedClass = row.uniqueName === selectedUniqueName ? ' class="dvqr-selected-row"' : '';
      return '<tr data-api-unique-name="' + escapeHtml(row.uniqueName) + '"' + selectedClass + '>'
        + '<td class="dvqr-name" title="' + escapeHtml(row.displayName) + '">' + escapeHtml(row.displayName) + '</td>'
        + '<td title="' + escapeHtml(row.uniqueName) + '">' + escapeHtml(row.uniqueName) + '</td>'
        + '<td><span class="' + pillClass('type', row.operationKind) + '" title="' + escapeHtml(row.operationKind) + '">' + escapeHtml(row.operationKind) + '</span></td>'
        + '<td><span class="' + pillClass('', row.bindingKind).replace('dvqr-pill--', 'dvqr-pill-') + '" title="' + escapeHtml(row.bindingKind) + '">' + escapeHtml(row.bindingKind) + '</span></td>'
        + '<td title="' + escapeHtml(row.boundTargetLabel) + '">' + escapeHtml(row.boundTargetLabel) + '</td>'
        + '<td title="' + escapeHtml(row.boundEntityLogicalName) + '">' + escapeHtml(row.boundEntityLogicalName) + '</td>'
        + '<td title="' + escapeHtml(row.requestParameterCount) + '">' + escapeHtml(row.requestParameterCount) + '</td>'
        + '<td title="' + escapeHtml(row.responsePropertyCount) + '">' + escapeHtml(row.responsePropertyCount) + '</td>'
        + '<td title="' + escapeHtml(row.requiredParameterCount) + '">' + escapeHtml(row.requiredParameterCount) + '</td>'
        + '<td' + privateClass + ' title="' + escapeHtml(row.isPrivate) + '">' + escapeHtml(row.isPrivate) + '</td>'
        + '<td class="dvqr-description" title="' + escapeHtml(row.description) + '">' + escapeHtml(row.description) + '</td>'
        + '</tr>';
    }).join('');

    if (emptyState instanceof HTMLElement) {
      emptyState.hidden = visibleRows.length > 0;
    }

    if (filterSummary instanceof HTMLElement) {
      const first = visibleRows.length === 0 ? 0 : startIndex + 1;
      const last = Math.min(startIndex + pageRows.length, visibleRows.length);
      filterSummary.textContent = 'Showing ' + first + '-' + last + ' of ' + visibleRows.length + ' filtered APIs (' + rows.length + ' total)';
    }

    renderPagination(visibleRows.length);
  }

  function resetPageAndRender() {
    currentPage = 1;
    renderRows();
  }

  [textFilter, bindingFilter, typeFilter, privateFilter].forEach((control) => {
    if (control) {
      control.addEventListener('input', resetPageAndRender);
      control.addEventListener('change', resetPageAndRender);
    }
  });

  if (pageSizeControl instanceof HTMLSelectElement) {
    pageSizeControl.addEventListener('change', () => {
      pageSize = Number(pageSizeControl.value) || 20;
      currentPage = 1;
      renderRows();
    });
  }

  if (tbody) {
    tbody.addEventListener('click', (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest('tr[data-api-unique-name]') : undefined;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const nextUniqueName = target.getAttribute('data-api-unique-name') || '';
      if (selectedUniqueName && nextUniqueName && selectedUniqueName !== nextUniqueName) {
        vscode.postMessage({ type: 'capabilitySelectionChanged', apiUniqueName: nextUniqueName });
      }

      selectedUniqueName = nextUniqueName;
      document.querySelectorAll('tr[data-api-unique-name]').forEach((row) => row.classList.remove('dvqr-selected-row'));
      target.classList.add('dvqr-selected-row');
      renderDetail(selectedUniqueName);
    });
  }

  if (pagination) {
    pagination.addEventListener('click', (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest('[data-page]') : undefined;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const requestedPage = Number(target.getAttribute('data-page'));
      if (!Number.isFinite(requestedPage)) {
        return;
      }

      currentPage = requestedPage;
      renderRows();
    });
  }

  function readColumnWidthState(stateKey) {
    try {
      const state = vscode.getState && vscode.getState();
      const widths = state && state[stateKey] ? state[stateKey] : undefined;
      return widths && typeof widths === 'object' ? widths : undefined;
    } catch (_error) {
      return undefined;
    }
  }

  function applySavedColumnWidths(targetTable, stateKey) {
    if (!(targetTable instanceof HTMLTableElement)) {
      return;
    }

    const widths = readColumnWidthState(stateKey);
    if (!widths) {
      return;
    }

    Object.entries(widths).forEach(([column, width]) => {
      const col = targetTable.querySelector('col[data-column="' + CSS.escape(column) + '"]');
      if (col instanceof HTMLTableColElement && typeof width === 'number') {
        col.style.width = width + '%';
      }
    });
  }

  function saveColumnWidths(targetTable, stateKey) {
    if (!(targetTable instanceof HTMLTableElement)) {
      return;
    }

    const widths = {};
    targetTable.querySelectorAll('col[data-column]').forEach((col) => {
      if (col instanceof HTMLTableColElement) {
        const column = col.getAttribute('data-column');
        const width = parseFloat(col.style.width || '0');
        if (column && Number.isFinite(width) && width > 0) {
          widths[column] = width;
        }
      }
    });

    const currentState = vscode.getState && vscode.getState();
    vscode.setState({ ...(currentState || {}), [stateKey]: widths });
  }

  function setupResizableTable(targetTable, stateKey) {
    if (!(targetTable instanceof HTMLTableElement)) {
      return;
    }

    applySavedColumnWidths(targetTable, stateKey);

    targetTable.querySelectorAll('[data-resize-column]').forEach((handle) => {
      handle.addEventListener('pointerdown', (event) => {
        if (!(event instanceof PointerEvent) || !(handle instanceof HTMLElement)) {
          return;
        }

        event.preventDefault();
        const column = handle.getAttribute('data-resize-column');
        const currentCol = column ? targetTable.querySelector('col[data-column="' + CSS.escape(column) + '"]') : undefined;
        const nextCol = currentCol instanceof HTMLTableColElement ? currentCol.nextElementSibling : undefined;
        const tableWidth = targetTable.getBoundingClientRect().width;

        if (!(currentCol instanceof HTMLTableColElement) || !(nextCol instanceof HTMLTableColElement) || tableWidth <= 0) {
          return;
        }

        const startX = event.clientX;
        const currentWidth = currentCol.getBoundingClientRect().width;
        const nextWidth = nextCol.getBoundingClientRect().width;
        const minWidth = targetTable.classList.contains('dvqr-drawer-table') ? 44 : 56;
        handle.setPointerCapture(event.pointerId);
        handle.classList.add('dvqr-column-resizer-active');

        const onPointerMove = (moveEvent) => {
          const delta = moveEvent.clientX - startX;
          const proposedCurrent = Math.max(minWidth, currentWidth + delta);
          const proposedNext = Math.max(minWidth, nextWidth - delta);

          if (proposedCurrent + proposedNext > currentWidth + nextWidth) {
            return;
          }

          currentCol.style.width = ((proposedCurrent / tableWidth) * 100).toFixed(3) + '%';
          nextCol.style.width = ((proposedNext / tableWidth) * 100).toFixed(3) + '%';
        };

        const onPointerUp = (upEvent) => {
          handle.releasePointerCapture(upEvent.pointerId);
          handle.classList.remove('dvqr-column-resizer-active');
          handle.removeEventListener('pointermove', onPointerMove);
          handle.removeEventListener('pointerup', onPointerUp);
          handle.removeEventListener('pointercancel', onPointerUp);
          saveColumnWidths(targetTable, stateKey);
        };

        handle.addEventListener('pointermove', onPointerMove);
        handle.addEventListener('pointerup', onPointerUp);
        handle.addEventListener('pointercancel', onPointerUp);
      });
    });
  }

  function setupColumnResizing() {
    setupResizableTable(table, columnWidthsKey);
  }


  function updateBoundTargetInputValidation(apiUniqueName) {
    const definition = definitionsByUniqueName.get(apiUniqueName);
    if (!definition) {
      return;
    }

    const currentValue = getBoundTargetRowId(definition);
    const isInvalidGuid = currentValue.trim().length > 0 && !isValidGuid(currentValue);
    const validationHtml = getBoundTargetValidationHtml(definition, currentValue);
    document.querySelectorAll('[data-role="bound-target-row-id"][data-api-unique-name="' + cssEscape(apiUniqueName) + '"]').forEach((matchingInput) => {
      if (!(matchingInput instanceof HTMLInputElement)) {
        return;
      }

      matchingInput.value = currentValue;
      matchingInput.classList.toggle('dvqr-target-input-invalid', isInvalidGuid);
      const wrapper = matchingInput.closest('.dvqr-footer-target-input');
      const validation = wrapper ? wrapper.querySelector('.dvqr-target-validation') : undefined;
      if (validation instanceof HTMLElement) {
        validation.outerHTML = validationHtml;
      }
    });
  }

  document.addEventListener('input', (event) => {
    const input = event.target instanceof HTMLElement ? event.target.closest('[data-role="bound-target-row-id"]') : undefined;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const apiUniqueName = input.getAttribute('data-api-unique-name') || selectedUniqueName;
    if (!apiUniqueName) {
      return;
    }

    boundTargetRowIds.set(apiUniqueName, input.value.trim());
    updateBoundTargetInputValidation(apiUniqueName);
  });

  document.addEventListener('click', (event) => {
    const actionTarget = event.target instanceof Element ? event.target.closest('[data-action]') : undefined;
    if (!(actionTarget instanceof HTMLElement)) {
      return;
    }

    const action = actionTarget.getAttribute('data-action');

    if (action === 'refresh') {
      vscode.postMessage({ type: 'refresh' });
      return;
    }

    if (action === 'open-hub') {
      vscode.postMessage({ type: 'openHub' });
      return;
    }

    if (action === 'close-detail') {
      closeDetail();
      return;
    }

    if (action === 'preview-execution') {
      const apiUniqueName = actionTarget.getAttribute('data-api-unique-name') || selectedUniqueName;
      const definition = definitionsByUniqueName.get(apiUniqueName);
      if (apiUniqueName) {
        if (isEntityBoundAction(definition)) {
          const rowId = getBoundTargetRowId(definition);
          const normalizedRowId = normalizeGuid(rowId);
          if (!isBoundEntitySetResolved(definition)) {
            vscode.postMessage({
              type: 'boundRouteUnavailable',
              apiUniqueName,
              reason: 'The bound entity set could not be resolved from metadata, so DV Quick Run cannot create an executable bound route.'
            });
            renderDetail(apiUniqueName);
            return;
          }

          if (!normalizedRowId) {
            vscode.postMessage({
              type: 'boundTargetInvalid',
              apiUniqueName,
              reason: 'Enter a valid target row GUID before generating a bound Action preview.'
            });
            renderDetail(apiUniqueName);
            return;
          }

          vscode.postMessage({ type: 'previewCustomApi', apiUniqueName, boundTargetRowId: normalizedRowId });
          return;
        }

        vscode.postMessage({ type: 'previewCustomApi', apiUniqueName });
      }
      return;
    }

    if (action === 'open-execution-insights') {
      const apiUniqueName = actionTarget.getAttribute('data-api-unique-name') || selectedUniqueName;
      if (apiUniqueName && latestExecutionInsightUniqueName === apiUniqueName) {
        vscode.postMessage({ type: 'openCapabilityExecutionInsights' });
      }
      return;
    }

    if (action === 'copy-summary') {
      vscode.postMessage({
        type: 'copyText',
        text: 'Custom APIs: ' + model.customApiCount + '\\nBound: ' + model.boundCount + '\\nUnbound: ' + model.unboundCount + '\\nPrivate: ' + model.privateCount
      });
    }
  });

  window.addEventListener('message', (event) => {
    const message = event.data;
    if (!message || message.type !== 'capabilityExecutionAvailable') {
      return;
    }

    const apiUniqueName = typeof message.apiUniqueName === 'string' ? message.apiUniqueName : '';
    if (!apiUniqueName) {
      return;
    }

    latestExecutionInsightUniqueName = apiUniqueName;

    if (selectedUniqueName === apiUniqueName) {
      renderDetail(apiUniqueName);
    }
  });

  setupColumnResizing();
  renderRows();
})();`;
}
