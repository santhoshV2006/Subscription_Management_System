/**
 * Brightloop Software — Module 4 Feature 5: Financial Dashboard & Reports
 *
 * All KPI cards, charts and report tables are populated exclusively from live
 * /api/financial/* database queries. Zero hardcoded figures.
 *
 * Features:
 *  • 6 KPI headline cards
 *  • Date-range quick filters: Today / This Month / Last Month / This Year / Custom
 *  • Monthly Revenue trend (pure CSS/SVG bar chart — no external lib required)
 *  • Paid vs Unpaid invoice comparison (progress bars)
 *  • Revenue by Payment Method (donut-style breakdown)
 *  • Invoice Status Distribution (percentage bars)
 *  • 5 tabbed reports: Invoices / Payments / Outstanding / Overdue / Customer Revenue
 *  • CSV export for every report
 *  • Admin & Staff only (router enforces role-based access)
 */

const FinancialDashboard = {

  // ─── State ──────────────────────────────────────────────────────────────────
  _period: 'this_month',
  _startDate: '',
  _endDate: '',
  _activeReport: 'invoices',

  // ══════════════════════════════════════════════════════════════════════════════
  // MAIN PAGE
  // ══════════════════════════════════════════════════════════════════════════════

  async financialDashboardPage(queryParams = {}) {
    const role = Auth.getRole();
    if (!['admin', 'staff'].includes(role)) {
      return Dashboards.layout('financial', `
        <div class="empty-state" style="padding:64px 0;">
          <div class="empty-state-icon"><span class="material-icons-round">lock</span></div>
          <h3>Access Denied</h3>
          <p>Financial Dashboard is restricted to Admin and Staff users.</p>
        </div>
      `);
    }

    // Restore any query params
    if (queryParams.period) this._period = queryParams.period;
    if (queryParams.start_date) this._startDate = queryParams.start_date;
    if (queryParams.end_date)   this._endDate   = queryParams.end_date;
    if (queryParams.report)     this._activeReport = queryParams.report;

    // Build date param string
    const dateQ = this._buildDateQuery();

    // Parallel fetch: all dashboard data at once
    const [kpiRes, monthlyRes, paidVsUnpaidRes, methodRes, statusRes] = await Promise.all([
      API.get(`/financial/kpis${dateQ}`),
      API.get('/financial/monthly-revenue'),
      API.get(`/financial/paid-vs-unpaid${dateQ}`),
      API.get('/financial/revenue-by-method'),
      API.get('/financial/status-distribution')
    ]);

    const kpis       = kpiRes.success       ? kpiRes.data          : {};
    const monthly    = monthlyRes.success    ? monthlyRes.data      : [];
    const paidUnpaid = paidVsUnpaidRes.success ? paidVsUnpaidRes.data : {};
    const methods    = methodRes.success     ? methodRes.data       : [];
    const statuses   = statusRes.success     ? statusRes.data       : [];
    const totalInv   = statusRes.success     ? statusRes.total_invoices : 0;

    const content = `
      <div class="page-container" id="financial-dashboard-root">

        <!-- Page Header -->
        <div class="page-header flex-between mb-4">
          <div>
            <h1 class="page-title">Financial Dashboard & Reports</h1>
            <p class="page-subtitle">Real-time financial analytics powered by live invoice and payment records.</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-outline btn-sm" onclick="FinancialDashboard.exportCurrentReport()">
              <span class="material-icons-round" style="font-size:16px;">download</span> Export CSV
            </button>
            <button class="btn btn-primary btn-sm" onclick="FinancialDashboard.refreshDashboard()">
              <span class="material-icons-round" style="font-size:16px;">refresh</span> Refresh
            </button>
          </div>
        </div>

        <!-- Date Range Filter Bar -->
        ${this._renderDateFilterBar()}

        <!-- KPI Cards -->
        ${this._renderKPIs(kpis)}

        <!-- Charts Row -->
        <div class="fin-charts-grid mb-4">
          ${this._renderMonthlyRevenue(monthly)}
          ${this._renderPaidVsUnpaid(paidUnpaid)}
        </div>

        <div class="fin-charts-grid mb-4">
          ${this._renderRevenueByMethod(methods)}
          ${this._renderStatusDistribution(statuses, totalInv)}
        </div>

        <!-- Reports Section -->
        ${await this._renderReportsSection()}

      </div>
    `;

    return Dashboards.layout('financial', content);
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // DATE FILTER BAR
  // ══════════════════════════════════════════════════════════════════════════════

  _renderDateFilterBar() {
    const p = this._period;
    return `
      <div class="card mb-4" style="padding:14px 20px;">
        <div style="display:flex;align-items:center;flex-wrap:wrap;gap:12px;">
          <span style="font-weight:600;font-size:13px;color:var(--text-secondary);display:flex;align-items:center;gap:5px;">
            <span class="material-icons-round" style="font-size:18px;color:var(--primary-600);">date_range</span>
            Period:
          </span>
          <div class="filter-tabs" style="margin:0;">
            ${['today','this_month','last_month','this_year','custom'].map(key => {
              const labels = { today:'Today', this_month:'This Month', last_month:'Last Month', this_year:'This Year', custom:'Custom' };
              return `<button class="filter-tab ${p === key ? 'active' : ''}"
                              onclick="FinancialDashboard.setPeriod('${key}')">${labels[key]}</button>`;
            }).join('')}
          </div>

          <!-- Custom date inputs, shown only when custom is selected -->
          <div id="fin-custom-dates" style="display:${p === 'custom' ? 'flex' : 'none'};align-items:center;gap:8px;flex-wrap:wrap;">
            <label style="font-size:12px;color:var(--text-muted);">From</label>
            <input type="date" id="fin-start-date" class="form-control" style="width:150px;height:34px;font-size:13px;"
                   value="${this._startDate}" onchange="FinancialDashboard.onCustomDateChange()">
            <label style="font-size:12px;color:var(--text-muted);">To</label>
            <input type="date" id="fin-end-date" class="form-control" style="width:150px;height:34px;font-size:13px;"
                   value="${this._endDate}" onchange="FinancialDashboard.onCustomDateChange()">
            <button class="btn btn-primary btn-sm" onclick="FinancialDashboard.applyCustomDates()">Apply</button>
          </div>

          <span style="margin-left:auto;font-size:12px;color:var(--text-muted);">
            ${this._startDate && this._endDate
              ? `Showing: ${this._startDate} → ${this._endDate}`
              : this._period !== 'custom' ? `Preset: ${this._period.replace('_',' ')}` : ''}
          </span>
        </div>
      </div>
    `;
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // 6 KPI CARDS
  // ══════════════════════════════════════════════════════════════════════════════

  _renderKPIs(k) {
    const cards = [
      { icon: 'receipt_long',    color: 'primary', label: 'Total Invoices',         value: (k.total_invoices || 0).toLocaleString('en-IN'),                         note: 'All statuses' },
      { icon: 'account_balance_wallet', color: 'success', label: 'Total Invoiced Amount', value: '₹' + fmt(k.total_invoiced),                                        note: 'Sum of all invoice totals' },
      { icon: 'payments',        color: 'success', label: 'Total Amount Collected',  value: '₹' + fmt(k.total_collected),                                            note: 'Paid invoices only' },
      { icon: 'pending_actions', color: 'warning', label: 'Outstanding Amount',     value: '₹' + fmt(k.outstanding_amount),                                          note: 'Confirmed, not yet paid' },
      { icon: 'warning_amber',   color: 'danger',  label: 'Overdue Amount',         value: '₹' + fmt(k.overdue_amount),                                              note: 'Past due date' },
      { icon: 'check_circle',    color: 'primary', label: 'Payments Received',      value: (k.total_payments_received || 0).toLocaleString('en-IN'),                  note: 'Fully paid invoices' },
    ];

    return `
      <div class="fin-kpi-grid mb-4">
        ${cards.map(c => `
          <div class="stat-card ${c.color}">
            <div class="stat-icon"><span class="material-icons-round">${c.icon}</span></div>
            <div class="stat-content">
              <div class="stat-value" style="font-size:clamp(18px,2.5vw,26px);">${c.value}</div>
              <div class="stat-label">${c.label}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${c.note}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // CHART 1: MONTHLY REVENUE TREND (pure CSS bar chart)
  // ══════════════════════════════════════════════════════════════════════════════

  _renderMonthlyRevenue(rows) {
    if (!rows || rows.length === 0) {
      return `
        <div class="card fin-chart-card">
          <div class="card-header"><h3 class="card-title"><span class="material-icons-round" style="color:var(--primary-600)">trending_up</span> Monthly Revenue Trend</h3></div>
          <div class="fin-empty-chart">No paid invoice data yet.</div>
        </div>`;
    }

    const maxVal = Math.max(...rows.map(r => r.revenue));
    const last12 = rows.slice(-12);

    const bars = last12.map(r => {
      const heightPct = maxVal > 0 ? ((r.revenue / maxVal) * 100) : 0;
      const label = r.month;
      const displayMonth = label.substring(5); // MM
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const mName = monthNames[parseInt(displayMonth, 10) - 1] || displayMonth;
      const yr = label.substring(2, 4);
      return `
        <div class="fin-bar-wrap" title="${label}: ₹${fmt(r.revenue)} (${r.invoice_count} invoices)">
          <div class="fin-bar-value">₹${this._shortNum(r.revenue)}</div>
          <div class="fin-bar-col">
            <div class="fin-bar" style="height:${Math.max(4, heightPct)}%;"></div>
          </div>
          <div class="fin-bar-label">${mName} '${yr}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="card fin-chart-card">
        <div class="card-header">
          <h3 class="card-title"><span class="material-icons-round" style="color:var(--primary-600)">trending_up</span> Monthly Revenue Trend</h3>
          <span style="font-size:12px;color:var(--text-muted);">Paid invoices only</span>
        </div>
        <div class="fin-bar-chart">${bars}</div>
      </div>
    `;
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // CHART 2: PAID VS UNPAID (progress bars)
  // ══════════════════════════════════════════════════════════════════════════════

  _renderPaidVsUnpaid(d) {
    const paid      = d.paid       || { invoice_count: 0, total_value: 0 };
    const confirmed = d.confirmed  || { invoice_count: 0, total_value: 0 };
    const draft     = d.draft      || { invoice_count: 0, total_value: 0 };
    const cancelled = d.cancelled  || { invoice_count: 0, total_value: 0 };

    const totalVal = paid.total_value + confirmed.total_value + draft.total_value + cancelled.total_value || 1;

    const rows = [
      { label: 'Paid',       color: '#22c55e', data: paid,      pct: (paid.total_value      / totalVal * 100) },
      { label: 'Confirmed',  color: '#3b82f6', data: confirmed, pct: (confirmed.total_value / totalVal * 100) },
      { label: 'Draft',      color: '#f59e0b', data: draft,     pct: (draft.total_value     / totalVal * 100) },
      { label: 'Cancelled',  color: '#94a3b8', data: cancelled, pct: (cancelled.total_value / totalVal * 100) },
    ];

    return `
      <div class="card fin-chart-card">
        <div class="card-header">
          <h3 class="card-title"><span class="material-icons-round" style="color:var(--success-600)">compare_arrows</span> Paid vs Unpaid Comparison</h3>
        </div>
        <div style="padding:16px 20px;">
          ${rows.map(r => `
            <div style="margin-bottom:16px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;">
                <span style="display:flex;align-items:center;gap:6px;font-weight:500;">
                  <span style="width:10px;height:10px;border-radius:50%;background:${r.color};display:inline-block;"></span>
                  ${r.label}
                  <span style="color:var(--text-muted);font-weight:400;">(${r.data.invoice_count} invoices)</span>
                </span>
                <span class="font-mono" style="font-weight:600;">₹${fmt(r.data.total_value)}</span>
              </div>
              <div style="background:var(--gray-100);border-radius:var(--radius-full);height:10px;overflow:hidden;">
                <div style="background:${r.color};height:100%;width:${Math.max(0, r.pct).toFixed(1)}%;border-radius:var(--radius-full);transition:width 0.6s ease;"></div>
              </div>
              <div style="text-align:right;font-size:11px;color:var(--text-muted);margin-top:2px;">${r.pct.toFixed(1)}%</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // CHART 3: REVENUE BY PAYMENT METHOD
  // ══════════════════════════════════════════════════════════════════════════════

  _renderRevenueByMethod(rows) {
    if (!rows || rows.length === 0) {
      return `
        <div class="card fin-chart-card">
          <div class="card-header"><h3 class="card-title"><span class="material-icons-round" style="color:var(--accent-500)">account_balance</span> Revenue by Payment Method</h3></div>
          <div class="fin-empty-chart">No payment data yet.</div>
        </div>`;
    }

    const total = rows.reduce((s, r) => s + r.total_collected, 0) || 1;
    const colors = ['#6366f1','#22c55e','#f59e0b','#ef4444','#8b5cf6','#14b8a6','#f97316','#3b82f6'];

    return `
      <div class="card fin-chart-card">
        <div class="card-header">
          <h3 class="card-title"><span class="material-icons-round" style="color:var(--accent-500)">account_balance</span> Revenue by Payment Method</h3>
          <span style="font-size:12px;color:var(--text-muted);">Collected amount</span>
        </div>
        <div style="padding:16px 20px;">
          ${rows.map((r, i) => {
            const pct = (r.total_collected / total * 100).toFixed(1);
            const color = colors[i % colors.length];
            return `
              <div style="margin-bottom:14px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:13px;">
                  <span style="display:flex;align-items:center;gap:6px;font-weight:500;">
                    <span style="width:10px;height:10px;border-radius:2px;background:${color};display:inline-block;"></span>
                    ${r.method}
                    <span style="color:var(--text-muted);font-weight:400;">(${r.payment_count} payments)</span>
                  </span>
                  <span class="font-mono" style="font-weight:600;">₹${fmt(r.total_collected)}</span>
                </div>
                <div style="background:var(--gray-100);border-radius:var(--radius-full);height:8px;overflow:hidden;">
                  <div style="background:${color};height:100%;width:${pct}%;border-radius:var(--radius-full);"></div>
                </div>
                <div style="text-align:right;font-size:11px;color:var(--text-muted);margin-top:2px;">${pct}%</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // CHART 4: INVOICE STATUS DISTRIBUTION
  // ══════════════════════════════════════════════════════════════════════════════

  _renderStatusDistribution(rows, total) {
    if (!rows || rows.length === 0) {
      return `
        <div class="card fin-chart-card">
          <div class="card-header"><h3 class="card-title"><span class="material-icons-round" style="color:var(--warning-600)">donut_large</span> Invoice Status Distribution</h3></div>
          <div class="fin-empty-chart">No invoice data yet.</div>
        </div>`;
    }

    const statusColors = { Paid: '#22c55e', Confirmed: '#3b82f6', Draft: '#f59e0b', Cancelled: '#94a3b8' };

    return `
      <div class="card fin-chart-card">
        <div class="card-header">
          <h3 class="card-title"><span class="material-icons-round" style="color:var(--warning-600)">donut_large</span> Invoice Status Distribution</h3>
          <span style="font-size:12px;color:var(--text-muted);">Total: ${total} invoices</span>
        </div>
        <div style="padding:16px 20px;">

          <!-- Segmented bar -->
          <div style="display:flex;height:20px;border-radius:var(--radius-full);overflow:hidden;margin-bottom:20px;gap:2px;">
            ${rows.map(r => {
              const color = statusColors[r.status] || '#94a3b8';
              return `<div style="background:${color};width:${r.percentage}%;transition:width 0.5s;"
                            title="${r.status}: ${r.percentage}%"></div>`;
            }).join('')}
          </div>

          <!-- Legend with counts -->
          ${rows.map(r => {
            const color = statusColors[r.status] || '#94a3b8';
            return `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--gray-100);font-size:13px;">
                <span style="display:flex;align-items:center;gap:8px;">
                  <span style="width:12px;height:12px;border-radius:3px;background:${color};display:inline-block;flex-shrink:0;"></span>
                  <span style="font-weight:500;">${r.status}</span>
                </span>
                <span style="display:flex;gap:20px;align-items:center;">
                  <span class="font-mono" style="color:var(--text-muted);">${r.invoice_count} invoices</span>
                  <span class="font-mono" style="font-weight:600;">₹${fmt(r.total_value)}</span>
                  <span style="background:var(--gray-100);padding:2px 8px;border-radius:var(--radius-full);font-size:11px;font-weight:600;color:var(--text-secondary);">${r.percentage}%</span>
                </span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // REPORTS SECTION — 5 tabs with filterable tables + CSV export
  // ══════════════════════════════════════════════════════════════════════════════

  async _renderReportsSection() {
    const tabs = [
      { id: 'invoices',         label: 'Invoice Report',          icon: 'receipt_long' },
      { id: 'payments',         label: 'Payment Report',          icon: 'payments' },
      { id: 'outstanding',      label: 'Outstanding',             icon: 'pending_actions' },
      { id: 'overdue',          label: 'Overdue',                 icon: 'warning_amber' },
      { id: 'customer-revenue', label: 'Customer Revenue',        icon: 'group' },
    ];

    const activeTab = this._activeReport;
    const reportHTML = await this._loadReport(activeTab);

    return `
      <div class="card mb-4">
        <div class="card-header" style="border-bottom:none;padding-bottom:0;">
          <h3 class="card-title"><span class="material-icons-round" style="color:var(--primary-600)">assessment</span> Financial Reports</h3>
        </div>

        <!-- Report Tabs -->
        <div style="padding:0 20px;border-bottom:2px solid var(--gray-100);overflow-x:auto;white-space:nowrap;">
          ${tabs.map(t => `
            <button class="fin-report-tab ${activeTab === t.id ? 'active' : ''}"
                    onclick="FinancialDashboard.switchReport('${t.id}')">
              <span class="material-icons-round" style="font-size:16px;">${t.icon}</span>
              ${t.label}
            </button>
          `).join('')}
        </div>

        <!-- Report Content -->
        <div id="fin-report-content">
          ${reportHTML}
        </div>
      </div>
    `;
  },

  async switchReport(tabId) {
    this._activeReport = tabId;

    // Update tab active states
    document.querySelectorAll('.fin-report-tab').forEach(t => {
      t.classList.toggle('active', t.textContent.trim().toLowerCase().includes(tabId.replace('-', ' ').toLowerCase()) || t.getAttribute('onclick')?.includes(tabId));
    });
    // Re-render active state by checking onclick attr
    document.querySelectorAll('.fin-report-tab').forEach(t => {
      const oc = t.getAttribute('onclick') || '';
      t.classList.toggle('active', oc.includes(`'${tabId}'`));
    });

    const container = document.getElementById('fin-report-content');
    if (!container) return;
    container.innerHTML = `<div style="padding:32px;text-align:center;"><div class="spinner-sm"></div></div>`;
    container.innerHTML = await this._loadReport(tabId);
  },

  async _loadReport(tabId) {
    const dateQ = this._buildDateQuery();
    switch (tabId) {
      case 'invoices':         return await this._reportInvoices(dateQ);
      case 'payments':         return await this._reportPayments(dateQ);
      case 'outstanding':      return await this._reportOutstanding();
      case 'overdue':          return await this._reportOverdue();
      case 'customer-revenue': return await this._reportCustomerRevenue(dateQ);
      default:                 return '<p style="padding:24px;color:var(--text-muted)">Report not found.</p>';
    }
  },

  // ── Report 1: Invoice Report ─────────────────────────────────────────────────

  async _reportInvoices(dateQ) {
    const res = await API.get(`/financial/report/invoices${dateQ}&limit=200`);
    const rows = res.success ? res.data.invoices : [];
    const total = res.success ? res.data.total : 0;

    const statusBadge = (s) => {
      const map = { Paid:'success', Confirmed:'primary', Draft:'warning', Cancelled:'danger' };
      const c = map[s] || 'secondary';
      return `<span class="badge-status ${c}" style="display:inline-flex;"><span class="badge-status-dot"></span>${s}</span>`;
    };

    return `
      <div style="padding:16px 20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
          <span style="font-size:13px;color:var(--text-muted);">${total} invoices found</span>
          <div style="display:flex;gap:8px;align-items:center;">
            <select class="filter-select" id="fin-inv-status-filter" onchange="FinancialDashboard.filterInvoiceReport()" style="height:34px;">
              <option value="">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Draft">Draft</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <input type="text" id="fin-inv-search" class="form-control" placeholder="Search invoice #, customer..."
                   style="width:200px;height:34px;font-size:13px;" onkeyup="if(event.key==='Enter')FinancialDashboard.filterInvoiceReport()">
            <button class="btn btn-sm btn-outline" onclick="FinancialDashboard.filterInvoiceReport()">Search</button>
            <button class="btn btn-sm btn-secondary" onclick="FinancialDashboard.downloadCSV('invoices')" title="Export CSV">
              <span class="material-icons-round" style="font-size:15px;">download</span> CSV
            </button>
          </div>
        </div>
        <div class="table-container" style="max-height:420px;overflow-y:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Subscription</th>
                <th>Invoice Date</th>
                <th>Due Date</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length === 0 ? `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted);">No invoices found for this period.</td></tr>` :
                rows.map(r => `
                  <tr>
                    <td><strong class="font-mono" style="color:var(--primary-600);cursor:pointer;" onclick="Module4.viewInvoice(${r.id || ''})">
                      ${r.invoice_number}
                    </strong></td>
                    <td>
                      <div style="font-weight:500;">${r.customer_name}</div>
                      <div style="font-size:11px;color:var(--text-muted);">${r.customer_email}</div>
                    </td>
                    <td><span class="font-mono" style="font-size:12px;">${r.subscription_number || '—'}</span></td>
                    <td style="color:var(--text-muted);font-size:12px;">${r.invoice_date || '—'}</td>
                    <td style="color:var(--text-muted);font-size:12px;">${r.due_date || '—'}</td>
                    <td class="font-mono" style="font-weight:600;">₹${fmt(r.total_amount)}</td>
                    <td class="font-mono" style="color:var(--success-600);">₹${fmt(r.amount_paid)}</td>
                    <td class="font-mono" style="color:${parseFloat(r.balance_due||0)>0?'var(--danger-600)':'var(--success-600)'};">
                      ₹${fmt(r.balance_due)}
                    </td>
                    <td>${statusBadge(r.status)}</td>
                  </tr>
                `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async filterInvoiceReport() {
    const status = document.getElementById('fin-inv-status-filter')?.value || '';
    const search = document.getElementById('fin-inv-search')?.value || '';
    const dateQ = this._buildDateQuery();
    const q = `${dateQ}&limit=200${status ? '&status=' + encodeURIComponent(status) : ''}${search ? '&search=' + encodeURIComponent(search) : ''}`;
    const res = await API.get(`/financial/report/invoices${q}`);
    const rows = res.success ? res.data.invoices : [];
    const total = res.success ? res.data.total : 0;

    // Re-render only the tbody
    const tbody = document.querySelector('#fin-report-content .data-table tbody');
    const countEl = document.querySelector('#fin-report-content [data-count]');
    if (!tbody) { await this.switchReport('invoices'); return; }

    const statusBadge = (s) => {
      const map = { Paid:'success', Confirmed:'primary', Draft:'warning', Cancelled:'danger' };
      return `<span class="badge-status ${map[s]||'secondary'}" style="display:inline-flex;"><span class="badge-status-dot"></span>${s}</span>`;
    };
    tbody.innerHTML = rows.length === 0
      ? `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted);">No invoices found.</td></tr>`
      : rows.map(r => `<tr>
          <td><strong class="font-mono" style="color:var(--primary-600);">${r.invoice_number}</strong></td>
          <td><div style="font-weight:500;">${r.customer_name}</div><div style="font-size:11px;color:var(--text-muted);">${r.customer_email}</div></td>
          <td><span class="font-mono" style="font-size:12px;">${r.subscription_number || '—'}</span></td>
          <td style="color:var(--text-muted);font-size:12px;">${r.invoice_date || '—'}</td>
          <td style="color:var(--text-muted);font-size:12px;">${r.due_date || '—'}</td>
          <td class="font-mono" style="font-weight:600;">₹${fmt(r.total_amount)}</td>
          <td class="font-mono" style="color:var(--success-600);">₹${fmt(r.amount_paid)}</td>
          <td class="font-mono" style="color:${parseFloat(r.balance_due||0)>0?'var(--danger-600)':'var(--success-600)'};">₹${fmt(r.balance_due)}</td>
          <td>${statusBadge(r.status)}</td>
        </tr>`).join('');
  },

  // ── Report 2: Payment Report ─────────────────────────────────────────────────

  async _reportPayments(dateQ) {
    const res = await API.get(`/financial/report/payments${dateQ}&limit=200`);
    const rows = res.success ? res.data.payments : [];
    const summary = res.success ? res.data.summary : { payment_count: 0, total_collected: 0, avg_payment: 0 };

    return `
      <div style="padding:16px 20px;">
        <!-- Summary banner -->
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;">
          ${[
            { label:'Total Payments', value: summary.payment_count.toLocaleString('en-IN') },
            { label:'Total Collected', value: '₹' + fmt(summary.total_collected) },
            { label:'Avg Payment', value: '₹' + fmt(summary.avg_payment) }
          ].map(s => `
            <div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:var(--radius-md);padding:12px 18px;min-width:160px;">
              <div class="font-mono" style="font-size:18px;font-weight:700;color:var(--text-primary);">${s.value}</div>
              <div style="font-size:12px;color:var(--text-muted);">${s.label}</div>
            </div>
          `).join('')}
          <button class="btn btn-sm btn-secondary" style="margin-left:auto;" onclick="FinancialDashboard.downloadCSV('payments')" title="Export CSV">
            <span class="material-icons-round" style="font-size:15px;">download</span> Export CSV
          </button>
        </div>

        <div class="table-container" style="max-height:400px;overflow-y:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Amount Paid</th>
                <th>Payment Method</th>
                <th>Reference</th>
                <th>Paid Date</th>
                <th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length === 0 ? `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted);">No payments recorded in this period.</td></tr>` :
                rows.map(r => `
                  <tr>
                    <td><strong class="font-mono" style="color:var(--primary-600);">${r.invoice_number}</strong></td>
                    <td><div style="font-weight:500;">${r.customer_name}</div><div style="font-size:11px;color:var(--text-muted);">${r.customer_email}</div></td>
                    <td class="font-mono" style="font-weight:700;color:var(--success-600);">₹${fmt(r.amount_paid)}</td>
                    <td>
                      <span style="background:var(--primary-50);color:var(--primary-700);padding:2px 8px;border-radius:var(--radius-full);font-size:12px;font-weight:500;">
                        ${r.payment_method}
                      </span>
                    </td>
                    <td class="font-mono" style="font-size:12px;color:var(--text-muted);">${r.payment_reference || '—'}</td>
                    <td style="color:var(--text-muted);font-size:12px;">${r.paid_at ? r.paid_at.split(' ')[0] : '—'}</td>
                    <td style="color:var(--text-muted);font-size:12px;">${r.due_date || '—'}</td>
                  </tr>
                `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // ── Report 3: Outstanding Invoices ───────────────────────────────────────────

  async _reportOutstanding() {
    const res = await API.get('/financial/report/outstanding');
    const rows = res.success ? res.data.invoices : [];
    const summary = res.success ? res.data.summary : { count: 0, total_outstanding: 0, overdue_count: 0, total_overdue: 0 };

    return `
      <div style="padding:16px 20px;">
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;">
          ${[
            { label:'Outstanding Invoices', value: summary.count },
            { label:'Total Outstanding', value: '₹' + fmt(summary.total_outstanding), highlight: true },
            { label:'Overdue Invoices', value: summary.overdue_count, red: true },
            { label:'Overdue Amount', value: '₹' + fmt(summary.total_overdue), red: true }
          ].map(s => `
            <div style="background:var(--gray-50);border:1px solid ${s.red?'var(--danger-200)':s.highlight?'var(--warning-100)':'var(--gray-200)'};border-radius:var(--radius-md);padding:12px 18px;min-width:160px;">
              <div class="font-mono" style="font-size:18px;font-weight:700;color:${s.red?'var(--danger-600)':s.highlight?'var(--warning-600)':'var(--text-primary)'};">${s.value}</div>
              <div style="font-size:12px;color:var(--text-muted);">${s.label}</div>
            </div>
          `).join('')}
          <button class="btn btn-sm btn-secondary" style="margin-left:auto;" onclick="FinancialDashboard.downloadCSV('outstanding')">
            <span class="material-icons-round" style="font-size:15px;">download</span> Export CSV
          </button>
        </div>
        <div class="table-container" style="max-height:400px;overflow-y:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Invoice Date</th>
                <th>Due Date</th>
                <th>Total</th>
                <th>Balance Due</th>
                <th>Overdue?</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length === 0 ? `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted);">No outstanding invoices. All clear! ✅</td></tr>` :
                rows.map(r => `
                  <tr class="${r.is_overdue ? 'fin-row-overdue' : ''}">
                    <td><strong class="font-mono" style="color:var(--primary-600);">${r.invoice_number}</strong></td>
                    <td><div style="font-weight:500;">${r.customer_name}</div><div style="font-size:11px;color:var(--text-muted);">${r.customer_email}</div></td>
                    <td style="color:var(--text-muted);font-size:12px;">${r.invoice_date}</td>
                    <td style="color:${r.is_overdue?'var(--danger-600)':'var(--text-muted)'};font-size:12px;font-weight:${r.is_overdue?'600':'400'};">${r.due_date}</td>
                    <td class="font-mono" style="font-weight:600;">₹${fmt(r.total_amount)}</td>
                    <td class="font-mono" style="font-weight:700;color:var(--danger-600);">₹${fmt(r.balance_due)}</td>
                    <td>
                      ${r.is_overdue
                        ? `<span style="background:var(--danger-50);color:var(--danger-700);padding:2px 8px;border-radius:var(--radius-full);font-size:11px;font-weight:600;">
                              ⚠ ${r.days_overdue}d overdue
                           </span>`
                        : `<span style="color:var(--success-600);font-size:12px;">On time</span>`}
                    </td>
                  </tr>
                `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // ── Report 4: Overdue Invoices ───────────────────────────────────────────────

  async _reportOverdue() {
    const res = await API.get('/financial/report/overdue');
    const rows = res.success ? res.data.invoices : [];
    const summary = res.success ? res.data.summary : { count: 0, total_overdue: 0 };

    return `
      <div style="padding:16px 20px;">
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;align-items:center;">
          <div style="background:var(--danger-50);border:1px solid var(--danger-200);border-radius:var(--radius-md);padding:12px 18px;">
            <div class="font-mono" style="font-size:20px;font-weight:700;color:var(--danger-600);">${summary.count}</div>
            <div style="font-size:12px;color:var(--text-muted);">Overdue Invoices</div>
          </div>
          <div style="background:var(--danger-50);border:1px solid var(--danger-200);border-radius:var(--radius-md);padding:12px 18px;">
            <div class="font-mono" style="font-size:20px;font-weight:700;color:var(--danger-600);">₹${fmt(summary.total_overdue)}</div>
            <div style="font-size:12px;color:var(--text-muted);">Total Overdue Amount</div>
          </div>
          <button class="btn btn-sm btn-secondary" style="margin-left:auto;" onclick="FinancialDashboard.downloadCSV('overdue')">
            <span class="material-icons-round" style="font-size:15px;">download</span> Export CSV
          </button>
        </div>
        ${rows.length === 0 ? `
          <div style="text-align:center;padding:48px;color:var(--success-600);">
            <span class="material-icons-round" style="font-size:48px;">check_circle</span>
            <p style="margin-top:12px;font-weight:500;">No overdue invoices! All invoices are within payment terms.</p>
          </div>
        ` : `
          <div class="table-container" style="max-height:400px;overflow-y:auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Due Date</th>
                  <th>Days Overdue</th>
                  <th>Total</th>
                  <th>Balance Due</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map(r => `
                  <tr class="fin-row-overdue">
                    <td><strong class="font-mono" style="color:var(--primary-600);">${r.invoice_number}</strong></td>
                    <td><div style="font-weight:500;">${r.customer_name}</div><div style="font-size:11px;color:var(--text-muted);">${r.customer_email}</div></td>
                    <td><span style="background:var(--warning-100);color:var(--warning-700);padding:2px 8px;border-radius:var(--radius-full);font-size:12px;font-weight:500;">${r.status}</span></td>
                    <td style="color:var(--danger-600);font-weight:600;font-size:12px;">${r.due_date}</td>
                    <td>
                      <span style="background:var(--danger-100);color:var(--danger-700);padding:2px 10px;border-radius:var(--radius-full);font-size:12px;font-weight:700;">
                        ${r.days_overdue}d
                      </span>
                    </td>
                    <td class="font-mono" style="font-weight:600;">₹${fmt(r.total_amount)}</td>
                    <td class="font-mono" style="font-weight:700;color:var(--danger-600);">₹${fmt(r.balance_due)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  },

  // ── Report 5: Customer Revenue Report ───────────────────────────────────────

  async _reportCustomerRevenue(dateQ) {
    const res = await API.get(`/financial/report/customer-revenue${dateQ}`);
    const rows    = res.success ? res.data.customers : [];
    const summary = res.success ? res.data.summary   : { customer_count: 0, total_invoiced: 0, total_collected: 0, outstanding: 0 };

    return `
      <div style="padding:16px 20px;">
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;align-items:center;">
          ${[
            { label:'Customers',       value: summary.customer_count },
            { label:'Total Invoiced',  value: '₹' + fmt(summary.total_invoiced) },
            { label:'Total Collected', value: '₹' + fmt(summary.total_collected), green: true },
            { label:'Outstanding',     value: '₹' + fmt(summary.outstanding), warn: true }
          ].map(s => `
            <div style="background:var(--gray-50);border:1px solid ${s.green?'var(--success-200)':s.warn?'var(--warning-100)':'var(--gray-200)'};border-radius:var(--radius-md);padding:12px 18px;min-width:140px;">
              <div class="font-mono" style="font-size:18px;font-weight:700;color:${s.green?'var(--success-600)':s.warn?'var(--warning-600)':'var(--text-primary)'};">${s.value}</div>
              <div style="font-size:12px;color:var(--text-muted);">${s.label}</div>
            </div>
          `).join('')}
          <button class="btn btn-sm btn-secondary" style="margin-left:auto;" onclick="FinancialDashboard.downloadCSV('customer-revenue')">
            <span class="material-icons-round" style="font-size:15px;">download</span> Export CSV
          </button>
        </div>
        <div class="table-container" style="max-height:400px;overflow-y:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th style="text-align:center;">Invoices</th>
                <th style="text-align:center;">Paid</th>
                <th style="text-align:center;">Open</th>
                <th style="text-align:right;">Total Invoiced</th>
                <th style="text-align:right;">Collected</th>
                <th style="text-align:right;">Outstanding</th>
                <th style="text-align:right;">Collection Rate</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length === 0 ? `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted);">No customer data found.</td></tr>` :
                rows.map(r => {
                  const collRate = r.total_invoiced > 0 ? ((r.total_collected / r.total_invoiced) * 100).toFixed(1) : '0.0';
                  const rateColor = parseFloat(collRate) >= 80 ? 'var(--success-600)' : parseFloat(collRate) >= 50 ? 'var(--warning-600)' : 'var(--danger-600)';
                  return `
                    <tr>
                      <td>
                        <div style="font-weight:600;">${r.customer_name}</div>
                        <div style="font-size:11px;color:var(--text-muted);">${r.customer_email}</div>
                      </td>
                      <td style="text-align:center;font-weight:600;">${r.total_invoices}</td>
                      <td style="text-align:center;color:var(--success-600);font-weight:600;">${r.paid_invoices}</td>
                      <td style="text-align:center;color:var(--warning-600);">${r.open_invoices}</td>
                      <td style="text-align:right;" class="font-mono">₹${fmt(r.total_invoiced)}</td>
                      <td style="text-align:right;" class="font-mono" style="color:var(--success-600);">₹${fmt(r.total_collected)}</td>
                      <td style="text-align:right;" class="font-mono" style="color:${r.outstanding > 0 ? 'var(--danger-600)' : 'var(--success-600)'};">₹${fmt(r.outstanding)}</td>
                      <td style="text-align:right;">
                        <span style="font-weight:700;color:${rateColor};">${collRate}%</span>
                      </td>
                    </tr>
                  `;
                }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ══════════════════════════════════════════════════════════════════════════════

  _buildDateQuery() {
    if (this._period === 'custom' && this._startDate && this._endDate) {
      return `?start_date=${this._startDate}&end_date=${this._endDate}`;
    }
    if (this._period && this._period !== 'custom') {
      return `?period=${this._period}`;
    }
    return '';
  },

  setPeriod(period) {
    this._period = period;
    const customDiv = document.getElementById('fin-custom-dates');
    if (customDiv) customDiv.style.display = period === 'custom' ? 'flex' : 'none';
    if (period !== 'custom') {
      this._startDate = '';
      this._endDate = '';
      this.refreshDashboard();
    }
  },

  onCustomDateChange() {
    this._startDate = document.getElementById('fin-start-date')?.value || '';
    this._endDate   = document.getElementById('fin-end-date')?.value   || '';
  },

  applyCustomDates() {
    this._startDate = document.getElementById('fin-start-date')?.value || '';
    this._endDate   = document.getElementById('fin-end-date')?.value   || '';
    if (this._startDate && this._endDate) {
      this.refreshDashboard();
    } else {
      Toast.warning('Validation', 'Please select both start and end dates.');
    }
  },

  refreshDashboard() {
    Router.navigate('/dashboard/admin/financial', {
      period: this._period,
      ...(this._period === 'custom' && this._startDate ? { start_date: this._startDate } : {}),
      ...(this._period === 'custom' && this._endDate   ? { end_date: this._endDate }   : {}),
      report: this._activeReport
    });
  },

  exportCurrentReport() {
    this.downloadCSV(this._activeReport);
  },

  downloadCSV(reportType) {
    const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token') || '';
    const base = window.CONFIG?.API_BASE_URL || '/api';

    const dateQ = this._buildDateQuery();
    const sep   = dateQ ? '&' : '?';
    let url;

    switch (reportType) {
      case 'invoices':
        url = `${base}/financial/report/invoices${dateQ}${sep}export=csv&limit=10000`;
        break;
      case 'payments':
        url = `${base}/financial/report/payments${dateQ}${sep}export=csv&limit=10000`;
        break;
      case 'outstanding':
        url = `${base}/financial/report/outstanding?export=csv`;
        break;
      case 'overdue':
        url = `${base}/financial/report/overdue?export=csv`;
        break;
      case 'customer-revenue':
        url = `${base}/financial/report/customer-revenue${dateQ}${sep}export=csv`;
        break;
      default:
        Toast.error('Export', 'Unknown report type.'); return;
    }

    // Trigger download via temporary anchor
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', `${reportType}_report.csv`);

    // Pass auth token via fetch + blob for authenticated endpoints
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.blob();
      })
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        a.href = blobUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        Toast.success('Export', `${reportType} report downloaded.`);
      })
      .catch(err => {
        console.error('CSV export error:', err);
        Toast.error('Export Failed', err.message || 'Could not download report.');
      });
  },

  /** Format a number to 2dp with en-IN locale grouping */
  _shortNum(v) {
    if (v >= 1_00_000) return '₹' + (v / 1_00_000).toFixed(1) + 'L';
    if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K';
    return v.toFixed(0);
  }
};

// ─── Module-level helper (mirrors invoiceController fmt) ─────────────────────
function fmt(v) {
  return parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

