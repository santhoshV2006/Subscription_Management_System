/**
 * Brightloop — Dashboard Views (Admin, Staff, Customer)
 */
const Dashboards = {

  // ─── Sidebar Layout Wrapper ───────────────────────────────────────────────────

  layout(activePage, content) {
    const user = Auth.getUser();
    const role = Auth.getRole();

    const navItems = this.getNavItems(role);

    return `
      <div class="dashboard-layout">
        <!-- Sidebar Backdrop (mobile) -->
        <div class="sidebar-backdrop" id="sidebar-backdrop" onclick="Dashboards.closeMobileSidebar()"></div>

        <!-- Sidebar -->
        <aside class="sidebar" id="sidebar">
          <button class="sidebar-mobile-close" onclick="Dashboards.closeMobileSidebar()">
            <span class="material-icons-round">close</span>
          </button>
          <div class="sidebar-header">
            <div class="sidebar-logo">
              <span class="material-icons-round">all_inclusive</span>
            </div>
            <div class="sidebar-brand">
              <span class="sidebar-brand-name">Brightloop</span>
              <span class="sidebar-brand-sub">${role} Portal</span>
            </div>
          </div>

          <nav class="sidebar-nav">
            <div class="sidebar-section-label">Main</div>
            ${navItems.map(item => `
              <a class="sidebar-link ${activePage === item.id ? 'active' : ''}"
                 onclick="Router.navigate('${item.path}')" id="nav-${item.id}">
                <span class="material-icons-round">${item.icon}</span>
                ${item.label}
                ${item.badge ? `<span class="badge">${item.badge}</span>` : ''}
              </a>
            `).join('')}
          </nav>

          <div class="sidebar-footer">
            <div class="sidebar-user">
              <div class="sidebar-avatar">${getInitials(user?.name)}</div>
              <div class="sidebar-user-info">
                <div class="sidebar-user-name">${user?.name || 'User'}</div>
                <div class="sidebar-user-role">${role}</div>
              </div>
              <button class="sidebar-logout" onclick="Auth.logout()" title="Logout">
                <span class="material-icons-round">logout</span>
              </button>
            </div>
          </div>
        </aside>

        <!-- Main Content -->
        <main class="main-content">
          <header class="topbar">
            <div class="topbar-left">
              <button class="mobile-menu-toggle" onclick="Dashboards.openMobileSidebar()">
                <span class="material-icons-round">menu</span>
              </button>
              <h1 class="topbar-title" id="topbar-title">${this.getPageTitle(activePage)}</h1>
            </div>
            <div class="topbar-right">
              <button class="btn btn-ghost btn-icon" onclick="Router.navigate('/dashboard/${role}/profile')" title="Profile">
                <span class="material-icons-round">account_circle</span>
              </button>
              <button class="btn btn-ghost btn-icon" onclick="Auth.logout()" title="Logout">
                <span class="material-icons-round">logout</span>
              </button>
            </div>
          </header>
          <div class="page-content fade-in-up">
            ${content}
          </div>
        </main>
      </div>
    `;
  },

  openMobileSidebar() {
    document.getElementById('sidebar')?.classList.add('open');
    document.getElementById('sidebar-backdrop')?.classList.add('show');
  },

  closeMobileSidebar() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-backdrop')?.classList.remove('show');
  },

  getNavItems(role) {
    const items = {
      admin: [
        { id: 'dashboard', path: '/dashboard/admin', icon: 'dashboard', label: 'Dashboard' },
        { id: 'subscriptions', path: '/dashboard/admin/subscriptions', icon: 'auto_stories', label: 'Subscriptions' },
        { id: 'quotations', path: '/dashboard/admin/quotations', icon: 'request_quote', label: 'Quotations' },
        { id: 'invoices', path: '/dashboard/admin/invoices', icon: 'receipt_long', label: 'Invoices' },
        { id: 'financial', path: '/dashboard/admin/financial', icon: 'bar_chart', label: 'Financial Reports' },
        { id: 'products', path: '/dashboard/admin/products', icon: 'inventory_2', label: 'Products & Variants' },
        { id: 'plans', path: '/dashboard/admin/plans', icon: 'subscriptions', label: 'Subscription Plans' },
        { id: 'taxes', path: '/dashboard/admin/taxes', icon: 'receipt_long', label: 'Tax Rules' },
        { id: 'discounts', path: '/dashboard/admin/discounts', icon: 'local_offer', label: 'Discounts & Vouchers' },
        { id: 'pricing-calculator', path: '/dashboard/admin/pricing-calculator', icon: 'calculate', label: 'Pricing Simulator' },
        { id: 'users', path: '/dashboard/admin/users', icon: 'group', label: 'User Management' },
        { id: 'staff', path: '/dashboard/admin/staff', icon: 'badge', label: 'Create Staff' },
        { id: 'profile', path: '/dashboard/admin/profile', icon: 'person', label: 'My Profile' },
      ],
      staff: [
        { id: 'dashboard', path: '/dashboard/staff', icon: 'dashboard', label: 'Dashboard' },
        { id: 'subscriptions', path: '/dashboard/staff/subscriptions', icon: 'auto_stories', label: 'Subscriptions' },
        { id: 'quotations', path: '/dashboard/staff/quotations', icon: 'request_quote', label: 'Quotations' },
        { id: 'invoices', path: '/dashboard/staff/invoices', icon: 'receipt_long', label: 'Invoices' },
        { id: 'financial', path: '/dashboard/staff/financial', icon: 'bar_chart', label: 'Financial Reports' },
        { id: 'products', path: '/dashboard/admin/products', icon: 'inventory_2', label: 'Products' },
        { id: 'plans', path: '/dashboard/admin/plans', icon: 'subscriptions', label: 'Plans' },
        { id: 'pricing-calculator', path: '/dashboard/admin/pricing-calculator', icon: 'calculate', label: 'Pricing Calculator' },
        { id: 'profile', path: '/dashboard/staff/profile', icon: 'person', label: 'My Profile' },
      ],
      customer: [
        { id: 'dashboard', path: '/dashboard/customer', icon: 'dashboard', label: 'Dashboard' },
        { id: 'subscriptions', path: '/dashboard/customer/subscriptions', icon: 'auto_stories', label: 'My Subscriptions' },
        { id: 'quotations', path: '/dashboard/customer/quotations', icon: 'request_quote', label: 'My Quotations' },
        { id: 'invoices', path: '/dashboard/customer/invoices', icon: 'receipt_long', label: 'My Invoices' },
        { id: 'pricing-calculator', path: '/dashboard/admin/pricing-calculator', icon: 'calculate', label: 'Price Estimator' },
        { id: 'profile', path: '/dashboard/customer/profile', icon: 'person', label: 'My Profile' },
      ]
    };
    return items[role] || items.customer;
  },

  getPageTitle(activePage) {
    const titles = {
      dashboard: 'Dashboard',
      subscriptions: 'Subscription Management',
      quotations: 'Quotation & Template Management',
      invoices: 'Invoice Management',
      financial: 'Financial Dashboard \& Reports',
      products: 'Product & Variant Management',
      plans: 'Subscription Plan Management',
      taxes: 'Tax Rule Management',
      discounts: 'Discount & Voucher Management',
      'pricing-calculator': 'Live Pricing & Quotation Simulator',
      users: 'User Management',
      staff: 'Create Staff Account',
      profile: 'My Profile'
    };
    return titles[activePage] || 'Dashboard';
  },

  // ─── Admin Dashboard ──────────────────────────────────────────────────────────

  async adminDashboard() {
    const [result, subStatsRes, recentSubsRes] = await Promise.all([
      API.get('/users/dashboard-stats'),
      API.get('/subscriptions/stats').catch(() => ({ success: false })),
      API.get('/subscriptions?limit=5').catch(() => ({ success: false }))
    ]);

    if (!result.success) {
      return this.layout('dashboard', '<p>Failed to load dashboard data.</p>');
    }

    const { stats, recentUsers, recentActivity } = result.data;
    const subStats = subStatsRes.success ? subStatsRes.data : { active_subscriptions: 0, total_subscriptions: 0, total_quotations: 0, active_annual_value: 0 };
    const recentSubs = recentSubsRes.success ? recentSubsRes.data.subscriptions : [];
    const user = Auth.getUser();

    const content = `
      <div class="welcome-banner">
        <h2>Welcome back, ${user?.name?.split(' ')[0]} 👋</h2>
        <p>Full administrative command center for Brightloop. Manage subscriptions, quotations, products, plans, tax rules, and system users.</p>
      </div>

      <!-- Quick Actions Toolbar -->
      <div class="card mb-4" style="background: var(--surface-card); border: 1px solid var(--gray-200); padding: 16px 20px;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
          <div style="font-weight: 600; font-size: 14px; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
            <span class="material-icons-round" style="color: var(--primary-600); font-size: 20px;">bolt</span>
            Quick Actions:
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <button class="btn btn-sm btn-primary" onclick="Module3.openCreateSubscriptionModal()">
              <span class="material-icons-round" style="font-size: 16px;">add</span> New Subscription
            </button>
            <button class="btn btn-sm btn-secondary" onclick="Module3.openCreateQuotationModal()">
              <span class="material-icons-round" style="font-size: 16px;">request_quote</span> Create Quotation
            </button>
            <button class="btn btn-sm btn-outline" onclick="Module2.openProductModal()">
              <span class="material-icons-round" style="font-size: 16px;">inventory_2</span> Add Product
            </button>
            <button class="btn btn-sm btn-outline" onclick="Module2.openPlanModal()">
              <span class="material-icons-round" style="font-size: 16px;">subscriptions</span> Create Plan
            </button>
            <button class="btn btn-sm btn-outline" onclick="Router.navigate('/dashboard/admin/staff')">
              <span class="material-icons-round" style="font-size: 16px;">badge</span> Add Staff
            </button>
            <button class="btn btn-sm btn-ghost" onclick="Router.navigate('/dashboard/admin/pricing-calculator')">
              <span class="material-icons-round" style="font-size: 16px;">calculate</span> Simulator
            </button>
          </div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card primary">
          <div class="stat-icon">
            <span class="material-icons-round">subscriptions</span>
          </div>
          <div class="stat-value">${subStats.active_subscriptions || 0}</div>
          <div class="stat-label">Active Subscriptions</div>
        </div>
        <div class="stat-card success">
          <div class="stat-icon">
            <span class="material-icons-round">payments</span>
          </div>
          <div class="stat-value">₹${(subStats.active_annual_value || 0).toLocaleString('en-IN')}</div>
          <div class="stat-label">Active Contract Value</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-icon">
            <span class="material-icons-round">request_quote</span>
          </div>
          <div class="stat-value">${subStats.total_quotations || 0}</div>
          <div class="stat-label">Total Quotations</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-icon">
            <span class="material-icons-round">group</span>
          </div>
          <div class="stat-value">${stats.totalUsers}</div>
          <div class="stat-label">System Users (${stats.activeUsers} active)</div>
        </div>
      </div>

      <!-- Recent Subscriptions Overview -->
      <div class="card mb-4">
        <div class="card-header">
          <h3 class="card-title">Recent Subscriptions</h3>
          <a class="btn btn-ghost btn-sm" onclick="Router.navigate('/dashboard/admin/subscriptions')">View all</a>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Subscription #</th>
                <th>Customer</th>
                <th>Plan</th>
                <th>Start Date</th>
                <th>Total</th>
                <th>Status</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${recentSubs.length === 0 ? `
                <tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px;">No subscriptions found</td></tr>
              ` : recentSubs.map(s => `
                <tr>
                  <td><strong class="font-mono text-primary cursor-pointer" onclick="Module3.viewSubscription(${s.id})">${s.subscription_number}</strong></td>
                  <td>${s.customer_name || 'Customer'}</td>
                  <td><span class="badge-role" style="background: rgba(37,99,235,0.1); color: var(--primary-600);">${s.plan_name}</span></td>
                  <td style="color: var(--text-muted); font-size: 13px;">${DateUtils.format(s.start_date)}</td>
                  <td class="font-mono fw-bold">₹${parseFloat(s.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td>${Module3.renderStatusBadge(s.status)}</td>
                  <td style="text-align: right;">
                    <button class="btn btn-sm btn-outline" onclick="Module3.viewSubscription(${s.id})">Details</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Recent Users</h3>
            <a class="btn btn-ghost btn-sm" onclick="Router.navigate('/dashboard/admin/users')">View all</a>
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                ${recentUsers.length === 0 ? `
                  <tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 32px;">No users yet</td></tr>
                ` : recentUsers.map(u => `
                  <tr>
                    <td>
                      <div class="user-cell">
                        <div class="user-avatar ${u.role}">${getInitials(u.name)}</div>
                        <div class="user-info">
                          <div class="user-name-text">${u.name}</div>
                          <div class="user-email-text">${u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span class="badge-role ${u.role}">${u.role}</span></td>
                    <td style="color: var(--text-muted); font-size: 13px;">${DateUtils.timeAgo(u.created_at)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Recent Activity</h3>
          </div>
          <div class="card-body">
            <div class="activity-feed">
              ${recentActivity.length === 0 ? `
                <div class="empty-state" style="padding: 32px 0;">
                  <p style="color: var(--text-muted);">No activity yet</p>
                </div>
              ` : recentActivity.map(a => `
                <div class="activity-item">
                  <div class="activity-dot"></div>
                  <div class="activity-content">
                    <div class="activity-text">
                      <strong>${a.user_name || 'System'}</strong> — ${a.details || a.action}
                    </div>
                    <div class="activity-time">${DateUtils.timeAgo(a.created_at)}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    return this.layout('dashboard', content);
  },

  // ─── Admin: User Management ───────────────────────────────────────────────────

  async adminUsers(queryParams = {}) {
    const params = new URLSearchParams({
      page: queryParams.page || 1,
      limit: 15,
      ...(queryParams.role && { role: queryParams.role }),
      ...(queryParams.search && { search: queryParams.search }),
      ...(queryParams.status && { status: queryParams.status })
    });

    const result = await API.get(`/users?${params}`);
    const users = result.success ? result.data.users : [];
    const pagination = result.success ? result.data.pagination : { total: 0, page: 1, totalPages: 1 };

    const content = `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">All Users (${pagination.total})</h3>
          <button class="btn btn-primary btn-sm" onclick="Router.navigate('/dashboard/admin/staff')">
            <span class="material-icons-round" style="font-size: 18px;">person_add</span>
            Add Staff
          </button>
        </div>

        <div style="padding: 16px 24px; border-bottom: 1px solid var(--gray-100);">
          <div class="filter-bar">
            <div class="search-bar" style="flex: 1;">
              <span class="material-icons-round">search</span>
              <input type="text" placeholder="Search users..." id="user-search-input"
                     value="${queryParams.search || ''}"
                     onkeyup="if(event.key==='Enter') Dashboards.filterUsers()">
            </div>
            <select class="filter-select" id="filter-role" onchange="Dashboards.filterUsers()">
              <option value="">All Roles</option>
              <option value="admin" ${queryParams.role === 'admin' ? 'selected' : ''}>Admin</option>
              <option value="staff" ${queryParams.role === 'staff' ? 'selected' : ''}>Staff</option>
              <option value="customer" ${queryParams.role === 'customer' ? 'selected' : ''}>Customer</option>
            </select>
            <select class="filter-select" id="filter-status" onchange="Dashboards.filterUsers()">
              <option value="">All Status</option>
              <option value="active" ${queryParams.status === 'active' ? 'selected' : ''}>Active</option>
              <option value="inactive" ${queryParams.status === 'inactive' ? 'selected' : ''}>Inactive</option>
            </select>
          </div>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${users.length === 0 ? `
                <tr><td colspan="6">
                  <div class="empty-state">
                    <div class="empty-state-icon"><span class="material-icons-round">group_off</span></div>
                    <h3>No users found</h3>
                    <p>Try adjusting your search or filter criteria.</p>
                  </div>
                </td></tr>
              ` : users.map(u => `
                <tr>
                  <td>
                    <div class="user-cell">
                      <div class="user-avatar ${u.role}">${getInitials(u.name)}</div>
                      <div class="user-info">
                        <div class="user-name-text">${u.name}</div>
                        <div class="user-email-text">${u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><span class="badge-role ${u.role}">${u.role}</span></td>
                  <td>
                    <span class="badge-status ${u.is_active ? 'active' : 'inactive'}">
                      <span class="badge-status-dot"></span>
                      ${u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style="color: var(--text-muted); font-size: 13px;">${DateUtils.timeAgo(u.last_login)}</td>
                  <td style="color: var(--text-muted); font-size: 13px;">${DateUtils.format(u.created_at)}</td>
                  <td>
                    <div class="table-actions">
                      <button class="btn-icon btn-secondary" title="${u.is_active ? 'Deactivate' : 'Activate'}"
                              onclick="Dashboards.toggleUserStatus('${u.uuid}', ${u.is_active})">
                        <span class="material-icons-round">${u.is_active ? 'block' : 'check_circle'}</span>
                      </button>
                      <button class="btn-icon btn-secondary" title="Delete user"
                              onclick="Dashboards.confirmDeleteUser('${u.uuid}', '${u.name}')">
                        <span class="material-icons-round" style="color: var(--danger-500);">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        ${pagination.totalPages > 1 ? `
          <div class="pagination">
            <div class="pagination-info">
              Showing ${((pagination.page - 1) * 15) + 1}–${Math.min(pagination.page * 15, pagination.total)} of ${pagination.total}
            </div>
            <div class="pagination-controls">
              <button class="pagination-btn" ${pagination.page <= 1 ? 'disabled' : ''}
                      onclick="Dashboards.goToPage(${pagination.page - 1})">
                <span class="material-icons-round" style="font-size: 18px;">chevron_left</span>
              </button>
              ${Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                const p = i + 1;
                return `<button class="pagination-btn ${p === pagination.page ? 'active' : ''}"
                                onclick="Dashboards.goToPage(${p})">${p}</button>`;
              }).join('')}
              <button class="pagination-btn" ${pagination.page >= pagination.totalPages ? 'disabled' : ''}
                      onclick="Dashboards.goToPage(${pagination.page + 1})">
                <span class="material-icons-round" style="font-size: 18px;">chevron_right</span>
              </button>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    return this.layout('users', content);
  },

  filterUsers() {
    const search = document.getElementById('user-search-input')?.value?.trim() || '';
    const role = document.getElementById('filter-role')?.value || '';
    const status = document.getElementById('filter-status')?.value || '';
    Router.navigate('/dashboard/admin/users', { search, role, status });
  },

  goToPage(page) {
    const search = document.getElementById('user-search-input')?.value?.trim() || '';
    const role = document.getElementById('filter-role')?.value || '';
    const status = document.getElementById('filter-status')?.value || '';
    Router.navigate('/dashboard/admin/users', { search, role, status, page });
  },

  async toggleUserStatus(uuid, currentlyActive) {
    const action = currentlyActive ? 'deactivate' : 'activate';
    Confirm.show(
      `${currentlyActive ? 'Deactivate' : 'Activate'} User`,
      `Are you sure you want to ${action} this user? ${currentlyActive ? 'They will be logged out immediately.' : ''}`,
      async () => {
        const result = await API.patch(`/users/${uuid}/status`, { is_active: !currentlyActive });
        if (result.success) {
          Toast.success('Success', result.message);
          Router.navigate('/dashboard/admin/users');
        } else {
          Toast.error('Error', result.message);
        }
      },
      currentlyActive ? 'Deactivate' : 'Activate',
      currentlyActive
    );
  },

  confirmDeleteUser(uuid, name) {
    Confirm.show(
      'Delete User',
      `Are you sure you want to permanently delete <strong>${name}</strong>? This action cannot be undone.`,
      async () => {
        const result = await API.delete(`/users/${uuid}`);
        if (result.success) {
          Toast.success('Deleted', result.message);
          Router.navigate('/dashboard/admin/users');
        } else {
          Toast.error('Error', result.message);
        }
      },
      'Delete',
      true
    );
  },

  // ─── Admin: Create Staff ──────────────────────────────────────────────────────

  createStaff() {
    const content = `
      <div style="max-width: 580px;">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">New Staff Account</h3>
          </div>
          <div class="card-body">
            <p style="color: var(--text-secondary); margin-bottom: 24px;">
              Create a new staff account with limited access to daily business operations. The staff member will receive their login credentials.
            </p>
            <form id="staff-form" onsubmit="Dashboards.handleCreateStaff(event)">
              ${FormUtils.inputGroup('staff-name', 'Full Name', 'text', 'Enter staff member name', 'person')}
              ${FormUtils.inputGroup('staff-email', 'Email Address', 'email', 'Enter email address', 'mail')}
              ${FormUtils.inputGroup('staff-password', 'Password', 'password', 'Create a strong password', 'lock',
                '<div id="staff-password-reqs"></div>'
              )}

              <div style="display: flex; gap: 10px; margin-top: 28px;">
                <button type="submit" id="staff-btn" class="btn btn-primary">
                  <span class="material-icons-round" style="font-size: 18px;">person_add</span>
                  Create Staff Account
                </button>
                <button type="button" class="btn btn-secondary" onclick="Router.navigate('/dashboard/admin/users')">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    return this.layout('staff', content);
  },

  initStaffPage() {
    const passwordInput = document.getElementById('staff-password');
    if (passwordInput) {
      passwordInput.addEventListener('input', (e) => {
        const reqsContainer = document.getElementById('staff-password-reqs');
        if (reqsContainer) {
          reqsContainer.innerHTML = FormUtils.passwordRequirements(e.target.value);
        }
      });
    }
  },

  async handleCreateStaff(e) {
    e.preventDefault();
    FormUtils.clearAllErrors('staff-form');

    const name = document.getElementById('staff-name').value.trim();
    const email = document.getElementById('staff-email').value.trim();
    const password = document.getElementById('staff-password').value;

    let hasError = false;
    if (!name || name.length < 2) { FormUtils.showError('staff-name', 'Name must be at least 2 characters'); hasError = true; }
    if (!email) { FormUtils.showError('staff-email', 'Email is required'); hasError = true; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { FormUtils.showError('staff-email', 'Invalid email address'); hasError = true; }

    const pwErrors = FormUtils.validatePassword(password);
    if (pwErrors.length > 0) { FormUtils.showError('staff-password', pwErrors[0]); hasError = true; }
    if (hasError) return;

    FormUtils.setLoading('staff-btn', true, '<span class="material-icons-round" style="font-size: 18px;">person_add</span> Create Staff Account');

    const result = await API.post('/users/staff', { name, email, password });

    if (result.success) {
      Toast.success('Staff Created', `Account created for ${email}`);
      Router.navigate('/dashboard/admin/users');
    } else {
      Toast.error('Error', result.message);
      if (result.errors) {
        result.errors.forEach(err => Toast.error('Validation', err));
      }
    }

    FormUtils.setLoading('staff-btn', false, '<span class="material-icons-round" style="font-size: 18px;">person_add</span> Create Staff Account');
  },

  // ─── Staff Dashboard ──────────────────────────────────────────────────────────

  async staffDashboard() {
    const user = Auth.getUser();

    const [statsRes, subsRes] = await Promise.all([
      API.get('/subscriptions/stats'),
      API.get('/subscriptions?limit=5')
    ]);

    const stats = statsRes.success ? statsRes.data : { total_subscriptions: 0, active_subscriptions: 0, paused_subscriptions: 0, total_quotations: 0, active_annual_value: 0 };
    const subscriptions = subsRes.success ? subsRes.data.subscriptions : [];

    const content = `
      <div class="welcome-banner">
        <h2>Welcome, ${user?.name?.split(' ')[0]} 👋</h2>
        <p>Operational workspace for managing customer subscriptions, drafting quotes, and monitoring service agreements.</p>
      </div>

      <div class="stats-grid mb-4">
        <div class="stat-card primary">
          <div class="stat-icon"><span class="material-icons-round">subscriptions</span></div>
          <div class="stat-value">${stats.active_subscriptions}</div>
          <div class="stat-label">Active Subscriptions</div>
        </div>
        <div class="stat-card success">
          <div class="stat-icon"><span class="material-icons-round">request_quote</span></div>
          <div class="stat-value">${stats.total_quotations}</div>
          <div class="stat-label">Total Quotations</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-icon"><span class="material-icons-round">pause_circle</span></div>
          <div class="stat-value">${stats.paused_subscriptions}</div>
          <div class="stat-label">Paused Contracts</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon"><span class="material-icons-round">payments</span></div>
          <div class="stat-value">₹${stats.active_annual_value.toLocaleString('en-IN')}</div>
          <div class="stat-label">Active Contract Value</div>
        </div>
      </div>

      <!-- Quick Action Buttons -->
      <div class="mb-4 d-flex gap-2">
        <button class="btn btn-primary" onclick="Module3.openCreateSubscriptionModal()">
          <span class="material-icons-round">add</span> New Customer Subscription
        </button>
        <button class="btn btn-secondary" onclick="Module3.openCreateQuotationModal()">
          <span class="material-icons-round">request_quote</span> Create Quotation
        </button>
        <button class="btn btn-outline" onclick="Router.navigate('/dashboard/staff/subscriptions')">
          <span class="material-icons-round">list</span> View All Subscriptions
        </button>
      </div>

      <!-- Recent Subscriptions -->
      <div class="card mb-4 p-0 overflow-hidden">
        <div class="card-header flex-between p-3 border-bottom">
          <h3 class="card-title text-base">Recent Subscriptions</h3>
          <a class="text-sm text-primary cursor-pointer" onclick="Router.navigate('/dashboard/staff/subscriptions')">View All &rarr;</a>
        </div>
        <div class="table-responsive">
          <table class="table mb-0 text-sm">
            <thead>
              <tr>
                <th>Subscription #</th>
                <th>Customer</th>
                <th>Plan</th>
                <th>Start Date</th>
                <th>Total</th>
                <th>Status</th>
                <th class="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              ${subscriptions.length === 0 ? `
                <tr><td colspan="7" class="text-center py-4 text-muted">No subscriptions found.</td></tr>
              ` : subscriptions.map(s => `
                <tr>
                  <td><strong class="font-mono text-primary cursor-pointer" onclick="Module3.viewSubscription(${s.id})">${s.subscription_number}</strong></td>
                  <td>${s.customer_name}</td>
                  <td><span class="badge badge-outline-blue">${s.plan_name}</span></td>
                  <td>${DateUtils.format(s.start_date)}</td>
                  <td class="font-mono fw-bold">₹${parseFloat(s.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td>${Module3.renderStatusBadge(s.status)}</td>
                  <td class="text-right">
                    <button class="btn btn-sm btn-outline" onclick="Module3.viewSubscription(${s.id})">Details</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    return this.layout('dashboard', content);
  },

  // ─── Customer Dashboard ───────────────────────────────────────────────────────

  async customerDashboard() {
    const user = Auth.getUser();

    const [subsRes, quotesRes] = await Promise.all([
      API.get('/subscriptions'),
      API.get('/quotations')
    ]);

    const subscriptions = subsRes.success ? subsRes.data.subscriptions : [];
    const quotations = quotesRes.success ? quotesRes.data.quotations : [];

    const activeSubs = subscriptions.filter(s => s.status === 'Active');
    const totalSpent = subscriptions.reduce((sum, s) => sum + (s.status === 'Active' ? parseFloat(s.total_amount) : 0), 0);
    const nextRenewalSub = activeSubs[0];

    const content = `
      <div class="welcome-banner">
        <h2>Welcome, ${user?.name?.split(' ')[0]} 👋</h2>
        <p>Access your active cloud services, subscription plans, and review issued quotes.</p>
      </div>

      <div class="stats-grid mb-4">
        <div class="stat-card primary">
          <div class="stat-icon"><span class="material-icons-round">subscriptions</span></div>
          <div class="stat-value">${activeSubs.length}</div>
          <div class="stat-label">Active Subscriptions</div>
        </div>
        <div class="stat-card success">
          <div class="stat-icon"><span class="material-icons-round">request_quote</span></div>
          <div class="stat-value">${quotations.length}</div>
          <div class="stat-label">My Quotations</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-icon"><span class="material-icons-round">calendar_today</span></div>
          <div class="stat-value text-sm">${nextRenewalSub ? DateUtils.format(nextRenewalSub.expiry_date) : '—'}</div>
          <div class="stat-label">Next Renewal Date</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon"><span class="material-icons-round">payments</span></div>
          <div class="stat-value font-mono">₹${totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          <div class="stat-label">Current Active Billing</div>
        </div>
      </div>

      <!-- Quick Action Navigation -->
      <div class="mb-4 d-flex gap-2">
        <button class="btn btn-primary" onclick="Router.navigate('/dashboard/customer/subscriptions')">
          <span class="material-icons-round">auto_stories</span> View My Subscriptions
        </button>
        <button class="btn btn-secondary" onclick="Router.navigate('/dashboard/customer/quotations')">
          <span class="material-icons-round">request_quote</span> View My Quotations
        </button>
        <button class="btn btn-outline" onclick="Router.navigate('/dashboard/admin/pricing-calculator')">
          <span class="material-icons-round">calculate</span> Explore Plans & Simulator
        </button>
      </div>

      <!-- Customer Subscriptions List -->
      <div class="card p-0 mb-4 overflow-hidden">
        <div class="card-header flex-between p-3 border-bottom">
          <h3 class="card-title text-base">My Subscriptions</h3>
          <a class="text-sm text-primary cursor-pointer" onclick="Router.navigate('/dashboard/customer/subscriptions')">View All &rarr;</a>
        </div>
        <div class="table-responsive">
          <table class="table mb-0 text-sm">
            <thead>
              <tr>
                <th>Subscription #</th>
                <th>Plan Name</th>
                <th>Billing Cycle</th>
                <th>Current Period</th>
                <th>Total Payable</th>
                <th>Status</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${subscriptions.length === 0 ? `
                <tr><td colspan="7" class="text-center py-4 text-muted">You have no active subscriptions yet.</td></tr>
              ` : subscriptions.map(s => `
                <tr>
                  <td><strong class="font-mono text-primary cursor-pointer" onclick="Module3.viewSubscription(${s.id})">${s.subscription_number}</strong></td>
                  <td><strong>${s.plan_name}</strong></td>
                  <td><span class="text-capitalize">${s.billing_frequency}</span></td>
                  <td>${DateUtils.format(s.start_date)} – ${DateUtils.format(s.expiry_date)}</td>
                  <td class="font-mono fw-bold">₹${parseFloat(s.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td>${Module3.renderStatusBadge(s.status)}</td>
                  <td class="text-right">
                    <button class="btn btn-sm btn-outline" onclick="Module3.viewSubscription(${s.id})">Details</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    return this.layout('dashboard', content);
  },

  // ─── Profile Page (shared) ────────────────────────────────────────────────────

  async profilePage() {
    const profileResult = await Auth.fetchProfile();
    const user = Auth.getUser();
    const role = Auth.getRole();

    const content = `
      <div class="card" style="margin-bottom: 24px;">
        <div class="profile-card">
          <div class="profile-avatar-lg">${getInitials(user?.name)}</div>
          <div class="profile-details">
            <div class="profile-name">${user?.name || ''}</div>
            <div class="profile-email">${user?.email || ''}</div>
            <span class="badge-role ${role}">${role}</span>
            <div class="profile-meta">
              <div class="profile-meta-item">
                <span class="material-icons-round">calendar_today</span>
                Joined ${DateUtils.format(user?.created_at)}
              </div>
              <div class="profile-meta-item">
                <span class="material-icons-round">login</span>
                Last login ${DateUtils.formatFull(user?.last_login)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Update Profile</h3>
          </div>
          <div class="card-body">
            <form id="profile-form" onsubmit="Dashboards.handleUpdateProfile(event)">
              <div class="form-group">
                <label class="form-label" for="profile-name">Full Name</label>
                <div class="form-input-wrapper">
                  <span class="material-icons-round">person</span>
                  <input type="text" id="profile-name" class="form-input" value="${user?.name || ''}">
                </div>
                <div class="form-error" id="profile-name-error" style="display:none"></div>
              </div>
              <div class="form-group">
                <label class="form-label">Email Address</label>
                <div class="form-input-wrapper">
                  <span class="material-icons-round">mail</span>
                  <input type="email" class="form-input" value="${user?.email || ''}" disabled
                         style="opacity: 0.6; cursor: not-allowed;">
                </div>
                <p class="form-hint">Email address cannot be changed.</p>
              </div>
              <button type="submit" id="profile-update-btn" class="btn btn-primary">
                Save Changes
              </button>
            </form>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Change Password</h3>
          </div>
          <div class="card-body">
            <form id="password-form" onsubmit="Dashboards.handleChangePassword(event)">
              ${FormUtils.inputGroup('current-password', 'Current Password', 'password', 'Enter current password', 'lock')}
              ${FormUtils.inputGroup('new-password', 'New Password', 'password', 'Enter new password', 'lock',
                '<div id="change-password-reqs"></div>'
              )}
              ${FormUtils.inputGroup('confirm-new-password', 'Confirm New Password', 'password', 'Confirm new password', 'lock_reset')}

              <button type="submit" id="change-pw-btn" class="btn btn-primary">
                Change Password
              </button>
            </form>
          </div>
        </div>
      </div>
    `;

    return this.layout('profile', content);
  },

  initProfilePage() {
    const passwordInput = document.getElementById('new-password');
    if (passwordInput) {
      passwordInput.addEventListener('input', (e) => {
        const reqsContainer = document.getElementById('change-password-reqs');
        if (reqsContainer) {
          reqsContainer.innerHTML = FormUtils.passwordRequirements(e.target.value);
        }
      });
    }
  },

  async handleUpdateProfile(e) {
    e.preventDefault();
    const name = document.getElementById('profile-name').value.trim();

    if (!name || name.length < 2) {
      FormUtils.showError('profile-name', 'Name must be at least 2 characters');
      return;
    }

    FormUtils.setLoading('profile-update-btn', true, 'Save Changes');

    const result = await Auth.updateProfile(name);

    if (result.success) {
      Toast.success('Updated', 'Profile updated successfully.');
      // Update local user state
      const user = Auth.getUser();
      user.name = result.data.name;
      Auth.setUser(user);
    } else {
      Toast.error('Error', result.message);
    }

    FormUtils.setLoading('profile-update-btn', false, 'Save Changes');
  },

  async handleChangePassword(e) {
    e.preventDefault();
    FormUtils.clearAllErrors('password-form');

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-new-password').value;

    let hasError = false;
    if (!currentPassword) { FormUtils.showError('current-password', 'Current password is required'); hasError = true; }

    const pwErrors = FormUtils.validatePassword(newPassword);
    if (pwErrors.length > 0) { FormUtils.showError('new-password', pwErrors[0]); hasError = true; }
    if (newPassword !== confirmPassword) { FormUtils.showError('confirm-new-password', 'Passwords do not match'); hasError = true; }
    if (hasError) return;

    FormUtils.setLoading('change-pw-btn', true, 'Change Password');

    const result = await Auth.changePassword(currentPassword, newPassword);

    if (result.success) {
      Toast.success('Password Changed', 'Your password has been updated successfully.');
      document.getElementById('password-form').reset();
      const reqsContainer = document.getElementById('change-password-reqs');
      if (reqsContainer) reqsContainer.innerHTML = '';
    } else {
      Toast.error('Error', result.message);
    }

    FormUtils.setLoading('change-pw-btn', false, 'Change Password');
  }
};
