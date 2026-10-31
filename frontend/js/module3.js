/**
 * Brightloop Software — Module 3: Subscription & Quotation Management
 * Handles UI for Subscriptions, Lifecycle Actions, Quotations, and Reusable Templates.
 */

const Module3 = {
  activeTab: 'subscriptions',

  // ═════════════════════════════════════════════════════════════════════════════
  // 1. SUBSCRIPTIONS PAGE
  // ═════════════════════════════════════════════════════════════════════════════

  async subscriptionsPage(queryParams = {}) {
    const role = Auth.getRole();
    const statusFilter = queryParams.status || '';
    const search = queryParams.search || '';

    let endpoint = `/subscriptions?status=${encodeURIComponent(statusFilter)}&search=${encodeURIComponent(search)}`;
    const [subRes, statsRes] = await Promise.all([
      API.get(endpoint),
      role !== 'customer' ? API.get('/subscriptions/stats') : Promise.resolve(null)
    ]);

    const subscriptions = subRes.success ? (subRes.data.subscriptions || []) : [];
    const stats = statsRes && statsRes.success ? statsRes.data : null;

    const content = `
      <div class="page-container">
        <!-- Header -->
        <div class="page-header flex-between mb-4">
          <div>
            <h1 class="page-title">${role === 'customer' ? 'My Subscriptions' : 'Subscription Management'}</h1>
            <p class="page-subtitle">${role === 'customer' ? 'View and track your active subscription plans and billing' : 'Manage customer contracts, line items, and lifecycle transitions'}</p>
          </div>
          <div class="header-actions">
            ${role !== 'customer' ? `
              <button class="btn btn-primary" onclick="Module3.openCreateSubscriptionModal()">
                <span class="material-icons-round">add</span> New Subscription
              </button>
            ` : `
              <button class="btn btn-secondary" onclick="Router.navigate('/dashboard/customer/quotations')">
                <span class="material-icons-round">request_quote</span> View Quotations
              </button>
            `}
          </div>
        </div>

        ${stats ? `
          <!-- KPI Metrics (Admin/Staff) -->
          <div class="stats-grid mb-4">
            <div class="stat-card">
              <div class="stat-icon icon-blue"><span class="material-icons-round">subscriptions</span></div>
              <div class="stat-content">
                <div class="stat-value">${stats.total_subscriptions}</div>
                <div class="stat-label">Total Subscriptions</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon icon-green"><span class="material-icons-round">check_circle</span></div>
              <div class="stat-content">
                <div class="stat-value">${stats.active_subscriptions}</div>
                <div class="stat-label">Active Contracts</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon icon-amber"><span class="material-icons-round">pause_circle</span></div>
              <div class="stat-content">
                <div class="stat-value">${stats.paused_subscriptions}</div>
                <div class="stat-label">Paused</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon icon-purple"><span class="material-icons-round">payments</span></div>
              <div class="stat-content">
                <div class="stat-value">₹${stats.active_annual_value.toLocaleString('en-IN')}</div>
                <div class="stat-label">Active Total Value</div>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Filter & Search Toolbar -->
        <div class="table-toolbar flex-between mb-3">
          <div class="filter-tabs">
            <button class="filter-tab ${!statusFilter ? 'active' : ''}" onclick="Router.navigate('${role === 'customer' ? '/dashboard/customer/subscriptions' : '/dashboard/admin/subscriptions'}')">All</button>
            <button class="filter-tab ${statusFilter === 'Active' ? 'active' : ''}" onclick="Router.navigate('${role === 'customer' ? '/dashboard/customer/subscriptions' : '/dashboard/admin/subscriptions'}', { status: 'Active' })">Active</button>
            <button class="filter-tab ${statusFilter === 'Paused' ? 'active' : ''}" onclick="Router.navigate('${role === 'customer' ? '/dashboard/customer/subscriptions' : '/dashboard/admin/subscriptions'}', { status: 'Paused' })">Paused</button>
            <button class="filter-tab ${statusFilter === 'Confirmed' ? 'active' : ''}" onclick="Router.navigate('${role === 'customer' ? '/dashboard/customer/subscriptions' : '/dashboard/admin/subscriptions'}', { status: 'Confirmed' })">Confirmed</button>
            <button class="filter-tab ${statusFilter === 'Draft' ? 'active' : ''}" onclick="Router.navigate('${role === 'customer' ? '/dashboard/customer/subscriptions' : '/dashboard/admin/subscriptions'}', { status: 'Draft' })">Draft</button>
            <button class="filter-tab ${statusFilter === 'Closed' ? 'active' : ''}" onclick="Router.navigate('${role === 'customer' ? '/dashboard/customer/subscriptions' : '/dashboard/admin/subscriptions'}', { status: 'Closed' })">Closed</button>
          </div>
          <div class="search-box">
            <input type="text" id="sub-search-input" class="form-control" placeholder="Search sub # or client..." value="${search}" onkeyup="if(event.key==='Enter') Module3.filterSubscriptions()">
            <button class="btn btn-secondary btn-sm" onclick="Module3.filterSubscriptions()">Search</button>
          </div>
        </div>

        <!-- Subscriptions Table -->
        <div class="card p-0 overflow-hidden">
          <div class="table-responsive">
            <table class="table data-table mb-0">
              <thead>
                <tr>
                  <th>Subscription #</th>
                  ${role !== 'customer' ? '<th>Customer</th>' : ''}
                  <th>Selected Plan</th>
                  <th>Start Date</th>
                  <th>Expiry Date</th>
                  <th>Payment Terms</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${subscriptions.length === 0 ? `
                  <tr>
                    <td colspan="${role !== 'customer' ? 9 : 8}" class="text-center py-5 text-muted">
                      <span class="material-icons-round fs-1 d-block mb-2">auto_stories</span>
                      No subscriptions found matching the filter criteria.
                    </td>
                  </tr>
                ` : subscriptions.map(sub => `
                  <tr>
                    <td>
                      <strong class="text-primary font-mono cursor-pointer" onclick="Module3.viewSubscription(${sub.id})">${sub.subscription_number}</strong>
                      ${sub.quotation_number ? `<div class="text-xs text-muted">from ${sub.quotation_number}</div>` : ''}
                    </td>
                    ${role !== 'customer' ? `
                      <td>
                        <div class="fw-semibold">${sub.customer_name}</div>
                        <div class="text-xs text-muted">${sub.customer_email}</div>
                      </td>
                    ` : ''}
                    <td>
                      <span class="badge badge-outline-blue">${sub.plan_name}</span>
                      <div class="text-xs text-muted text-capitalize">${sub.billing_frequency} billing</div>
                    </td>
                    <td>${DateUtils.format(sub.start_date)}</td>
                    <td>${DateUtils.format(sub.expiry_date)}</td>
                    <td><span class="badge badge-subtle">${sub.payment_terms || 'Net 30'}</span></td>
                    <td class="font-mono fw-bold">₹${parseFloat(sub.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td>${Module3.renderStatusBadge(sub.status)}</td>
                    <td class="text-right">
                      <div class="btn-group">
                        <button class="btn btn-sm btn-outline" onclick="Module3.viewSubscription(${sub.id})" title="View Details">
                          <span class="material-icons-round">visibility</span>
                        </button>
                        ${role !== 'customer' ? `
                          ${sub.status === 'Active' && sub.allow_pause ? `
                            <button class="btn btn-sm btn-outline text-warning" onclick="Module3.promptPause(${sub.id})" title="Pause Subscription">
                              <span class="material-icons-round">pause</span>
                            </button>
                          ` : ''}
                          ${sub.status === 'Paused' ? `
                            <button class="btn btn-sm btn-outline text-success" onclick="Module3.resumeSubscription(${sub.id})" title="Resume Subscription">
                              <span class="material-icons-round">play_arrow</span>
                            </button>
                          ` : ''}
                          ${(sub.status === 'Active' || sub.status === 'Paused') && sub.allow_renewal ? `
                            <button class="btn btn-sm btn-outline text-info" onclick="Module3.renewSubscription(${sub.id})" title="Renew Subscription">
                              <span class="material-icons-round">autorenew</span>
                            </button>
                          ` : ''}
                          ${sub.status !== 'Closed' ? `
                            <button class="btn btn-sm btn-outline text-danger" onclick="Module3.promptClose(${sub.id})" title="Close Subscription">
                              <span class="material-icons-round">cancel</span>
                            </button>
                          ` : ''}
                          <button class="btn btn-sm btn-outline text-purple" onclick="Module3.viewInvoicePayload(${sub.id})" title="View Module 4 Invoice Payload">
                            <span class="material-icons-round">receipt</span>
                          </button>
                        ` : ''}
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

    return Dashboards.layout('subscriptions', content);
  },

  renderStatusBadge(status) {
    const map = {
      'Active': 'badge-success',
      'Paused': 'badge-warning',
      'Confirmed': 'badge-primary',
      'Draft': 'badge-secondary',
      'Closed': 'badge-danger',
      'Quotation': 'badge-info'
    };
    return `<span class="badge ${map[status] || 'badge-secondary'}">${status}</span>`;
  },

  filterSubscriptions() {
    const search = document.getElementById('sub-search-input')?.value.trim();
    const role = Auth.getRole();
    Router.navigate(role === 'customer' ? '/dashboard/customer/subscriptions' : '/dashboard/admin/subscriptions', { search });
  },

  // ═════════════════════════════════════════════════════════════════════════════
  // 2. SUBSCRIPTION DETAIL MODAL & AUDIT HISTORY
  // ═════════════════════════════════════════════════════════════════════════════

  async viewSubscription(id) {
    Loading.show();
    const res = await API.get(`/subscriptions/${id}`);
    Loading.hide();

    if (!res.success || !res.data.subscription) {
      Toast.error('Error', res.message || 'Failed to load subscription details.');
      return;
    }

    const sub = res.data.subscription;
    const role = Auth.getRole();

    const bodyHtml = `
      <div class="sub-detail-wrapper">
        <!-- Status & Header Banner -->
        <div class="detail-header-card p-3 mb-3 bg-light rounded flex-between">
          <div>
            <div class="text-xs text-muted text-uppercase tracking-wider">Subscription Number</div>
            <div class="fs-4 fw-bold font-mono text-primary">${sub.subscription_number}</div>
            <div class="text-xs text-muted">Created: ${DateUtils.formatFull(sub.created_at)}</div>
          </div>
          <div class="text-right">
            ${this.renderStatusBadge(sub.status)}
            <div class="mt-1 font-mono fs-5 fw-bold">₹${parseFloat(sub.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <!-- Info Grid -->
        <div class="grid grid-2 gap-3 mb-3">
          <div class="card p-3 mb-0">
            <h4 class="card-subtitle text-muted mb-2">Customer Information</h4>
            <div class="fw-bold">${sub.customer_name}</div>
            <div class="text-sm text-muted">${sub.customer_email}</div>
            <div class="text-xs text-muted mt-1">ID: ${sub.customer_id} | UUID: ${sub.customer_uuid || '—'}</div>
          </div>
          <div class="card p-3 mb-0">
            <h4 class="card-subtitle text-muted mb-2">Plan & Billing Terms</h4>
            <div class="fw-bold">${sub.plan_name} (${sub.billing_frequency})</div>
            <div class="text-sm">Period: <strong>${DateUtils.format(sub.start_date)}</strong> to <strong>${DateUtils.format(sub.expiry_date)}</strong></div>
            <div class="text-xs text-muted mt-1">Payment Terms: <strong>${sub.payment_terms || 'Net 30'}</strong></div>
          </div>
        </div>

        ${sub.closure_reason ? `
          <div class="alert alert-danger mb-3 p-2 text-sm">
            <strong>Closed:</strong> ${sub.closure_reason} (${DateUtils.formatFull(sub.closed_at)})
          </div>
        ` : ''}

        <!-- Subscription Line Items -->
        <div class="card p-0 mb-3 overflow-hidden">
          <div class="p-2 px-3 bg-light border-bottom fw-bold text-sm">Subscription Line Items</div>
          <table class="table mb-0 text-sm">
            <thead>
              <tr>
                <th>Product & Variant</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Tax</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${(sub.lines || []).map(l => `
                <tr>
                  <td>
                    <strong>${l.product_name}</strong>
                    ${l.variant_name ? `<div class="text-xs text-primary">+ ${l.variant_name} (+₹${l.variant_additional_price})</div>` : ''}
                  </td>
                  <td>${l.quantity}</td>
                  <td>₹${parseFloat(l.unit_price).toFixed(2)}</td>
                  <td>${l.tax_code ? `${l.tax_code} (${l.tax_rate}%) = ₹${parseFloat(l.tax_amount).toFixed(2)}` : '0%'}</td>
                  <td class="text-right fw-bold font-mono">₹${parseFloat(l.line_total).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Pricing Breakdown Summary -->
        <div class="pricing-summary-box p-3 bg-light rounded mb-3 text-sm">
          <div class="flex-between mb-1">
            <span>Gross Subtotal:</span>
            <span class="font-mono">₹${parseFloat(sub.subtotal).toFixed(2)}</span>
          </div>
          ${sub.discount_amount > 0 ? `
            <div class="flex-between mb-1 text-success">
              <span>Discount (${sub.discount_code || 'Voucher'}):</span>
              <span class="font-mono">-₹${parseFloat(sub.discount_amount).toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="flex-between mb-1">
            <span>Total Taxes:</span>
            <span class="font-mono">+₹${parseFloat(sub.tax_amount).toFixed(2)}</span>
          </div>
          <div class="flex-between pt-2 border-top fw-bold fs-6">
            <span>Grand Total:</span>
            <span class="font-mono text-primary">₹${parseFloat(sub.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <!-- Lifecycle Actions Toolbar (Admin/Staff) -->
        ${role !== 'customer' ? `
          <div class="lifecycle-actions flex-between mb-3 p-2 bg-white border rounded">
            <div class="text-xs fw-bold text-muted text-uppercase">Lifecycle Actions:</div>
            <div class="btn-group">
              ${sub.status === 'Active' && sub.allow_pause ? `
                <button class="btn btn-sm btn-warning" onclick="Module3.promptPause(${sub.id}); Modal.close();">
                  <span class="material-icons-round">pause</span> Pause
                </button>
              ` : ''}
              ${sub.status === 'Paused' ? `
                <button class="btn btn-sm btn-success" onclick="Module3.resumeSubscription(${sub.id}); Modal.close();">
                  <span class="material-icons-round">play_arrow</span> Resume
                </button>
              ` : ''}
              ${(sub.status === 'Active' || sub.status === 'Paused') && sub.allow_renewal ? `
                <button class="btn btn-sm btn-info" onclick="Module3.renewSubscription(${sub.id}); Modal.close();">
                  <span class="material-icons-round">autorenew</span> Renew
                </button>
              ` : ''}
              ${sub.status !== 'Closed' ? `
                <button class="btn btn-sm btn-danger" onclick="Module3.promptClose(${sub.id}); Modal.close();">
                  <span class="material-icons-round">cancel</span> Close
                </button>
              ` : ''}
              <button class="btn btn-sm btn-secondary" onclick="Module3.viewInvoicePayload(${sub.id})">
                <span class="material-icons-round">receipt</span> Module 4 Invoice Payload
              </button>
            </div>
          </div>
        ` : ''}

        <!-- Subscription Audit History -->
        <div class="history-section">
          <h4 class="text-sm font-semibold mb-2 flex-between">
            <span>Subscription History & Audit Log</span>
            <span class="badge badge-secondary">${(sub.history || []).length} events</span>
          </h4>
          <div class="history-timeline">
            ${(sub.history || []).length === 0 ? '<div class="text-xs text-muted">No history recorded yet.</div>' : (sub.history || []).map(h => `
              <div class="timeline-item pb-2 mb-2 border-bottom text-xs">
                <div class="flex-between">
                  <strong>${h.action}</strong>
                  <span class="text-muted">${DateUtils.formatFull(h.created_at)}</span>
                </div>
                ${h.from_status || h.to_status ? `
                  <div class="text-muted my-1">
                    Transition: <span class="badge badge-sm badge-outline">${h.from_status || 'Start'}</span> &rarr; <span class="badge badge-sm badge-outline">${h.to_status}</span>
                  </div>
                ` : ''}
                ${h.notes ? `<div class="text-dark">${h.notes}</div>` : ''}
                ${h.changed_by_name ? `<div class="text-muted">By: ${h.changed_by_name}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    Modal.open({
      title: `Subscription Details: ${sub.subscription_number}`,
      body: bodyHtml,
      width: '760px',
      buttons: [
        { label: 'Close', class: 'btn-secondary', onclick: 'Modal.close()' }
      ]
    });
  },

  // ═════════════════════════════════════════════════════════════════════════════
  // 3. CREATE SUBSCRIPTION MODAL (Admin/Staff)
  // ═════════════════════════════════════════════════════════════════════════════

  async openCreateSubscriptionModal() {
    Loading.show();
    const [usersRes, prodRes, planRes] = await Promise.all([
      API.get('/users?limit=100'),
      API.get('/products'),
      API.get('/plans')
    ]);
    Loading.hide();

    const customers = (usersRes.success ? usersRes.data.users : []).filter(u => u.role === 'customer');
    const products = prodRes.success ? prodRes.data.products : [];
    const plans = planRes.success ? planRes.data.plans.filter(p => p.status === 'active') : [];

    const bodyHtml = `
      <form id="create-sub-form" onsubmit="event.preventDefault(); Module3.submitCreateSubscription();">
        <div class="grid grid-2 gap-3 mb-3">
          <div class="form-group mb-0">
            <label class="form-label" for="sub-customer-id">Customer <span class="text-danger">*</span></label>
            <select id="sub-customer-id" class="form-control" required>
              <option value="">Select customer...</option>
              ${customers.map(c => `<option value="${c.id || c.uuid}">${c.name} (${c.email})</option>`).join('')}
            </select>
          </div>
          <div class="form-group mb-0">
            <label class="form-label" for="sub-plan-id">Subscription Plan <span class="text-danger">*</span></label>
            <select id="sub-plan-id" class="form-control" required onchange="Module3.onPlanChange()">
              <option value="">Select plan...</option>
              ${plans.map(p => `<option value="${p.id}" data-freq="${p.billing_frequency}" data-min="${p.min_quantity}">${p.name} (${p.billing_frequency}) - Min: ${p.min_quantity}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="grid grid-3 gap-3 mb-3">
          <div class="form-group mb-0">
            <label class="form-label" for="sub-start-date">Start Date</label>
            <input type="date" id="sub-start-date" class="form-control" value="${new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group mb-0">
            <label class="form-label" for="sub-payment-terms">Payment Terms</label>
            <select id="sub-payment-terms" class="form-control">
              <option value="Net 30">Net 30 Days</option>
              <option value="Net 15">Net 15 Days</option>
              <option value="Net 60">Net 60 Days</option>
              <option value="Immediate">Immediate / Due Upon Receipt</option>
            </select>
          </div>
          <div class="form-group mb-0">
            <label class="form-label" for="sub-discount-code">Discount Coupon</label>
            <input type="text" id="sub-discount-code" class="form-control text-uppercase" placeholder="e.g. BRIGHT20" onchange="Module3.refreshSubPricePreview()">
          </div>
        </div>

        <!-- Product Line Items Builder Card -->
        <div class="sub-lines-card">
          <div class="sub-lines-card-header">
            <div>
              <strong style="font-size: 13.5px; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                <span class="material-icons-round" style="font-size: 18px; color: var(--primary-600);">inventory_2</span>
                Subscription Line Items
              </strong>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Select products, brand/edition variants, and quantities</div>
            </div>
            <button type="button" class="btn btn-sm btn-outline" onclick="Module3.addSubLineRow()">
              <span class="material-icons-round" style="font-size: 16px;">add</span> Add Line Item
            </button>
          </div>
          <div class="sub-line-col-headers">
            <div>Product</div>
            <div>Variant / Surcharge</div>
            <div style="text-align: center;">Qty</div>
            <div></div>
          </div>
          <div id="sub-lines-container">
            <!-- Dynamic rows will appear here -->
          </div>
        </div>

        <!-- Live Price Preview Card -->
        <div id="sub-price-preview" class="pricing-summary-card">
          <div style="color: var(--text-muted); text-align: center; font-size: 13px;">
            Select a plan and product lines to compute the live billing breakdown.
          </div>
        </div>

        <div class="form-group mb-0">
          <label class="form-label" for="sub-notes">Internal Notes / Contract Remarks</label>
          <textarea id="sub-notes" class="form-control" rows="2" placeholder="Optional notes..."></textarea>
        </div>
      </form>
    `;

    Modal.open({
      title: 'Create New Subscription',
      body: bodyHtml,
      width: '800px',
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onclick: 'Modal.close()' },
        { label: 'Create & Activate', class: 'btn-primary', onclick: 'Module3.submitCreateSubscription()' }
      ]
    });

    // Cache products & plans for dynamic rows
    window._cachedProducts = products;
    window._cachedPlans = plans;

    // Add initial line item
    this.addSubLineRow();
  },

  addSubLineRow() {
    const container = document.getElementById('sub-lines-container');
    if (!container) return;

    const products = window._cachedProducts || [];
    const rowIndex = container.children.length;

    const row = document.createElement('div');
    row.className = 'sub-line-row';
    row.id = `sub-line-row-${rowIndex}`;
    row.innerHTML = `
      <div>
        <select class="form-control form-control-sm line-prod-select" onchange="Module3.onProductChange(this, ${rowIndex})" required>
          <option value="">Select product...</option>
          ${products.map(p => `<option value="${p.id}" data-price="${p.sales_price}">${p.name} (₹${p.sales_price})</option>`).join('')}
        </select>
      </div>
      <div>
        <select class="form-control form-control-sm line-var-select" onchange="Module3.refreshSubPricePreview()">
          <option value="">Standard Edition (+₹0)</option>
        </select>
      </div>
      <div>
        <input type="number" class="form-control form-control-sm line-qty-input" value="1" min="1" placeholder="Qty" onchange="Module3.refreshSubPricePreview()" onkeyup="Module3.refreshSubPricePreview()" style="text-align: center;">
      </div>
      <div>
        <button type="button" class="sub-line-delete-btn" onclick="this.closest('.sub-line-row').remove(); Module3.refreshSubPricePreview();" title="Remove line">
          <span class="material-icons-round" style="font-size: 18px;">delete</span>
        </button>
      </div>
    `;
    container.appendChild(row);
  },

  onProductChange(selectEl, rowIndex) {
    const prodId = Number(selectEl.value);
    const row = selectEl.closest('.sub-line-row');
    const varSelect = row.querySelector('.line-var-select');
    varSelect.innerHTML = '<option value="">Standard Edition (+₹0)</option>';

    if (!prodId) {
      this.refreshSubPricePreview();
      return;
    }

    const prod = (window._cachedProducts || []).find(p => p.id === prodId);
    if (prod && Array.isArray(prod.variants) && prod.variants.length > 0) {
      prod.variants.forEach(v => {
        varSelect.innerHTML += `<option value="${v.id}">${v.variant_name} (+₹${v.additional_price})</option>`;
      });
    }

    this.refreshSubPricePreview();
  },

  onPlanChange() {
    const planSelect = document.getElementById('sub-plan-id');
    const selectedOpt = planSelect?.options[planSelect.selectedIndex];
    const minQty = parseInt(selectedOpt?.dataset.min || '1', 10);
    const qtyInput = document.querySelector('.line-qty-input');
    if (qtyInput && parseInt(qtyInput.value, 10) < minQty) {
      qtyInput.value = minQty;
      qtyInput.min = minQty;
    }
    this.refreshSubPricePreview();
  },

  async refreshSubPricePreview() {
    const planId = document.getElementById('sub-plan-id')?.value;
    const discountCode = document.getElementById('sub-discount-code')?.value.trim();
    const rows = document.querySelectorAll('.sub-line-row');
    const previewEl = document.getElementById('sub-price-preview');
    if (!previewEl) return;

    if (!planId || rows.length === 0) {
      previewEl.innerHTML = '<div style="color: var(--text-muted); text-align: center; font-size: 13px;">Select a plan and product lines to preview calculation.</div>';
      return;
    }

    const lines = [];
    rows.forEach(r => {
      const pId = r.querySelector('.line-prod-select')?.value;
      const vId = r.querySelector('.line-var-select')?.value;
      const qty = parseInt(r.querySelector('.line-qty-input')?.value, 10) || 1;
      if (pId) {
        lines.push({ product_id: Number(pId), variant_id: vId ? Number(vId) : null, quantity: qty });
      }
    });

    if (lines.length === 0) {
      previewEl.innerHTML = '<div style="color: var(--text-muted); text-align: center; font-size: 13px;">Add at least one product line.</div>';
      return;
    }

    // Call pricing API preview
    const res = await API.post('/pricing/calculate', {
      product_id: lines[0].product_id,
      variant_id: lines[0].variant_id,
      plan_id: Number(planId),
      quantity: lines[0].quantity,
      discount_code: discountCode || null
    });

    const breakdown = res.data?.pricing_breakdown || res.data?.calculation?.pricing_breakdown || res.calculation?.pricing_breakdown;
    if (res.success && breakdown) {
      const b = breakdown;
      previewEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
          <div class="flex-between" style="color: var(--text-secondary);">
            <span>Gross Subtotal:</span>
            <span class="font-mono fw-bold" style="color: var(--text-primary);">₹${parseFloat(b.gross_subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          ${b.discount_amount > 0 ? `
            <div class="flex-between" style="color: var(--success-600);">
              <span>Discount Applied (${b.discount_details ? b.discount_details.code : discountCode}):</span>
              <span class="font-mono fw-bold">-₹${parseFloat(b.discount_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          ` : ''}
          <div class="flex-between" style="color: var(--text-secondary);">
            <span>Estimated Taxes (${b.tax_details ? b.tax_details.name : 'GST'}):</span>
            <span class="font-mono" style="color: var(--text-secondary);">+₹${parseFloat(b.tax_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div class="flex-between" style="font-size: 15px; font-weight: 700; color: var(--primary-700); padding-top: 10px; border-top: 1.5px dashed var(--gray-300); margin-top: 4px;">
            <span>Payable Total:</span>
            <span class="font-mono" style="font-size: 17px;">₹${parseFloat(b.final_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      `;
    } else {
      previewEl.innerHTML = `<div style="color: var(--danger-600); font-size: 13px;">⚠️ ${res.message || 'Pricing error'}</div>`;
    }
  },

  async submitCreateSubscription() {
    const customerSelect = document.getElementById('sub-customer-id');
    const planSelect = document.getElementById('sub-plan-id');
    const startDate = document.getElementById('sub-start-date')?.value;
    const paymentTerms = document.getElementById('sub-payment-terms')?.value;
    const discountCode = document.getElementById('sub-discount-code')?.value.trim();
    const notes = document.getElementById('sub-notes')?.value.trim();

    if (!customerSelect?.value) {
      Toast.error('Validation', 'Please select a customer.');
      return;
    }
    if (!planSelect?.value) {
      Toast.error('Validation', 'Please select a subscription plan.');
      return;
    }

    const rows = document.querySelectorAll('.sub-line-row');
    const lines = [];
    rows.forEach(r => {
      const pId = r.querySelector('.line-prod-select')?.value;
      const vId = r.querySelector('.line-var-select')?.value;
      const qty = parseInt(r.querySelector('.line-qty-input')?.value, 10) || 1;
      if (pId) {
        lines.push({ product_id: Number(pId), variant_id: vId ? Number(vId) : null, quantity: qty });
      }
    });

    if (lines.length === 0) {
      Toast.error('Validation', 'Please add at least one product line.');
      return;
    }

    // Resolve customer numeric ID from UUID or ID
    Loading.show();
    let customerId = customerSelect.value;
    if (isNaN(Number(customerId))) {
      const userRes = await API.get(`/users/${customerSelect.value}`);
      if (userRes.success && userRes.data.user) {
        customerId = userRes.data.user.id;
      }
    } else {
      customerId = Number(customerId);
    }

    const payload = {
      customer_id: customerId,
      plan_id: Number(planSelect.value),
      status: 'Active',
      start_date: startDate,
      payment_terms: paymentTerms,
      lines,
      discount_code: discountCode || null,
      notes
    };

    const res = await API.post('/subscriptions', payload);
    Loading.hide();

    if (res.success) {
      Toast.success('Created', res.message || 'Subscription created successfully.');
      Modal.close();
      Router.resolve();
    } else {
      Toast.error('Failed', res.message || 'Could not create subscription.');
    }
    return res;
  },

  // ═════════════════════════════════════════════════════════════════════════════
  // 4. LIFECYCLE ACTIONS (Pause, Resume, Renew, Close)
  // ═════════════════════════════════════════════════════════════════════════════

  promptPause(id) {
    Modal.open({
      title: 'Pause Subscription',
      body: `
        <p>Temporarily pause this subscription. Customers will not be charged while the subscription is paused.</p>
        <div class="form-group mb-0">
          <label class="form-label">Pause Reason <span class="text-danger">*</span></label>
          <input type="text" id="pause-reason-input" class="form-control" placeholder="e.g. Server maintenance, customer seasonal pause">
        </div>
      `,
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onclick: 'Modal.close()' },
        { label: 'Pause Subscription', class: 'btn-warning', onclick: `Module3.executePause(${id})` }
      ]
    });
  },

  async executePause(id) {
    const reason = document.getElementById('pause-reason-input')?.value.trim() || 'Temporary pause';
    Loading.show();
    const res = await API.post(`/subscriptions/${id}/pause`, { reason });
    Loading.hide();

    if (res.success) {
      Toast.success('Paused', res.message);
      Modal.close();
      Router.resolve();
    } else {
      Toast.error('Error', res.message);
    }
  },

  async resumeSubscription(id) {
    if (!confirm('Are you sure you want to resume this subscription? It will return to Active status.')) return;

    Loading.show();
    const res = await API.post(`/subscriptions/${id}/resume`, {});
    Loading.hide();

    if (res.success) {
      Toast.success('Resumed', res.message);
      Router.resolve();
    } else {
      Toast.error('Error', res.message);
    }
  },

  async renewSubscription(id) {
    if (!confirm('Renew this subscription? Its term will be extended by one billing cycle.')) return;

    Loading.show();
    const res = await API.post(`/subscriptions/${id}/renew`, {});
    Loading.hide();

    if (res.success) {
      Toast.success('Renewed', res.message);
      Router.resolve();
    } else {
      Toast.error('Error', res.message);
    }
  },

  promptClose(id) {
    Modal.open({
      title: 'Close Subscription',
      body: `
        <p class="text-danger fw-semibold">Are you sure you want to close this subscription? This will terminate active services.</p>
        <div class="form-group mb-0">
          <label class="form-label">Closure Reason <span class="text-danger">*</span></label>
          <input type="text" id="close-reason-input" class="form-control" placeholder="e.g. Contract completed, customer requested early termination">
        </div>
      `,
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onclick: 'Modal.close()' },
        { label: 'Confirm Closure', class: 'btn-danger', onclick: `Module3.executeClose(${id})` }
      ]
    });
  },

  async executeClose(id) {
    const reason = document.getElementById('close-reason-input')?.value.trim() || 'Subscription closed by staff';
    Loading.show();
    const res = await API.post(`/subscriptions/${id}/close`, { reason });
    Loading.hide();

    if (res.success) {
      Toast.success('Closed', res.message);
      Modal.close();
      Router.resolve();
    } else {
      Toast.error('Error', res.message);
    }
  },

  // ═════════════════════════════════════════════════════════════════════════════
  // 5. MODULE 4 INVOICE PAYLOAD PREVIEW
  // ═════════════════════════════════════════════════════════════════════════════

  async viewInvoicePayload(id) {
    Loading.show();
    const res = await API.get(`/subscriptions/${id}/invoice-payload`);
    Loading.hide();

    if (!res.success || !res.data.invoice_payload) {
      Toast.error('Error', res.message || 'Failed to generate invoice payload.');
      return;
    }

    const payload = res.data.invoice_payload;
    const jsonStr = JSON.stringify(payload, null, 2);

    const bodyHtml = `
      <div class="invoice-payload-view">
        <div class="alert alert-info p-2 mb-3 text-xs">
          <strong>Integration Ready:</strong> This standardized payload is consumed by <em>Module 4: Automated Invoicing & Billing</em> for automatic recurring invoice creation, tax allocation, and ledger sync.
        </div>
        <div class="position-relative">
          <pre class="bg-dark text-light p-3 rounded text-xs font-mono mb-0" style="max-height: 400px; overflow-y: auto;">${jsonStr}</pre>
        </div>
      </div>
    `;

    Modal.open({
      title: `Module 4 Invoice Payload: ${payload.subscription_number}`,
      body: bodyHtml,
      width: '720px',
      buttons: [
        { label: 'Copy JSON', class: 'btn-outline', onclick: `navigator.clipboard.writeText(\`${jsonStr.replace(/`/g, '\\`')}\`); Toast.success('Copied', 'Payload copied to clipboard!');` },
        { label: 'Close', class: 'btn-secondary', onclick: 'Modal.close()' }
      ]
    });
  },

  // ═════════════════════════════════════════════════════════════════════════════
  // 6. QUOTATIONS & TEMPLATES PAGE
  // ═════════════════════════════════════════════════════════════════════════════

  async quotationsPage(queryParams = {}) {
    const role = Auth.getRole();
    const activeTab = queryParams.tab || 'quotes';
    const statusFilter = queryParams.status || '';

    const [quotesRes, templatesRes] = await Promise.all([
      API.get(`/quotations?status=${encodeURIComponent(statusFilter)}`),
      API.get('/quotations/templates')
    ]);

    const quotations = quotesRes.success ? (quotesRes.data.quotations || []) : [];
    const templates = templatesRes.success ? (templatesRes.data.templates || []) : [];

    const content = `
      <div class="page-container">
        <!-- Header -->
        <div class="page-header flex-between mb-4">
          <div>
            <h1 class="page-title">${role === 'customer' ? 'My Quotations' : 'Quotation & Template Management'}</h1>
            <p class="page-subtitle">Generate reusable templates, quote customer packages, and convert accepted quotes into subscriptions</p>
          </div>
          <div class="header-actions">
            ${role !== 'customer' ? `
              <button class="btn btn-secondary mr-2" onclick="Module3.openCreateTemplateModal()">
                <span class="material-icons-round">bookmark_add</span> New Template
              </button>
              <button class="btn btn-primary" onclick="Module3.openCreateQuotationModal()">
                <span class="material-icons-round">add</span> Create Quotation
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Tabs Navigation -->
        <div class="tabs-nav mb-3 d-flex border-bottom">
          <button class="tab-btn p-2 px-3 fw-bold ${activeTab === 'quotes' ? 'active border-bottom border-primary text-primary' : 'text-muted'}" onclick="Router.navigate('${role === 'customer' ? '/dashboard/customer/quotations' : '/dashboard/admin/quotations'}', { tab: 'quotes' })">
            <span class="material-icons-round fs-6 align-middle">request_quote</span> Quotations (${quotations.length})
          </button>
          ${role !== 'customer' ? `
            <button class="tab-btn p-2 px-3 fw-bold ${activeTab === 'templates' ? 'active border-bottom border-primary text-primary' : 'text-muted'}" onclick="Router.navigate('/dashboard/admin/quotations', { tab: 'templates' })">
              <span class="material-icons-round fs-6 align-middle">auto_awesome_motion</span> Reusable Templates (${templates.length})
            </button>
          ` : ''}
        </div>

        ${activeTab === 'quotes' ? `
          <!-- Quotations List Tab -->
          <div class="card p-0 overflow-hidden">
            <div class="table-responsive">
              <table class="table data-table mb-0">
                <thead>
                  <tr>
                    <th>Quotation #</th>
                    ${role !== 'customer' ? '<th>Customer</th>' : ''}
                    <th>Plan</th>
                    <th>Issue Date</th>
                    <th>Valid Until</th>
                    <th>Items</th>
                    <th>Total Amount</th>
                    <th>Status</th>
                    <th class="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${quotations.length === 0 ? `
                    <tr>
                      <td colspan="${role !== 'customer' ? 9 : 8}" class="text-center py-5 text-muted">
                        <span class="material-icons-round fs-1 d-block mb-2">request_quote</span>
                        No quotations found.
                      </td>
                    </tr>
                  ` : quotations.map(q => `
                    <tr>
                      <td><strong class="text-primary font-mono cursor-pointer" onclick="Module3.viewQuotation(${q.id})">${q.quotation_number}</strong></td>
                      ${role !== 'customer' ? `
                        <td>
                          <div class="fw-semibold">${q.customer_name}</div>
                          <div class="text-xs text-muted">${q.customer_email}</div>
                        </td>
                      ` : ''}
                      <td><span class="badge badge-outline-blue">${q.plan_name}</span></td>
                      <td>${DateUtils.format(q.issue_date)}</td>
                      <td>${DateUtils.format(q.valid_until)}</td>
                      <td>${q.lines_count || 1} item(s)</td>
                      <td class="font-mono fw-bold">₹${parseFloat(q.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td>${Module3.renderQuoteStatusBadge(q.status)}</td>
                      <td class="text-right">
                        <div class="btn-group">
                          <button class="btn btn-sm btn-outline" onclick="Module3.viewQuotation(${q.id})" title="View Details">
                            <span class="material-icons-round">visibility</span>
                          </button>
                          ${role !== 'customer' && (q.status === 'Draft' || q.status === 'Sent' || q.status === 'Accepted') ? `
                            <button class="btn btn-sm btn-outline text-success" onclick="Module3.convertQuotation(${q.id})" title="Convert to Subscription">
                              <span class="material-icons-round">upgrade</span>
                            </button>
                          ` : ''}
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : `
          <!-- Templates List Tab -->
          <div class="grid grid-3 gap-3">
            ${templates.length === 0 ? `
              <div class="card p-5 text-center text-muted col-span-3">
                <span class="material-icons-round fs-1 d-block mb-2">auto_awesome_motion</span>
                No quotation templates created yet. Click "New Template" to start.
              </div>
            ` : templates.map(t => `
              <div class="card p-3 d-flex flex-column justify-content-between">
                <div>
                  <div class="flex-between mb-2">
                    <span class="badge badge-primary">${t.plan_name || 'Standard Plan'}</span>
                    <span class="text-xs text-muted">${t.default_validity_days} days validity</span>
                  </div>
                  <h3 class="fs-5 fw-bold mb-1">${t.name}</h3>
                  <p class="text-xs text-muted mb-3">${t.description || 'Predefined subscription line template'}</p>

                  <div class="template-lines-preview bg-light p-2 rounded mb-3 text-xs">
                    <div class="fw-bold mb-1 text-muted text-uppercase tracking-wider">Bundled Lines (${(t.lines || []).length}):</div>
                    ${(t.lines || []).map(l => `
                      <div class="flex-between py-1 border-bottom-dashed">
                        <span>${l.quantity}x ${l.product_name}</span>
                        <span class="font-mono text-muted">${l.variant_name ? `(${l.variant_name})` : ''}</span>
                      </div>
                    `).join('')}
                  </div>
                </div>

                <div class="pt-2 border-top flex-between">
                  <span class="text-xs text-muted">Terms: ${t.payment_terms}</span>
                  <button class="btn btn-sm btn-primary" onclick="Module3.openCreateQuotationFromTemplate(${t.id})">
                    <span class="material-icons-round">play_arrow</span> Use Template
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    return Dashboards.layout('quotations', content);
  },

  renderQuoteStatusBadge(status) {
    const map = {
      'Draft': 'badge-secondary',
      'Sent': 'badge-info',
      'Accepted': 'badge-success',
      'Rejected': 'badge-danger',
      'Expired': 'badge-warning',
      'Converted': 'badge-primary'
    };
    return `<span class="badge ${map[status] || 'badge-secondary'}">${status}</span>`;
  },

  // ═════════════════════════════════════════════════════════════════════════════
  // 7. QUOTATION DETAILS & CONVERT ACTION
  // ═════════════════════════════════════════════════════════════════════════════

  async viewQuotation(id) {
    Loading.show();
    const res = await API.get(`/quotations/${id}`);
    Loading.hide();

    if (!res.success || !res.data.quotation) {
      Toast.error('Error', res.message || 'Failed to load quotation.');
      return;
    }

    const q = res.data.quotation;
    const role = Auth.getRole();

    const bodyHtml = `
      <div class="quote-detail-wrapper">
        <div class="detail-header-card p-3 mb-3 bg-light rounded flex-between">
          <div>
            <div class="text-xs text-muted text-uppercase tracking-wider">Quotation Number</div>
            <div class="fs-4 fw-bold font-mono text-primary">${q.quotation_number}</div>
            <div class="text-xs text-muted">Issued: ${DateUtils.format(q.issue_date)} | Valid until: ${DateUtils.format(q.valid_until)}</div>
          </div>
          <div class="text-right">
            ${this.renderQuoteStatusBadge(q.status)}
            <div class="mt-1 font-mono fs-5 fw-bold">₹${parseFloat(q.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div class="grid grid-2 gap-3 mb-3">
          <div class="card p-3 mb-0">
            <h4 class="card-subtitle text-muted mb-2">Customer</h4>
            <div class="fw-bold">${q.customer_name}</div>
            <div class="text-sm text-muted">${q.customer_email}</div>
          </div>
          <div class="card p-3 mb-0">
            <h4 class="card-subtitle text-muted mb-2">Selected Plan & Terms</h4>
            <div class="fw-bold">${q.plan_name} (${q.billing_frequency})</div>
            <div class="text-sm text-muted">Payment Terms: <strong>${q.payment_terms || 'Net 30'}</strong></div>
          </div>
        </div>

        <!-- Lines -->
        <div class="card p-0 mb-3 overflow-hidden">
          <table class="table mb-0 text-sm">
            <thead>
              <tr>
                <th>Product & Variant</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Tax</th>
                <th class="text-right">Line Total</th>
              </tr>
            </thead>
            <tbody>
              ${(q.lines || []).map(l => `
                <tr>
                  <td>
                    <strong>${l.product_name}</strong>
                    ${l.variant_name ? `<div class="text-xs text-primary">+ ${l.variant_name}</div>` : ''}
                  </td>
                  <td>${l.quantity}</td>
                  <td>₹${parseFloat(l.unit_price).toFixed(2)}</td>
                  <td>${l.tax_code ? `${l.tax_code} (${l.tax_rate}%)` : '0%'}</td>
                  <td class="text-right fw-bold font-mono">₹${parseFloat(l.line_total).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Pricing Summary -->
        <div class="p-3 bg-light rounded text-sm mb-3">
          <div class="flex-between mb-1">
            <span>Subtotal:</span>
            <span class="font-mono">₹${parseFloat(q.subtotal).toFixed(2)}</span>
          </div>
          ${q.discount_amount > 0 ? `
            <div class="flex-between mb-1 text-success">
              <span>Discount (${q.discount_code}):</span>
              <span class="font-mono">-₹${parseFloat(q.discount_amount).toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="flex-between mb-1">
            <span>Taxes:</span>
            <span class="font-mono">+₹${parseFloat(q.tax_amount).toFixed(2)}</span>
          </div>
          <div class="flex-between pt-2 border-top fw-bold fs-6">
            <span>Total Amount:</span>
            <span class="font-mono text-primary">₹${parseFloat(q.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        ${q.status === 'Converted' ? `
          <div class="alert alert-success p-2 text-sm">
            Converted into Subscription: <strong>${q.converted_subscription_number || 'SUB-Active'}</strong>
          </div>
        ` : ''}
      </div>
    `;

    const buttons = [
      { label: 'Close', class: 'btn-secondary', onclick: 'Modal.close()' }
    ];

    if (role !== 'customer' && q.status !== 'Converted') {
      buttons.unshift({
        label: 'Convert to Subscription',
        class: 'btn-success',
        onclick: `Module3.convertQuotation(${q.id}); Modal.close();`
      });
    }

    Modal.open({
      title: `Quotation: ${q.quotation_number}`,
      body: bodyHtml,
      width: '760px',
      buttons
    });
  },

  async convertQuotation(id) {
    if (!confirm('Convert this quotation into an Active subscription? Subscription lines, discounts and pricing will be locked and provisioned.')) return;

    Loading.show();
    const res = await API.post(`/quotations/${id}/convert`, { initial_status: 'Active' });
    Loading.hide();

    if (res.success) {
      Toast.success('Converted', res.message);
      Router.resolve();
    } else {
      Toast.error('Error', res.message);
    }
  },

  // ═════════════════════════════════════════════════════════════════════════════
  // 8. CREATE QUOTATION & REUSABLE TEMPLATES MODALS
  // ═════════════════════════════════════════════════════════════════════════════

  async openCreateQuotationModal(preselectedTemplateId = null) {
    Loading.show();
    const [usersRes, prodRes, planRes, templatesRes] = await Promise.all([
      API.get('/users?limit=100'),
      API.get('/products'),
      API.get('/plans'),
      API.get('/quotations/templates')
    ]);
    Loading.hide();

    const customers = (usersRes.success ? usersRes.data.users : []).filter(u => u.role === 'customer');
    const products = prodRes.success ? prodRes.data.products : [];
    const plans = planRes.success ? planRes.data.plans.filter(p => p.status === 'active') : [];
    const templates = templatesRes.success ? templatesRes.data.templates : [];

    window._cachedProducts = products;

    const bodyHtml = `
      <form id="create-quote-form" onsubmit="event.preventDefault(); Module3.submitCreateQuotation();">
        <div class="grid grid-2 gap-3 mb-3">
          <div class="form-group mb-0">
            <label class="form-label" for="quote-template-id">Quotation Template (Optional)</label>
            <select id="quote-template-id" class="form-control" onchange="Module3.onTemplateSelect(this)">
              <option value="">Start from scratch...</option>
              ${templates.map(t => `<option value="${t.id}" ${preselectedTemplateId === t.id ? 'selected' : ''}>${t.name} (${t.plan_name})</option>`).join('')}
            </select>
          </div>
          <div class="form-group mb-0">
            <label class="form-label" for="quote-customer-id">Customer <span class="text-danger">*</span></label>
            <select id="quote-customer-id" class="form-control" required>
              <option value="">Select customer...</option>
              ${customers.map(c => `<option value="${c.id || c.uuid}">${c.name} (${c.email})</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="grid grid-3 gap-3 mb-3">
          <div class="form-group mb-0">
            <label class="form-label" for="quote-plan-id">Subscription Plan <span class="text-danger">*</span></label>
            <select id="quote-plan-id" class="form-control" required>
              <option value="">Select plan...</option>
              ${plans.map(p => `<option value="${p.id}">${p.name} (${p.billing_frequency})</option>`).join('')}
            </select>
          </div>
          <div class="form-group mb-0">
            <label class="form-label" for="quote-validity-days">Validity (Days)</label>
            <input type="number" id="quote-validity-days" class="form-control" value="30" min="1">
          </div>
          <div class="form-group mb-0">
            <label class="form-label" for="quote-payment-terms">Payment Terms</label>
            <select id="quote-payment-terms" class="form-control">
              <option value="Net 30">Net 30 Days</option>
              <option value="Net 15">Net 15 Days</option>
              <option value="Net 60">Net 60 Days</option>
              <option value="Immediate">Immediate / Due Upon Receipt</option>
            </select>
          </div>
        </div>

        <!-- Quotation Product Lines Card -->
        <div class="sub-lines-card">
          <div class="sub-lines-card-header">
            <div>
              <strong style="font-size: 13.5px; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                <span class="material-icons-round" style="font-size: 18px; color: var(--primary-600);">request_quote</span>
                Quotation Product Lines
              </strong>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Preload from template or configure custom items</div>
            </div>
            <button type="button" class="btn btn-sm btn-outline" onclick="Module3.addSubLineRow()">
              <span class="material-icons-round" style="font-size: 16px;">add</span> Add Line Item
            </button>
          </div>
          <div class="sub-line-col-headers">
            <div>Product</div>
            <div>Variant / Surcharge</div>
            <div style="text-align: center;">Qty</div>
            <div></div>
          </div>
          <div id="sub-lines-container"></div>
        </div>

        <div class="form-group mb-0">
          <label class="form-label" for="quote-discount-code">Discount Coupon Code</label>
          <input type="text" id="quote-discount-code" class="form-control text-uppercase" placeholder="e.g. BRIGHT20">
        </div>
      </form>
    `;

    Modal.open({
      title: 'Generate Quotation',
      body: bodyHtml,
      width: '800px',
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onclick: 'Modal.close()' },
        { label: 'Generate Quotation', class: 'btn-primary', onclick: 'Module3.submitCreateQuotation()' }
      ]
    });

    if (preselectedTemplateId) {
      const select = document.getElementById('quote-template-id');
      if (select) this.onTemplateSelect(select);
    } else {
      this.addSubLineRow();
    }
  },

  openCreateQuotationFromTemplate(templateId) {
    this.openCreateQuotationModal(templateId);
  },

  async onTemplateSelect(selectEl) {
    const templateId = selectEl.value;
    if (!templateId) return;

    Loading.show();
    const res = await API.get(`/quotations/templates/${templateId}`);
    Loading.hide();

    if (!res.success || !res.data.template) return;
    const t = res.data.template;

    const planSelect = document.getElementById('quote-plan-id');
    const validityInput = document.getElementById('quote-validity-days');
    const termsSelect = document.getElementById('quote-payment-terms');
    const linesContainer = document.getElementById('sub-lines-container');

    if (planSelect && t.plan_id) planSelect.value = t.plan_id;
    if (validityInput) validityInput.value = t.default_validity_days;
    if (termsSelect) termsSelect.value = t.payment_terms;

    if (linesContainer && Array.isArray(t.lines)) {
      linesContainer.innerHTML = '';
      const products = window._cachedProducts || [];
      t.lines.forEach((l, idx) => {
        const row = document.createElement('div');
        row.className = 'grid grid-3 gap-2 mb-2 align-items-center sub-line-row';
        row.innerHTML = `
          <div>
            <select class="form-control form-control-sm line-prod-select" onchange="Module3.onProductChange(this, ${idx})" required>
              ${products.map(p => `<option value="${p.id}" ${p.id === l.product_id ? 'selected' : ''}>${p.name} (₹${p.sales_price})</option>`).join('')}
            </select>
          </div>
          <div>
            <select class="form-control form-control-sm line-var-select">
              <option value="${l.variant_id || ''}">${l.variant_name || 'Standard Edition (+₹0)'}</option>
            </select>
          </div>
          <div class="d-flex gap-1 align-items-center">
            <input type="number" class="form-control form-control-sm line-qty-input" value="${l.quantity}" min="1" style="width: 70px;">
            <button type="button" class="btn btn-sm btn-outline text-danger p-1" onclick="this.closest('.sub-line-row').remove();">
              <span class="material-icons-round">delete</span>
            </button>
          </div>
        `;
        linesContainer.appendChild(row);
      });
    }
  },

  async submitCreateQuotation() {
    const customerSelect = document.getElementById('quote-customer-id');
    const planSelect = document.getElementById('quote-plan-id');
    const templateSelect = document.getElementById('quote-template-id');
    const validityDays = document.getElementById('quote-validity-days')?.value;
    const paymentTerms = document.getElementById('quote-payment-terms')?.value;
    const discountCode = document.getElementById('quote-discount-code')?.value.trim();

    if (!customerSelect?.value) {
      Toast.error('Validation', 'Please select a customer.');
      return;
    }
    if (!planSelect?.value) {
      Toast.error('Validation', 'Please select a plan.');
      return;
    }

    const rows = document.querySelectorAll('.sub-line-row');
    const lines = [];
    rows.forEach(r => {
      const pId = r.querySelector('.line-prod-select')?.value;
      const vId = r.querySelector('.line-var-select')?.value;
      const qty = parseInt(r.querySelector('.line-qty-input')?.value, 10) || 1;
      if (pId) {
        lines.push({ product_id: Number(pId), variant_id: vId ? Number(vId) : null, quantity: qty });
      }
    });

    if (lines.length === 0) {
      Toast.error('Validation', 'Please add at least one line.');
      return;
    }

    Loading.show();
    let customerId = customerSelect.value;
    if (isNaN(Number(customerId))) {
      const userRes = await API.get(`/users/${customerSelect.value}`);
      if (userRes.success && userRes.data.user) {
        customerId = userRes.data.user.id;
      }
    } else {
      customerId = Number(customerId);
    }

    const payload = {
      customer_id: customerId,
      plan_id: Number(planSelect.value),
      template_id: templateSelect?.value ? Number(templateSelect.value) : null,
      validity_days: parseInt(validityDays, 10) || 30,
      payment_terms: paymentTerms,
      lines,
      discount_code: discountCode || null
    };

    const res = await API.post('/quotations', payload);
    Loading.hide();

    if (res.success) {
      Toast.success('Created', res.message);
      Modal.close();
      Router.resolve();
    } else {
      Toast.error('Error', res.message);
    }
  },

  async openCreateTemplateModal() {
    Loading.show();
    const [prodRes, planRes] = await Promise.all([
      API.get('/products'),
      API.get('/plans')
    ]);
    Loading.hide();

    const products = prodRes.success ? prodRes.data.products : [];
    const plans = planRes.success ? planRes.data.plans.filter(p => p.status === 'active') : [];
    window._cachedProducts = products;

    const bodyHtml = `
      <form id="create-template-form" onsubmit="event.preventDefault(); Module3.submitCreateTemplate();">
        <div class="form-group mb-3">
          <label class="form-label" for="tpl-name">Template Name <span class="text-danger">*</span></label>
          <input type="text" id="tpl-name" class="form-control" placeholder="e.g. Enterprise Starter Pack" required>
        </div>
        <div class="form-group mb-3">
          <label class="form-label" for="tpl-desc">Description</label>
          <input type="text" id="tpl-desc" class="form-control" placeholder="Short description of this package">
        </div>
        <div class="grid grid-3 gap-3 mb-3">
          <div class="form-group mb-0">
            <label class="form-label" for="tpl-plan-id">Default Plan <span class="text-danger">*</span></label>
            <select id="tpl-plan-id" class="form-control" required>
              ${plans.map(p => `<option value="${p.id}">${p.name} (${p.billing_frequency})</option>`).join('')}
            </select>
          </div>
          <div class="form-group mb-0">
            <label class="form-label" for="tpl-validity">Validity (Days)</label>
            <input type="number" id="tpl-validity" class="form-control" value="30" min="1">
          </div>
          <div class="form-group mb-0">
            <label class="form-label" for="tpl-terms">Payment Terms</label>
            <select id="tpl-terms" class="form-control">
              <option value="Net 30">Net 30 Days</option>
              <option value="Net 15">Net 15 Days</option>
              <option value="Net 60">Net 60 Days</option>
            </select>
          </div>
        </div>

        <!-- Predefined Line Items Card -->
        <div class="sub-lines-card">
          <div class="sub-lines-card-header">
            <div>
              <strong style="font-size: 13.5px; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                <span class="material-icons-round" style="font-size: 18px; color: var(--primary-600);">view_quilt</span>
                Predefined Products & Quantities
              </strong>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Items will automatically populate whenever this template is selected</div>
            </div>
            <button type="button" class="btn btn-sm btn-outline" onclick="Module3.addSubLineRow()">
              <span class="material-icons-round" style="font-size: 16px;">add</span> Add Line
            </button>
          </div>
          <div class="sub-line-col-headers">
            <div>Product</div>
            <div>Variant / Surcharge</div>
            <div style="text-align: center;">Qty</div>
            <div></div>
          </div>
          <div id="sub-lines-container"></div>
        </div>
      </form>
    `;

    Modal.open({
      title: 'Create Reusable Quotation Template',
      body: bodyHtml,
      width: '760px',
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onclick: 'Modal.close()' },
        { label: 'Save Template', class: 'btn-primary', onclick: 'Module3.submitCreateTemplate()' }
      ]
    });

    this.addSubLineRow();
  },

  async submitCreateTemplate() {
    const name = document.getElementById('tpl-name')?.value.trim();
    const description = document.getElementById('tpl-desc')?.value.trim();
    const planId = document.getElementById('tpl-plan-id')?.value;
    const validity = document.getElementById('tpl-validity')?.value;
    const terms = document.getElementById('tpl-terms')?.value;

    if (!name) {
      Toast.error('Validation', 'Template name is required.');
      return;
    }

    const rows = document.querySelectorAll('.sub-line-row');
    const lines = [];
    rows.forEach(r => {
      const pId = r.querySelector('.line-prod-select')?.value;
      const vId = r.querySelector('.line-var-select')?.value;
      const qty = parseInt(r.querySelector('.line-qty-input')?.value, 10) || 1;
      if (pId) {
        lines.push({ product_id: Number(pId), variant_id: vId ? Number(vId) : null, quantity: qty });
      }
    });

    if (lines.length === 0) {
      Toast.error('Validation', 'Please add at least one line.');
      return;
    }

    Loading.show();
    const res = await API.post('/quotations/templates', {
      name,
      description,
      plan_id: Number(planId),
      default_validity_days: parseInt(validity, 10) || 30,
      payment_terms: terms,
      lines
    });
    Loading.hide();

    if (res.success) {
      Toast.success('Created', res.message);
      Modal.close();
      Router.resolve();
    } else {
      Toast.error('Error', res.message);
    }
  }
};

window.Module3 = Module3;
