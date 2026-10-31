/**
 * Brightloop Software — Module 4: Invoice Management
 * Complete UI for Invoices, Automated Generation from Subscriptions,
 * Filter/Search, Lifecycle Actions (Draft, Confirm, Pay, Cancel),
 * Corporate Document Viewer, and PDF/Print capabilities.
 */

const Module4 = {
  activeTab: 'all',

  // ═════════════════════════════════════════════════════════════════════════════
  // 1. INVOICES PAGE
  // ═════════════════════════════════════════════════════════════════════════════

  async invoicesPage(queryParams = {}) {
    const role = Auth.getRole();
    const statusFilter = queryParams.status || '';
    const search = queryParams.search || '';

    let endpoint = `/invoices?status=${encodeURIComponent(statusFilter)}&search=${encodeURIComponent(search)}`;
    const [invRes, statsRes] = await Promise.all([
      API.get(endpoint),
      role !== 'customer' ? API.get('/invoices/stats') : Promise.resolve(null)
    ]);

    const invoices = invRes.success ? (invRes.data.invoices || []) : [];
    const stats = statsRes && statsRes.success ? statsRes.data : null;

    const content = `
      <div class="page-container">
        <!-- Header -->
        <div class="page-header flex-between mb-4">
          <div>
            <h1 class="page-title">${role === 'customer' ? 'My Invoices & Receipts' : 'Invoice Management'}</h1>
            <p class="page-subtitle">${role === 'customer' ? 'Review billing statements, download tax receipts, and pay outstanding balances' : 'Manage recurring billing, draft modifications, and payment reconciliations'}</p>
          </div>
          <div class="header-actions">
            ${role !== 'customer' ? `
              <button class="btn btn-outline mr-2" onclick="Module4.openCreateCustomModal()">
                <span class="material-icons-round">post_add</span> Custom Invoice
              </button>
              <button class="btn btn-primary" onclick="Module4.openGenerateModal()">
                <span class="material-icons-round">receipt_long</span> Generate from Subscription
              </button>
            ` : ''}
          </div>
        </div>

        ${stats ? `
          <!-- KPI Metrics Cards (Admin & Staff) -->
          <div class="stats-grid mb-4">
            <div class="stat-card">
              <div class="stat-icon icon-blue"><span class="material-icons-round">receipt</span></div>
              <div class="stat-content">
                <div class="stat-value">${stats.total_invoices}</div>
                <div class="stat-label">Total Invoices</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon icon-green"><span class="material-icons-round">payments</span></div>
              <div class="stat-content">
                <div class="stat-value">₹${stats.total_revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                <div class="stat-label">Total Paid Revenue</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon icon-amber"><span class="material-icons-round">pending_actions</span></div>
              <div class="stat-content">
                <div class="stat-value">₹${stats.receivable_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                <div class="stat-label">Pending Receivable</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon icon-purple"><span class="material-icons-round">edit_document</span></div>
              <div class="stat-content">
                <div class="stat-value">${stats.draft_invoices}</div>
                <div class="stat-label">Draft Queue (${stats.draft_amount ? '₹' + stats.draft_amount.toLocaleString('en-IN') : '0'})</div>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Filter & Search Toolbar -->
        <div class="table-toolbar flex-between mb-3">
          <div class="filter-tabs">
            <button class="filter-tab ${!statusFilter ? 'active' : ''}" onclick="Module4.navigateFilter('')">All</button>
            <button class="filter-tab ${statusFilter === 'Draft' ? 'active' : ''}" onclick="Module4.navigateFilter('Draft')">Draft</button>
            <button class="filter-tab ${statusFilter === 'Confirmed' ? 'active' : ''}" onclick="Module4.navigateFilter('Confirmed')">Confirmed</button>
            <button class="filter-tab ${statusFilter === 'Paid' ? 'active' : ''}" onclick="Module4.navigateFilter('Paid')">Paid</button>
            <button class="filter-tab ${statusFilter === 'Cancelled' ? 'active' : ''}" onclick="Module4.navigateFilter('Cancelled')">Cancelled</button>
          </div>
          <div class="search-box">
            <input type="text" id="inv-search-input" class="form-control" placeholder="Search invoice #, client, subscription..." value="${search}" onkeyup="if(event.key==='Enter') Module4.filterInvoices()">
            <button class="btn btn-secondary btn-sm" onclick="Module4.filterInvoices()">Search</button>
          </div>
        </div>

        <!-- Invoices Table -->
        <div class="card p-0 overflow-hidden">
          <div class="table-responsive">
            <table class="table data-table mb-0">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  ${role !== 'customer' ? '<th>Customer</th>' : ''}
                  <th>Subscription</th>
                  <th>Invoice Date</th>
                  <th>Due Date</th>
                  <th>Billing Period</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${invoices.length === 0 ? `
                  <tr>
                    <td colspan="${role !== 'customer' ? 9 : 8}" class="text-center py-5 text-muted">
                      <span class="material-icons-round fs-1 d-block mb-2">receipt_long</span>
                      No invoices found matching the filter criteria.
                    </td>
                  </tr>
                ` : invoices.map(inv => `
                  <tr>
                    <td>
                      <strong class="text-primary font-mono cursor-pointer" onclick="Module4.viewInvoice(${inv.id})">${inv.invoice_number}</strong>
                      <div class="text-xs text-muted">${inv.line_items_count || 1} line item(s)</div>
                    </td>
                    ${role !== 'customer' ? `
                      <td>
                        <div class="fw-semibold">${inv.customer_name}</div>
                        <div class="text-xs text-muted">${inv.customer_email}</div>
                      </td>
                    ` : ''}
                    <td>
                      <span class="badge badge-outline-blue font-mono">${inv.subscription_number}</span>
                      <div class="text-xs text-muted">${inv.plan_name || 'Standard'}</div>
                    </td>
                    <td>${DateUtils.format(inv.invoice_date)}</td>
                    <td>
                      <span class="${inv.status !== 'Paid' && inv.due_date && new Date(inv.due_date) < new Date() ? 'text-danger fw-bold' : ''}">
                        ${DateUtils.format(inv.due_date)}
                      </span>
                    </td>
                    <td class="text-xs">
                      <div>${DateUtils.format(inv.billing_period_start)}</div>
                      <div class="text-muted">to ${DateUtils.format(inv.billing_period_end)}</div>
                    </td>
                    <td class="font-mono fw-bold">₹${parseFloat(inv.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td>${Module4.renderStatusBadge(inv.status)}</td>
                    <td class="text-right">
                      <div class="btn-group">
                        <button class="btn btn-sm btn-outline" onclick="Module4.viewInvoice(${inv.id})" title="View Invoice">
                          <span class="material-icons-round">visibility</span>
                        </button>
                        <button class="btn btn-sm btn-outline text-secondary" onclick="Module4.printInvoice(${inv.id})" title="Print / PDF Receipt">
                          <span class="material-icons-round">print</span>
                        </button>
                        ${role !== 'customer' ? `
                          ${inv.status === 'Draft' ? `
                            <button class="btn btn-sm btn-outline text-primary" onclick="Module4.openEditDraftModal(${inv.id})" title="Edit Draft Invoice">
                              <span class="material-icons-round">edit</span>
                            </button>
                            <button class="btn btn-sm btn-outline text-success" onclick="Module4.promptConfirm(${inv.id}, '${inv.invoice_number}')" title="Confirm Draft Invoice">
                              <span class="material-icons-round">check_circle</span>
                            </button>
                          ` : ''}
                          ${inv.status === 'Confirmed' ? `
                            <button class="btn btn-sm btn-outline text-success" onclick="Module4.openPayModal(${inv.id}, '${inv.invoice_number}', ${inv.total_amount})" title="Record Payment">
                              <span class="material-icons-round">payment</span>
                            </button>
                          ` : ''}
                          ${inv.status !== 'Cancelled' && inv.status !== 'Paid' ? `
                            <button class="btn btn-sm btn-outline text-danger" onclick="Module4.promptCancel(${inv.id}, '${inv.invoice_number}')" title="Cancel Invoice">
                              <span class="material-icons-round">cancel</span>
                            </button>
                          ` : ''}
                        ` : `
                          ${inv.status === 'Confirmed' ? `
                            <button class="btn btn-sm btn-primary" onclick="Module4.openCustomerPayModal(${inv.id}, '${inv.invoice_number}', ${inv.total_amount})" title="Pay Outstanding Balance">
                              <span class="material-icons-round">credit_card</span> Pay
                            </button>
                          ` : ''}
                        `}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    return Dashboards.layout('invoices', content);
  },

  renderStatusBadge(status) {
    const map = {
      'Paid': 'badge-success',
      'Confirmed': 'badge-primary',
      'Draft': 'badge-secondary',
      'Cancelled': 'badge-danger'
    };
    return `<span class="badge ${map[status] || 'badge-secondary'}">${status}</span>`;
  },

  navigateFilter(status) {
    const role = Auth.getRole();
    const path = role === 'customer' ? '/dashboard/customer/invoices' : `/dashboard/${role}/invoices`;
    Router.navigate(path, status ? { status } : {});
  },

  filterInvoices() {
    const search = document.getElementById('inv-search-input')?.value.trim();
    const role = Auth.getRole();
    const path = role === 'customer' ? '/dashboard/customer/invoices' : `/dashboard/${role}/invoices`;
    Router.navigate(path, search ? { search } : {});
  },

  // ═════════════════════════════════════════════════════════════════════════════
  // 2. VIEW INVOICE DOCUMENT MODAL
  // ═════════════════════════════════════════════════════════════════════════════

  async viewInvoice(id) {
    Loading.show();
    const res = await API.get(`/invoices/${id}`);
    Loading.hide();

    if (!res.success || !res.data.invoice) {
      Toast.error('Error', res.message || 'Failed to load invoice details.');
      return;
    }

    const inv = res.data.invoice;
    const role = Auth.getRole();

    const bodyHtml = `
      <div class="invoice-document" id="printable-invoice-doc">
        <!-- Status & Header Banner -->
        <div class="p-3 mb-3 rounded flex-between" style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color: white;">
          <div>
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #cbd5e1;">Tax Invoice</div>
            <div style="font-size: 22px; font-weight: 800; font-family: monospace;">${inv.invoice_number}</div>
            <div style="font-size: 12px; color: #cbd5e1;">Created on ${DateUtils.formatFull(inv.created_at)}</div>
          </div>
          <div class="text-right">
            <div>${this.renderStatusBadge(inv.status)}</div>
            <div style="font-size: 20px; font-weight: 800; font-family: monospace; margin-top: 6px;">₹${parseFloat(inv.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            ${inv.status === 'Paid' ? '<div style="font-size: 11px; color: #86efac;">Paid in Full</div>' : ''}
          </div>
        </div>

        <!-- Corporate Branding & Billing Metadata -->
        <div class="grid grid-2 gap-3 mb-3">
          <div class="card p-3 mb-0" style="background: #f8fafc; border: 1px solid #e2e8f0;">
            <div class="text-xs text-muted text-uppercase fw-bold mb-1">Billed To</div>
            <div class="fs-5 fw-bold text-primary">${inv.customer_name}</div>
            <div class="text-sm text-secondary">${inv.customer_email}</div>
            <div class="text-xs text-muted mt-2">Client ID: ${inv.customer_id} ${inv.customer_uuid ? '| ' + inv.customer_uuid.substring(0, 8) + '...' : ''}</div>
          </div>
          <div class="card p-3 mb-0" style="background: #f8fafc; border: 1px solid #e2e8f0;">
            <div class="text-xs text-muted text-uppercase fw-bold mb-1">Subscription & Terms</div>
            <div class="flex-between text-sm py-1 border-bottom">
              <span class="text-muted">Subscription:</span>
              <strong class="font-mono text-primary">${inv.subscription_number}</strong>
            </div>
            <div class="flex-between text-sm py-1 border-bottom">
              <span class="text-muted">Plan:</span>
              <span>${inv.plan_name} (${inv.billing_frequency})</span>
            </div>
            <div class="flex-between text-sm py-1 border-bottom">
              <span class="text-muted">Billing Period:</span>
              <span>${DateUtils.format(inv.billing_period_start)} to ${DateUtils.format(inv.billing_period_end)}</span>
            </div>
            <div class="flex-between text-sm py-1">
              <span class="text-muted">Payment Terms / Due:</span>
              <strong>${inv.payment_terms || 'Net 30'} (${DateUtils.format(inv.due_date)})</strong>
            </div>
          </div>
        </div>

        <!-- Payment or Cancellation Banner -->
        ${inv.status === 'Paid' ? `
          <div class="alert alert-success p-2 mb-3 flex-between" style="border-radius: 8px;">
            <div class="d-flex align-items-center gap-2">
              <span class="material-icons-round text-success">verified</span>
              <div>
                <strong>Payment Received:</strong> ₹${parseFloat(inv.amount_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })} settled via <strong>${inv.payment_method || 'Standard Wire'}</strong>
                ${inv.payment_reference ? `(Ref: <code>${inv.payment_reference}</code>)` : ''}
              </div>
            </div>
            <div class="text-xs text-muted">${inv.paid_at ? DateUtils.formatFull(inv.paid_at) : ''}</div>
          </div>
        ` : ''}

        ${inv.status === 'Cancelled' ? `
          <div class="alert alert-danger p-2 mb-3" style="border-radius: 8px;">
            <div class="d-flex align-items-center gap-2">
              <span class="material-icons-round text-danger">cancel</span>
              <div>
                <strong>Invoice Cancelled:</strong> ${inv.cancellation_reason || 'Cancelled by administration'}
                <div class="text-xs text-muted mt-1">Cancelled at ${inv.cancelled_at ? DateUtils.formatFull(inv.cancelled_at) : 'N/A'}</div>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Product Line Items Table -->
        <div class="card p-0 mb-3 overflow-hidden" style="border: 1px solid #e2e8f0;">
          <table class="table mb-0 text-sm">
            <thead style="background: #f1f5f9;">
              <tr>
                <th>Item & Description</th>
                <th class="text-center">Qty</th>
                <th class="text-right">Unit Price</th>
                <th class="text-right">Tax (GST)</th>
                <th class="text-right">Line Total</th>
              </tr>
            </thead>
            <tbody>
              ${(inv.lines || []).map(line => `
                <tr>
                  <td>
                    <div class="fw-semibold">${line.product_name}</div>
                    ${line.variant_name ? `<div class="text-xs text-muted">Edition: <span class="badge badge-subtle">${line.variant_name}</span></div>` : ''}
                  </td>
                  <td class="text-center font-mono">${line.quantity}</td>
                  <td class="text-right font-mono">₹${parseFloat(line.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td class="text-right font-mono text-muted">
                    <div>₹${parseFloat(line.tax_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    <div class="text-xs">${line.tax_code || 'GST'} (${line.tax_rate}%)</div>
                  </td>
                  <td class="text-right font-mono fw-bold">₹${parseFloat(line.line_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Financial Summary Grid -->
        <div class="flex-between align-items-start mb-3">
          <div style="flex: 1; margin-right: 20px;">
            <div class="text-xs text-muted fw-bold text-uppercase mb-1">Invoice Notes</div>
            <p class="text-sm text-secondary bg-light p-2 rounded mb-0" style="min-height: 48px; border: 1px dashed #cbd5e1;">
              ${inv.notes || 'Standard recurring digital service subscription license. Applicable taxes calculated under Indian GST laws.'}
            </p>
          </div>
          <div class="card p-3 mb-0" style="width: 320px; background: #f8fafc; border: 1px solid #e2e8f0;">
            <div class="flex-between text-sm py-1">
              <span class="text-secondary">Gross Subtotal:</span>
              <span class="font-mono fw-semibold">₹${parseFloat(inv.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            ${inv.discount_amount > 0 ? `
              <div class="flex-between text-sm py-1 text-success">
                <span>Discount ${inv.discount_code ? '(' + inv.discount_code + ')' : ''}:</span>
                <span class="font-mono fw-semibold">-₹${parseFloat(inv.discount_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div class="flex-between text-xs py-1 text-muted border-top border-bottom">
                <span>Taxable Amount:</span>
                <span class="font-mono">₹${parseFloat(inv.taxable_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            ` : ''}
            <div class="flex-between text-sm py-1">
              <span class="text-secondary">Taxes (GST):</span>
              <span class="font-mono">+₹${parseFloat(inv.tax_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div class="flex-between fs-5 fw-bold text-primary py-2 border-top mt-1">
              <span>Total Amount:</span>
              <span class="font-mono">₹${parseFloat(inv.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div class="flex-between text-xs py-1" style="color: ${inv.status === 'Paid' ? '#16a34a' : '#d97706'}; font-weight: 600;">
              <span>Balance Due:</span>
              <span class="font-mono">₹${parseFloat(inv.total_amount - (inv.amount_paid || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        <!-- Audit History Log -->
        ${inv.history && inv.history.length > 0 ? `
          <div class="mt-4 pt-3 border-top">
            <h5 class="text-xs text-muted text-uppercase tracking-wider mb-2">Audit & Lifecycle History</h5>
            <div class="timeline text-xs">
              ${inv.history.map(h => `
                <div class="timeline-item pb-2 d-flex gap-2">
                  <span class="material-icons-round text-primary fs-6">history</span>
                  <div>
                    <strong>${h.action}</strong>: ${h.notes || 'State transition'}
                    ${h.changed_by_name ? `<span class="text-muted">— by ${h.changed_by_name}</span>` : ''}
                    <span class="text-muted">(${DateUtils.timeAgo(h.created_at)})</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    // Modal action buttons
    const buttons = [
      { label: 'Print / PDF', class: 'btn-outline', onclick: `Module4.printInvoice(${inv.id})` }
    ];

    if (role !== 'customer') {
      if (inv.status === 'Draft') {
        buttons.push({ label: 'Edit Draft', class: 'btn-outline text-primary', onclick: `Modal.close(); Module4.openEditDraftModal(${inv.id});` });
        buttons.push({ label: 'Confirm Invoice', class: 'btn-success', onclick: `Modal.close(); Module4.promptConfirm(${inv.id}, '${inv.invoice_number}');` });
      } else if (inv.status === 'Confirmed') {
        buttons.push({ label: 'Record Payment', class: 'btn-success', onclick: `Modal.close(); Module4.openPayModal(${inv.id}, '${inv.invoice_number}', ${inv.total_amount});` });
      }

      if (inv.status !== 'Cancelled' && inv.status !== 'Paid') {
        buttons.push({ label: 'Cancel Invoice', class: 'btn-danger', onclick: `Modal.close(); Module4.promptCancel(${inv.id}, '${inv.invoice_number}');` });
      }
    } else {
      if (inv.status === 'Confirmed') {
        buttons.push({ label: 'Pay Now', class: 'btn-primary', onclick: `Modal.close(); Module4.openCustomerPayModal(${inv.id}, '${inv.invoice_number}', ${inv.total_amount});` });
      }
    }

    buttons.push({ label: 'Close', class: 'btn-secondary', onclick: 'Modal.close()' });

    Modal.open({
      title: `Invoice Details: ${inv.invoice_number}`,
      body: bodyHtml,
      width: '840px',
      buttons
    });
  },

  // ═════════════════════════════════════════════════════════════════════════════
  // 3. GENERATE INVOICE FROM SUBSCRIPTION (MODAL)
  // ═════════════════════════════════════════════════════════════════════════════

  async openGenerateModal(presetSubId = null) {
    Loading.show();
    const res = await API.get('/subscriptions?status=Active');
    Loading.hide();

    if (!res.success) {
      Toast.error('Error', 'Failed to retrieve active subscriptions.');
      return;
    }

    const subscriptions = res.data.subscriptions || [];
    if (subscriptions.length === 0) {
      Toast.warning('Notice', 'No active subscriptions found to bill.');
      return;
    }

    const modalBody = `
      <div class="gen-invoice-form">
        <div class="form-group mb-3">
          <label class="form-label">Select Active Subscription <span class="text-danger">*</span></label>
          <select id="gen-sub-select" class="form-control" onchange="Module4.onGenerateSubChange(this.value)">
            <option value="">-- Choose active subscription to bill --</option>
            ${subscriptions.map(s => `
              <option value="${s.id}" ${presetSubId && Number(presetSubId) === s.id ? 'selected' : ''}>
                ${s.subscription_number} — ${s.customer_name} (${s.plan_name})
              </option>
            `).join('')}
          </select>
        </div>

        <div id="gen-payload-preview" class="p-3 bg-light rounded border mb-3">
          <div class="text-muted text-center text-sm py-3">Select a subscription above to pull billing cycle and line items.</div>
        </div>

        <div class="grid grid-2 gap-3 mb-3">
          <div class="form-group mb-0">
            <label class="form-label">Invoice Date</label>
            <input type="date" id="gen-inv-date" class="form-control" value="${new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group mb-0">
            <label class="form-label">Due Date</label>
            <input type="date" id="gen-due-date" class="form-control">
          </div>
        </div>

        <div class="form-group mb-0">
          <label class="form-label">Billing Notes (Optional)</label>
          <input type="text" id="gen-notes" class="form-control" placeholder="e.g. Monthly recurring cloud service subscription charge">
        </div>
      </div>
    `;

    Modal.open({
      title: 'Generate Automated Invoice from Subscription',
      body: modalBody,
      width: '750px',
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onclick: 'Modal.close()' },
        { label: 'Generate Draft Invoice', class: 'btn-primary', id: 'submit-gen-invoice-btn', onclick: 'Module4.submitGenerateInvoice()' }
      ]
    });

    if (presetSubId) {
      this.onGenerateSubChange(presetSubId);
    }
  },

  async onGenerateSubChange(subId) {
    const previewEl = document.getElementById('gen-payload-preview');
    const dueDateInput = document.getElementById('gen-due-date');
    if (!previewEl || !subId) {
      if (previewEl) previewEl.innerHTML = '<div class="text-muted text-center text-sm py-3">Select a subscription above to pull billing cycle and line items.</div>';
      return;
    }

    previewEl.innerHTML = '<div class="text-center py-3"><span class="btn-spinner"></span> Loading subscription payload...</div>';

    const res = await API.get(`/subscriptions/${subId}/invoice-payload`);
    if (!res.success || !res.data.invoice_payload) {
      previewEl.innerHTML = `<div class="text-danger text-sm p-2">Failed to load invoice payload: ${res.message}</div>`;
      return;
    }

    const p = res.data.invoice_payload;
    window._currentGenPayload = p;

    if (dueDateInput && p.dates.due_date) {
      dueDateInput.value = p.dates.due_date;
    }

    previewEl.innerHTML = `
      <div class="text-xs flex-between border-bottom pb-2 mb-2">
        <div>
          <span class="text-muted">Client:</span> <strong>${p.customer.name}</strong> (${p.customer.email})
        </div>
        <div>
          <span class="text-muted">Billing Cycle:</span> <strong>${DateUtils.format(p.dates.start_date)}</strong> to <strong>${DateUtils.format(p.dates.expiry_date)}</strong>
        </div>
      </div>

      <div class="table-responsive mb-2">
        <table class="table table-sm mb-0 text-xs">
          <thead>
            <tr>
              <th>Product / Variant</th>
              <th class="text-center">Qty</th>
              <th class="text-right">Unit Price</th>
              <th class="text-right">Tax</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${p.items.map(item => `
              <tr>
                <td>${item.product_name} ${item.variant_name ? `<span class="badge badge-subtle">${item.variant_name}</span>` : ''}</td>
                <td class="text-center font-mono">${item.quantity}</td>
                <td class="text-right font-mono">₹${parseFloat(item.unit_price).toFixed(2)}</td>
                <td class="text-right font-mono text-muted">₹${parseFloat(item.tax_amount).toFixed(2)}</td>
                <td class="text-right font-mono fw-bold">₹${parseFloat(item.line_total).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="flex-between text-xs pt-2 border-top">
        <div class="text-muted">
          Terms: <strong>${p.payment_terms || 'Net 30'}</strong>
          ${p.discount ? ` | Coupon: <span class="badge badge-success">${p.discount.code} (-₹${p.discount.amount})</span>` : ''}
        </div>
        <div class="text-right">
          <span class="text-muted">Total Payable:</span>
          <span class="font-mono fs-5 fw-bold text-primary ml-2">₹${parseFloat(p.summary.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
    `;
  },

  async submitGenerateInvoice() {
    const subId = document.getElementById('gen-sub-select')?.value;
    const invDate = document.getElementById('gen-inv-date')?.value;
    const dueDate = document.getElementById('gen-due-date')?.value;
    const notes = document.getElementById('gen-notes')?.value.trim();

    if (!subId) {
      Toast.error('Validation', 'Please select a subscription.');
      return;
    }

    const payload = window._currentGenPayload;
    const body = {
      subscription_id: Number(subId),
      invoice_date: invDate,
      due_date: dueDate,
      billing_period_start: payload ? payload.dates.start_date : null,
      billing_period_end: payload ? payload.dates.expiry_date : null,
      notes: notes || undefined
    };

    Loading.show();
    const res = await API.post(`/invoices/generate/${subId}`, body);
    Loading.hide();

    if (res.success) {
      Toast.success('Created', res.message || 'Invoice generated successfully!');
      Modal.close();
      Router.resolve();
    } else {
      Toast.error('Error', res.message || 'Failed to generate invoice.');
    }
  },

  // ═════════════════════════════════════════════════════════════════════════════
  // 4. CREATE CUSTOM INVOICE MODAL
  // ═════════════════════════════════════════════════════════════════════════════

  async openCreateCustomModal() {
    Loading.show();
    const [custRes, subRes, prodRes] = await Promise.all([
      API.get('/users?role=customer'),
      API.get('/subscriptions'),
      API.get('/products')
    ]);
    Loading.hide();

    const customers = custRes.success ? (custRes.data.users || []) : [];
    const subs = subRes.success ? (subRes.data.subscriptions || []) : [];
    const products = prodRes.success ? (prodRes.data.products || []) : [];
    window._cachedProducts = products;

    const modalBody = `
      <div class="custom-inv-form">
        <div class="grid grid-2 gap-3 mb-3">
          <div class="form-group mb-0">
            <label class="form-label">Customer <span class="text-danger">*</span></label>
            <select id="cust-inv-customer-id" class="form-control" onchange="Module4.onCustomCustomerChange(this.value)">
              <option value="">-- Select Customer --</option>
              ${customers.map(c => `<option value="${c.id}">${c.name} (${c.email})</option>`).join('')}
            </select>
          </div>
          <div class="form-group mb-0">
            <label class="form-label">Subscription <span class="text-danger">*</span></label>
            <select id="cust-inv-sub-id" class="form-control">
              <option value="">-- Select Subscription --</option>
              ${subs.map(s => `<option value="${s.id}" data-customer="${s.customer_id}">${s.subscription_number} (${s.customer_name})</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="grid grid-2 gap-3 mb-3">
          <div class="form-group mb-0">
            <label class="form-label">Invoice Date</label>
            <input type="date" id="cust-inv-date" class="form-control" value="${new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group mb-0">
            <label class="form-label">Due Date</label>
            <input type="date" id="cust-inv-due-date" class="form-control" value="${new Date(Date.now() + 30*86400000).toISOString().split('T')[0]}">
          </div>
        </div>

        <div class="grid grid-2 gap-3 mb-3">
          <div class="form-group mb-0">
            <label class="form-label">Billing Period Start</label>
            <input type="date" id="cust-inv-period-start" class="form-control" value="${new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group mb-0">
            <label class="form-label">Billing Period End</label>
            <input type="date" id="cust-inv-period-end" class="form-control" value="${new Date(Date.now() + 30*86400000).toISOString().split('T')[0]}">
          </div>
        </div>

        <!-- Line Items Section -->
        <div class="mb-3">
          <div class="flex-between mb-2">
            <label class="form-label mb-0 fw-bold">Invoice Line Items</label>
            <button type="button" class="btn btn-sm btn-outline" onclick="Module4.addCustomLineItem()">
              <span class="material-icons-round fs-6">add</span> Add Line
            </button>
          </div>
          <div id="cust-inv-lines-container"></div>
        </div>

        <div class="grid grid-2 gap-3 mb-3">
          <div class="form-group mb-0">
            <label class="form-label">Payment Terms</label>
            <select id="cust-inv-terms" class="form-control">
              <option value="Net 15">Net 15</option>
              <option value="Net 30" selected>Net 30</option>
              <option value="Net 60">Net 60</option>
              <option value="Immediate">Immediate / Due upon receipt</option>
            </select>
          </div>
          <div class="form-group mb-0">
            <label class="form-label">Discount Amount (₹)</label>
            <input type="number" id="cust-inv-discount" class="form-control" value="0" min="0" step="any" oninput="Module4.refreshCustomInvTotal()">
          </div>
        </div>

        <div id="cust-inv-total-preview" class="p-3 bg-light rounded border text-right mb-0">
          <div class="text-sm">Subtotal: <strong class="font-mono" id="cust-subtotal-val">₹0.00</strong></div>
          <div class="text-sm">Estimated Tax (18%): <strong class="font-mono" id="cust-tax-val">₹0.00</strong></div>
          <div class="fs-5 fw-bold text-primary mt-1">Total Payable: <span class="font-mono" id="cust-total-val">₹0.00</span></div>
        </div>
      </div>
    `;

    Modal.open({
      title: 'Create Custom Invoice',
      body: modalBody,
      width: '780px',
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onclick: 'Modal.close()' },
        { label: 'Create Invoice', class: 'btn-primary', onclick: 'Module4.submitCustomInvoice()' }
      ]
    });

    this.addCustomLineItem();
  },

  onCustomCustomerChange(customerId) {
    const subSelect = document.getElementById('cust-inv-sub-id');
    if (!subSelect) return;
    const options = subSelect.querySelectorAll('option');
    options.forEach(opt => {
      if (!opt.value) return;
      if (!customerId || opt.dataset.customer === String(customerId)) {
        opt.style.display = '';
      } else {
        opt.style.display = 'none';
      }
    });
  },

  addCustomLineItem() {
    const container = document.getElementById('cust-inv-lines-container');
    if (!container) return;
    const products = window._cachedProducts || [];

    const row = document.createElement('div');
    row.className = 'cust-line-row d-flex gap-2 align-items-center mb-2';
    row.innerHTML = `
      <select class="form-control cust-line-prod" style="flex: 3;" onchange="Module4.onCustomProductSelect(this)">
        <option value="">-- Choose Product --</option>
        ${products.map(p => `<option value="${p.id}" data-price="${p.sales_price}">${p.name} (₹${p.sales_price})</option>`).join('')}
      </select>
      <input type="number" class="form-control cust-line-qty font-mono text-center" style="width: 80px;" value="1" min="1" oninput="Module4.refreshCustomInvTotal()">
      <input type="number" class="form-control cust-line-price font-mono text-right" style="width: 120px;" placeholder="Price" step="any" oninput="Module4.refreshCustomInvTotal()">
      <button type="button" class="btn btn-sm btn-ghost text-danger" onclick="this.closest('.cust-line-row').remove(); Module4.refreshCustomInvTotal();" title="Delete">
        <span class="material-icons-round">delete</span>
      </button>
    `;
    container.appendChild(row);
  },

  onCustomProductSelect(selectEl) {
    const opt = selectEl.options[selectEl.selectedIndex];
    const price = opt?.dataset.price || '0';
    const row = selectEl.closest('.cust-line-row');
    const priceInput = row.querySelector('.cust-line-price');
    if (priceInput) priceInput.value = price;
    this.refreshCustomInvTotal();
  },

  refreshCustomInvTotal() {
    const rows = document.querySelectorAll('.cust-line-row');
    let subtotal = 0;
    rows.forEach(r => {
      const qty = parseInt(r.querySelector('.cust-line-qty')?.value, 10) || 0;
      const price = parseFloat(r.querySelector('.cust-line-price')?.value) || 0;
      subtotal += (qty * price);
    });

    const disc = parseFloat(document.getElementById('cust-inv-discount')?.value) || 0;
    const taxable = Math.max(0, subtotal - disc);
    const tax = taxable * 0.18;
    const total = taxable + tax;

    const subEl = document.getElementById('cust-subtotal-val');
    const taxEl = document.getElementById('cust-tax-val');
    const totEl = document.getElementById('cust-total-val');

    if (subEl) subEl.textContent = `₹${subtotal.toFixed(2)}`;
    if (taxEl) taxEl.textContent = `₹${tax.toFixed(2)}`;
    if (totEl) totEl.textContent = `₹${total.toFixed(2)}`;
  },

  async submitCustomInvoice() {
    const customerId = document.getElementById('cust-inv-customer-id')?.value;
    const subId = document.getElementById('cust-inv-sub-id')?.value;
    const invDate = document.getElementById('cust-inv-date')?.value;
    const dueDate = document.getElementById('cust-inv-due-date')?.value;
    const periodStart = document.getElementById('cust-inv-period-start')?.value;
    const periodEnd = document.getElementById('cust-inv-period-end')?.value;
    const terms = document.getElementById('cust-inv-terms')?.value;
    const disc = parseFloat(document.getElementById('cust-inv-discount')?.value || 0);

    if (!customerId) return Toast.error('Validation', 'Please select a customer.');
    if (!subId) return Toast.error('Validation', 'Please select an associated subscription.');

    const rows = document.querySelectorAll('.cust-line-row');
    const lines = [];
    rows.forEach(r => {
      const pSelect = r.querySelector('.cust-line-prod');
      const pId = pSelect?.value;
      const pName = pSelect?.options[pSelect.selectedIndex]?.text?.split(' (')[0] || 'Custom Item';
      const qty = parseInt(r.querySelector('.cust-line-qty')?.value, 10) || 1;
      const unitPrice = parseFloat(r.querySelector('.cust-line-price')?.value) || 0;
      if (pId) {
        lines.push({ product_id: Number(pId), product_name: pName, quantity: qty, unit_price: unitPrice, tax_rate: 18.0 });
      }
    });

    if (lines.length === 0) return Toast.error('Validation', 'Please add at least one line item.');

    const body = {
      customer_id: Number(customerId),
      subscription_id: Number(subId),
      invoice_date: invDate,
      due_date: dueDate,
      billing_period_start: periodStart,
      billing_period_end: periodEnd,
      payment_terms: terms,
      discount_amount: disc,
      lines
    };

    Loading.show();
    const res = await API.post('/invoices', body);
    Loading.hide();

    if (res.success) {
      Toast.success('Created', res.message || 'Invoice created successfully!');
      Modal.close();
      Router.resolve();
    } else {
      Toast.error('Error', res.message || 'Failed to create invoice.');
    }
  },

  // ═════════════════════════════════════════════════════════════════════════════
  // 5. EDIT DRAFT INVOICE MODAL (REQUIREMENT 5)
  // ═════════════════════════════════════════════════════════════════════════════

  async openEditDraftModal(id) {
    Loading.show();
    const res = await API.get(`/invoices/${id}`);
    Loading.hide();

    if (!res.success || !res.data.invoice) {
      Toast.error('Error', res.message || 'Failed to load invoice.');
      return;
    }

    const inv = res.data.invoice;
    if (inv.status !== 'Draft') {
      Toast.error('Error', `Only Draft invoices can be updated. Current status is '${inv.status}'.`);
      return;
    }

    const modalBody = `
      <div class="edit-draft-form">
        <div class="alert alert-info p-2 mb-3 text-xs">
          <strong>Draft Modification:</strong> You can modify due dates, payment terms, line item quantities, prices, and discount amounts before final confirmation.
        </div>

        <div class="grid grid-2 gap-3 mb-3">
          <div class="form-group mb-0">
            <label class="form-label">Due Date <span class="text-danger">*</span></label>
            <input type="date" id="edit-draft-due-date" class="form-control" value="${inv.due_date}">
          </div>
          <div class="form-group mb-0">
            <label class="form-label">Payment Terms</label>
            <select id="edit-draft-terms" class="form-control">
              <option value="Net 15" ${inv.payment_terms === 'Net 15' ? 'selected' : ''}>Net 15</option>
              <option value="Net 30" ${inv.payment_terms === 'Net 30' ? 'selected' : ''}>Net 30</option>
              <option value="Net 45" ${inv.payment_terms === 'Net 45' ? 'selected' : ''}>Net 45</option>
              <option value="Net 60" ${inv.payment_terms === 'Net 60' ? 'selected' : ''}>Net 60</option>
            </select>
          </div>
        </div>

        <div class="form-group mb-3">
          <label class="form-label">Notes</label>
          <input type="text" id="edit-draft-notes" class="form-control" value="${inv.notes || ''}">
        </div>

        <div class="mb-3">
          <label class="form-label fw-bold">Line Items</label>
          <div id="edit-draft-lines-container">
            ${(inv.lines || []).map((l, idx) => `
              <div class="edit-draft-line-row d-flex gap-2 align-items-center mb-2" data-product-id="${l.product_id}" data-tax-rate="${l.tax_rate}">
                <div style="flex: 3;">
                  <strong class="text-sm">${l.product_name}</strong>
                  ${l.variant_name ? `<div class="text-xs text-muted">${l.variant_name}</div>` : ''}
                </div>
                <div style="width: 100px;">
                  <label class="text-xs text-muted">Qty</label>
                  <input type="number" class="form-control edit-line-qty text-center font-mono" value="${l.quantity}" min="1" oninput="Module4.refreshEditDraftTotal()">
                </div>
                <div style="width: 140px;">
                  <label class="text-xs text-muted">Unit Price (₹)</label>
                  <input type="number" class="form-control edit-line-price text-right font-mono" value="${l.unit_price}" step="any" oninput="Module4.refreshEditDraftTotal()">
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="form-group mb-3">
          <label class="form-label">Discount Amount (₹)</label>
          <input type="number" id="edit-draft-discount" class="form-control font-mono" value="${inv.discount_amount || 0}" min="0" step="any" oninput="Module4.refreshEditDraftTotal()">
        </div>

        <div id="edit-draft-total-summary" class="p-3 bg-light rounded border text-right">
          <div class="text-sm">Subtotal: <strong class="font-mono" id="edit-subtotal-val">₹${parseFloat(inv.subtotal).toFixed(2)}</strong></div>
          <div class="text-sm">Estimated Taxes: <strong class="font-mono" id="edit-tax-val">₹${parseFloat(inv.tax_amount).toFixed(2)}</strong></div>
          <div class="fs-5 fw-bold text-primary mt-1">Updated Total: <span class="font-mono" id="edit-total-val">₹${parseFloat(inv.total_amount).toFixed(2)}</span></div>
        </div>
      </div>
    `;

    Modal.open({
      title: `Edit Draft Invoice: ${inv.invoice_number}`,
      body: modalBody,
      width: '750px',
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onclick: 'Modal.close()' },
        { label: 'Save Changes', class: 'btn-primary', onclick: `Module4.submitEditDraft(${inv.id})` }
      ]
    });
  },

  refreshEditDraftTotal() {
    const rows = document.querySelectorAll('.edit-draft-line-row');
    let subtotal = 0;
    let tax = 0;
    rows.forEach(r => {
      const qty = parseInt(r.querySelector('.edit-line-qty')?.value, 10) || 0;
      const price = parseFloat(r.querySelector('.edit-line-price')?.value) || 0;
      const taxRate = parseFloat(r.dataset.taxRate || 18.0);
      const gross = qty * price;
      subtotal += gross;
      tax += (gross * (taxRate / 100));
    });

    const disc = parseFloat(document.getElementById('edit-draft-discount')?.value || 0);
    const taxable = Math.max(0, subtotal - disc);
    const finalTax = subtotal > 0 ? (tax * (taxable / subtotal)) : tax;
    const total = taxable + finalTax;

    const subEl = document.getElementById('edit-subtotal-val');
    const taxEl = document.getElementById('edit-tax-val');
    const totEl = document.getElementById('edit-total-val');

    if (subEl) subEl.textContent = `₹${subtotal.toFixed(2)}`;
    if (taxEl) taxEl.textContent = `₹${finalTax.toFixed(2)}`;
    if (totEl) totEl.textContent = `₹${total.toFixed(2)}`;
  },

  async submitEditDraft(id) {
    const dueDate = document.getElementById('edit-draft-due-date')?.value;
    const terms = document.getElementById('edit-draft-terms')?.value;
    const notes = document.getElementById('edit-draft-notes')?.value.trim();
    const disc = parseFloat(document.getElementById('edit-draft-discount')?.value || 0);

    const rows = document.querySelectorAll('.edit-draft-line-row');
    const lines = [];
    rows.forEach(r => {
      const pId = r.dataset.productId;
      const pName = r.querySelector('strong')?.textContent || 'Service Item';
      const qty = parseInt(r.querySelector('.edit-line-qty')?.value, 10) || 1;
      const unitPrice = parseFloat(r.querySelector('.edit-line-price')?.value) || 0;
      const taxRate = parseFloat(r.dataset.taxRate || 18.0);
      lines.push({
        product_id: pId ? Number(pId) : null,
        product_name: pName,
        quantity: qty,
        unit_price: unitPrice,
        tax_rate: taxRate
      });
    });

    const body = {
      due_date: dueDate,
      payment_terms: terms,
      notes,
      discount_amount: disc,
      lines
    };

    Loading.show();
    const res = await API.put(`/invoices/${id}`, body);
    Loading.hide();

    if (res.success) {
      Toast.success('Updated', res.message || 'Draft invoice saved.');
      Modal.close();
      Router.resolve();
    } else {
      Toast.error('Error', res.message || 'Failed to update draft invoice.');
    }
  },

  // ═════════════════════════════════════════════════════════════════════════════
  // 6. CONFIRM INVOICE (DRAFT -> CONFIRMED)
  // ═════════════════════════════════════════════════════════════════════════════

  promptConfirm(id, invNumber) {
    Modal.open({
      title: 'Confirm Draft Invoice',
      body: `
        <p class="text-secondary mb-3">
          Are you sure you want to confirm invoice <strong>${invNumber}</strong>?
        </p>
        <div class="alert alert-warning p-2 text-xs">
          <strong>Important:</strong> Once confirmed, this invoice becomes an official legally binding billing document awaiting payment and cannot be edited.
        </div>
      `,
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onclick: 'Modal.close()' },
        { label: 'Confirm Invoice', class: 'btn-primary', onclick: `Module4.executeConfirm(${id})` }
      ]
    });
  },

  async executeConfirm(id) {
    Loading.show();
    const res = await API.post(`/invoices/${id}/confirm`, {});
    Loading.hide();

    if (res.success) {
      Toast.success('Confirmed', res.message || 'Invoice confirmed.');
      Modal.close();
      Router.resolve();
    } else {
      Toast.error('Error', res.message || 'Failed to confirm invoice.');
    }
  },

  // ═════════════════════════════════════════════════════════════════════════════
  // 7. RECORD PAYMENT / PAY INVOICE (CONFIRMED -> PAID)
  // ═════════════════════════════════════════════════════════════════════════════

  openPayModal(id, invNumber, totalAmount) {
    const modalBody = `
      <div class="pay-invoice-form">
        <div class="p-3 bg-light rounded border mb-3 flex-between">
          <div>
            <div class="text-xs text-muted">Invoice Number</div>
            <div class="font-mono fs-5 fw-bold text-primary">${invNumber}</div>
          </div>
          <div class="text-right">
            <div class="text-xs text-muted">Amount Due</div>
            <div class="font-mono fs-4 fw-bold text-success">₹${parseFloat(totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div class="form-group mb-3">
          <label class="form-label">Payment Method <span class="text-danger">*</span></label>
          <select id="pay-method-select" class="form-control">
            <option value="Credit Card">Credit Card</option>
            <option value="UPI" selected>UPI (GooglePay / PhonePe / Paytm)</option>
            <option value="Bank Wire / NEFT">Bank Wire / NEFT Transfer</option>
            <option value="Net Banking">Net Banking</option>
            <option value="Cheque">Corporate Cheque</option>
            <option value="Cash">Cash</option>
          </select>
        </div>

        <div class="form-group mb-3">
          <label class="form-label">Transaction / Reference ID</label>
          <input type="text" id="pay-ref-input" class="form-control font-mono" placeholder="e.g. UPI/TXN-998811 or CHEQUE-4455" value="PAY-${Date.now()}">
        </div>

        <div class="form-group mb-0">
          <label class="form-label">Payment Notes (Optional)</label>
          <input type="text" id="pay-notes-input" class="form-control" placeholder="e.g. Full settlement received by finance desk">
        </div>
      </div>
    `;

    Modal.open({
      title: 'Record Invoice Payment',
      body: modalBody,
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onclick: 'Modal.close()' },
        { label: 'Confirm Payment', class: 'btn-success', onclick: `Module4.executePayment(${id})` }
      ]
    });
  },

  openCustomerPayModal(id, invNumber, totalAmount) {
    const modalBody = `
      <div class="customer-pay-form">
        <div class="p-3 bg-light rounded border mb-3 flex-between">
          <div>
            <div class="text-xs text-muted">Invoice Ref</div>
            <div class="font-mono fs-5 fw-bold text-primary">${invNumber}</div>
          </div>
          <div class="text-right">
            <div class="text-xs text-muted">Payable Balance</div>
            <div class="font-mono fs-4 fw-bold text-primary">₹${parseFloat(totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div class="form-group mb-3">
          <label class="form-label">Choose Payment Option</label>
          <select id="cust-pay-method" class="form-control">
            <option value="UPI">UPI Instant Pay</option>
            <option value="Credit Card">Credit / Debit Card</option>
            <option value="Net Banking">Net Banking Portal</option>
          </select>
        </div>

        <div class="p-2 alert alert-info text-xs">
          🔒 Secure simulated sandbox gateway. Clicking "Pay Balance" immediately issues payment receipt and marks the invoice as Paid in Full.
        </div>
      </div>
    `;

    Modal.open({
      title: `Pay Outstanding Invoice: ${invNumber}`,
      body: modalBody,
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onclick: 'Modal.close()' },
        { label: `Pay ₹${parseFloat(totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, class: 'btn-primary', onclick: `Module4.executePayment(${id}, true)` }
      ]
    });
  },

  async executePayment(id, isCustomer = false) {
    const method = document.getElementById(isCustomer ? 'cust-pay-method' : 'pay-method-select')?.value || 'UPI';
    const ref = document.getElementById('pay-ref-input')?.value.trim() || `TXN-${Date.now()}`;
    const notes = document.getElementById('pay-notes-input')?.value.trim() || 'Paid online via portal';

    Loading.show();
    const res = await API.post(`/invoices/${id}/pay`, {
      payment_method: method,
      payment_reference: ref,
      notes
    });
    Loading.hide();

    if (res.success) {
      Toast.success('Paid', res.message || 'Payment recorded successfully!');
      Modal.close();
      Router.resolve();
    } else {
      Toast.error('Error', res.message || 'Failed to record payment.');
    }
  },

  // ═════════════════════════════════════════════════════════════════════════════
  // 8. CANCEL INVOICE MODAL (REQUIREMENT 5 & 6)
  // ═════════════════════════════════════════════════════════════════════════════

  promptCancel(id, invNumber) {
    Modal.open({
      title: 'Cancel Invoice',
      body: `
        <p class="text-danger fw-semibold">Are you sure you want to cancel invoice ${invNumber}?</p>
        <p class="text-secondary text-sm">Cancelling voids this invoice and releases the subscription billing period lock so a corrected invoice can be issued if needed.</p>
        <div class="form-group mb-0">
          <label class="form-label">Cancellation Reason <span class="text-danger">*</span></label>
          <input type="text" id="cancel-inv-reason" class="form-control" placeholder="e.g. Incorrect billing period, customer requested revised terms">
        </div>
      `,
      buttons: [
        { label: 'Keep Active', class: 'btn-secondary', onclick: 'Modal.close()' },
        { label: 'Confirm Cancellation', class: 'btn-danger', onclick: `Module4.executeCancel(${id})` }
      ]
    });
  },

  async executeCancel(id) {
    const reason = document.getElementById('cancel-inv-reason')?.value.trim() || 'Cancelled by staff';
    Loading.show();
    const res = await API.post(`/invoices/${id}/cancel`, { reason });
    Loading.hide();

    if (res.success) {
      Toast.success('Cancelled', res.message || 'Invoice cancelled.');
      Modal.close();
      Router.resolve();
    } else {
      Toast.error('Error', res.message || 'Failed to cancel invoice.');
    }
  },

  // ═════════════════════════════════════════════════════════════════════════════
  // 9. PRINT / SAVE PDF INVOICE
  // ═════════════════════════════════════════════════════════════════════════════

  async printInvoice(id) {
    Loading.show();
    const res = await API.get(`/invoices/${id}`);
    Loading.hide();

    if (!res.success || !res.data.invoice) {
      Toast.error('Error', 'Failed to retrieve invoice for printing.');
      return;
    }

    const inv = res.data.invoice;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      Toast.error('Notice', 'Popup blocked. Please allow popups to print invoices.');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${inv.invoice_number}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Inter', sans-serif; font-size: 13px; color: #1e293b; background: white; padding: 30px; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 2px solid #e2e8f0; margin-bottom: 20px; }
          .company-name { font-size: 20px; font-weight: 800; color: #4338ca; }
          .invoice-title { font-size: 24px; font-weight: 800; font-family: 'JetBrains Mono', monospace; text-align: right; }
          .status-badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-top: 4px; }
          .badge-paid { background: #dcfce7; color: #15803d; }
          .badge-confirmed { background: #e0e7ff; color: #3730a3; }
          .badge-draft { background: #f1f5f9; color: #475569; }
          .badge-cancelled { background: #fee2e2; color: #b91c1c; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; }
          .card-title { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 700; margin-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background: #f1f5f9; text-align: left; padding: 10px; font-size: 11px; text-transform: uppercase; color: #475569; border-bottom: 1.5px solid #cbd5e1; }
          td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
          .font-mono { font-family: 'JetBrains Mono', monospace; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .totals-grid { display: flex; justify-content: flex-end; margin-bottom: 30px; }
          .totals-box { width: 300px; }
          .total-row { display: flex; justify-content: space-between; padding: 6px 0; }
          .grand-total { border-top: 2px solid #4338ca; border-bottom: 2px solid #4338ca; font-size: 16px; font-weight: 800; color: #4338ca; margin-top: 6px; }
          .footer { text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
          @media print {
            body { padding: 0; }
            @page { margin: 15mm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="company-name">Brightloop Software Pvt. Ltd.</div>
            <div style="color: #64748b; font-size: 12px; margin-top: 4px;">
              100 Innovation Park, Outer Ring Road, Tech Corridor<br>
              Bengaluru, Karnataka - 560100<br>
              GSTIN: 29AABCB1234F1Z5 | PAN: AABCB1234F
            </div>
          </div>
          <div>
            <div class="invoice-title">${inv.invoice_number}</div>
            <div class="text-right">
              <span class="status-badge badge-${inv.status.toLowerCase()}">${inv.status}</span>
            </div>
          </div>
        </div>

        <div class="meta-grid">
          <div class="card">
            <div class="card-title">Billed To</div>
            <div style="font-size: 15px; font-weight: 700;">${inv.customer_name}</div>
            <div style="color: #475569;">${inv.customer_email}</div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Customer ID: ${inv.customer_id}</div>
          </div>
          <div class="card">
            <div class="card-title">Invoice Details</div>
            <div class="total-row"><span>Invoice Date:</span> <strong class="font-mono">${inv.invoice_date}</strong></div>
            <div class="total-row"><span>Due Date:</span> <strong class="font-mono">${inv.due_date}</strong></div>
            <div class="total-row"><span>Subscription #:</span> <strong class="font-mono">${inv.subscription_number}</strong></div>
            <div class="total-row"><span>Billing Period:</span> <span>${inv.billing_period_start} to ${inv.billing_period_end}</span></div>
            <div class="total-row"><span>Payment Terms:</span> <strong>${inv.payment_terms || 'Net 30'}</strong></div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item & Description</th>
              <th class="text-center">Qty</th>
              <th class="text-right">Unit Price</th>
              <th class="text-right">Tax (GST)</th>
              <th class="text-right">Line Total</th>
            </tr>
          </thead>
          <tbody>
            ${(inv.lines || []).map(l => `
              <tr>
                <td>
                  <strong>${l.product_name}</strong>
                  ${l.variant_name ? `<div style="font-size: 11px; color: #64748b;">Variant: ${l.variant_name}</div>` : ''}
                </td>
                <td class="text-center font-mono">${l.quantity}</td>
                <td class="text-right font-mono">₹${parseFloat(l.unit_price).toFixed(2)}</td>
                <td class="text-right font-mono" style="color: #64748b;">₹${parseFloat(l.tax_amount).toFixed(2)} (${l.tax_rate}%)</td>
                <td class="text-right font-mono" style="font-weight: 700;">₹${parseFloat(l.line_total).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals-grid">
          <div class="totals-box">
            <div class="total-row"><span>Gross Subtotal:</span> <span class="font-mono">₹${parseFloat(inv.subtotal).toFixed(2)}</span></div>
            ${inv.discount_amount > 0 ? `
              <div class="total-row" style="color: #16a34a;"><span>Discount Applied (${inv.discount_code || 'Voucher'}):</span> <span class="font-mono">-₹${parseFloat(inv.discount_amount).toFixed(2)}</span></div>
              <div class="total-row" style="color: #64748b; font-size: 11px;"><span>Taxable Subtotal:</span> <span class="font-mono">₹${parseFloat(inv.taxable_amount).toFixed(2)}</span></div>
            ` : ''}
            <div class="total-row"><span>GST Tax Amount:</span> <span class="font-mono">+₹${parseFloat(inv.tax_amount).toFixed(2)}</span></div>
            <div class="total-row grand-total"><span>Grand Total:</span> <span class="font-mono">₹${parseFloat(inv.total_amount).toFixed(2)}</span></div>
            <div class="total-row" style="margin-top: 6px; font-weight: 600; color: ${inv.status === 'Paid' ? '#16a34a' : '#d97706'};">
              <span>Amount Paid:</span> <span class="font-mono">₹${parseFloat(inv.amount_paid || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div class="footer">
          Thank you for choosing Brightloop Software! For questions concerning this invoice, contact accounts@brightloop.com.<br>
          This is a computer-generated tax invoice and requires no physical signature.
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  }
};

