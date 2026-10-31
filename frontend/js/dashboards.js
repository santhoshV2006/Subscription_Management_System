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
        { id: 'products', path: '/dashboard/admin/products', icon: 'inventory_2', label: 'Products' },
        { id: 'plans', path: '/dashboard/admin/plans', icon: 'subscriptions', label: 'Plans' },
        { id: 'pricing-calculator', path: '/dashboard/admin/pricing-calculator', icon: 'calculate', label: 'Pricing Calculator' },
        { id: 'profile', path: '/dashboard/staff/profile', icon: 'person', label: 'My Profile' },
      ],
      customer: [
        { id: 'dashboard', path: '/dashboard/customer', icon: 'dashboard', label: 'Dashboard' },
        { id: 'pricing-calculator', path: '/dashboard/admin/pricing-calculator', icon: 'calculate', label: 'Price Estimator' },
        { id: 'profile', path: '/dashboard/customer/profile', icon: 'person', label: 'My Profile' },
      ]
    };
    return items[role] || items.customer;
  },

  getPageTitle(activePage) {
    const titles = {
      dashboard: 'Dashboard',
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
    const result = await API.get('/users/dashboard-stats');
    if (!result.success) {
      return this.layout('dashboard', '<p>Failed to load dashboard data.</p>');
    }

    const { stats, recentUsers, recentActivity } = result.data;
    const user = Auth.getUser();

    const content = `
      <div class="welcome-banner">
        <h2>Welcome back, ${user?.name?.split(' ')[0]} 👋</h2>
        <p>Here's an overview of your system. You have full administrative access to manage users, subscriptions, and settings.</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card primary">
          <div class="stat-icon">
            <span class="material-icons-round">group</span>
          </div>
          <div class="stat-value">${stats.totalUsers}</div>
          <div class="stat-label">Total Users</div>
        </div>
        <div class="stat-card success">
          <div class="stat-icon">
            <span class="material-icons-round">verified_user</span>
          </div>
          <div class="stat-value">${stats.activeUsers}</div>
          <div class="stat-label">Active Users</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-icon">
            <span class="material-icons-round">badge</span>
          </div>
          <div class="stat-value">${stats.staffCount}</div>
          <div class="stat-label">Staff Members</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-icon">
            <span class="material-icons-round">people</span>
          </div>
          <div class="stat-value">${stats.customerCount}</div>
          <div class="stat-label">Customers</div>
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

  staffDashboard() {
    const user = Auth.getUser();

    const content = `
      <div class="welcome-banner">
        <h2>Welcome, ${user?.name?.split(' ')[0]} 👋</h2>
        <p>You have staff access to daily business operations. Use the navigation to manage subscriptions and invoices.</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card primary">
          <div class="stat-icon">
            <span class="material-icons-round">assignment</span>
          </div>
          <div class="stat-value">—</div>
          <div class="stat-label">Active Subscriptions</div>
        </div>
        <div class="stat-card success">
          <div class="stat-icon">
            <span class="material-icons-round">receipt_long</span>
          </div>
          <div class="stat-value">—</div>
          <div class="stat-label">Pending Invoices</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-icon">
            <span class="material-icons-round">support_agent</span>
          </div>
          <div class="stat-value">—</div>
          <div class="stat-label">Support Tickets</div>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-card">
          <div class="info-card-header">
            <div class="info-card-icon">
              <span class="material-icons-round">subscriptions</span>
            </div>
            <h3 class="info-card-title">Subscription Management</h3>
          </div>
          <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            Manage customer subscriptions, process renewals, and handle cancellation requests.
            This section will be available when Module 2 is integrated.
          </p>
        </div>
        <div class="info-card">
          <div class="info-card-header">
            <div class="info-card-icon">
              <span class="material-icons-round">payments</span>
            </div>
            <h3 class="info-card-title">Invoice Processing</h3>
          </div>
          <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            Generate, send, and track invoices for customer subscriptions.
            This section will be available when Module 3 is integrated.
          </p>
        </div>
      </div>
    `;

    return this.layout('dashboard', content);
  },

  // ─── Customer Dashboard ───────────────────────────────────────────────────────

  customerDashboard() {
    const user = Auth.getUser();

    const content = `
      <div class="welcome-banner">
        <h2>Welcome, ${user?.name?.split(' ')[0]} 👋</h2>
        <p>View and manage your subscriptions, billing history, and account settings from your personal dashboard.</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card primary">
          <div class="stat-icon">
            <span class="material-icons-round">subscriptions</span>
          </div>
          <div class="stat-value">—</div>
          <div class="stat-label">My Subscriptions</div>
        </div>
        <div class="stat-card success">
          <div class="stat-icon">
            <span class="material-icons-round">receipt</span>
          </div>
          <div class="stat-value">—</div>
          <div class="stat-label">My Invoices</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-icon">
            <span class="material-icons-round">calendar_today</span>
          </div>
          <div class="stat-value">—</div>
          <div class="stat-label">Next Billing</div>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-card">
          <div class="info-card-header">
            <div class="info-card-icon">
              <span class="material-icons-round">list_alt</span>
            </div>
            <h3 class="info-card-title">Your Subscriptions</h3>
          </div>
          <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            View your active subscriptions, manage plans, and track renewal dates.
            This section will be available when the Subscription module is integrated.
          </p>
          <button class="btn btn-outline btn-sm" style="margin-top: 16px;" disabled>
            <span class="material-icons-round" style="font-size: 16px;">visibility</span>
            View Subscriptions
          </button>
        </div>
        <div class="info-card">
          <div class="info-card-header">
            <div class="info-card-icon">
              <span class="material-icons-round">description</span>
            </div>
            <h3 class="info-card-title">Your Invoices</h3>
          </div>
          <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            Access your billing history, download invoices, and review payment records.
            This section will be available when the Invoice module is integrated.
          </p>
          <button class="btn btn-outline btn-sm" style="margin-top: 16px;" disabled>
            <span class="material-icons-round" style="font-size: 16px;">download</span>
            View Invoices
          </button>
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
