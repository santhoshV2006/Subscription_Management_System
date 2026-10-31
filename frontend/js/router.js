/**
 * Brightloop — Client-side Router
 * Hash-based routing for the SPA.
 */
const Router = {
  routes: {},
  currentPath: null,
  queryParams: {},

  /**
   * Initialize the router.
   */
  init() {
    // Define routes
    this.routes = {
      '/login': { page: 'login', auth: false },
      '/register': { page: 'register', auth: false },
      '/forgot-password': { page: 'forgotPassword', auth: false },
      '/reset-password': { page: 'resetPassword', auth: false },

      // Admin routes
      '/dashboard/admin': { page: 'adminDashboard', auth: true, roles: ['admin'] },
      '/dashboard/admin/subscriptions': { page: 'adminSubscriptions', auth: true, roles: ['admin', 'staff'] },
      '/dashboard/admin/quotations': { page: 'adminQuotations', auth: true, roles: ['admin', 'staff'] },
      '/dashboard/admin/products': { page: 'adminProducts', auth: true, roles: ['admin', 'staff'] },
      '/dashboard/admin/plans': { page: 'adminPlans', auth: true, roles: ['admin', 'staff'] },
      '/dashboard/admin/taxes': { page: 'adminTaxes', auth: true, roles: ['admin'] },
      '/dashboard/admin/discounts': { page: 'adminDiscounts', auth: true, roles: ['admin'] },
      '/dashboard/admin/pricing-calculator': { page: 'pricingCalculator', auth: true, roles: ['admin', 'staff', 'customer'] },
      '/dashboard/admin/users': { page: 'adminUsers', auth: true, roles: ['admin'] },
      '/dashboard/admin/staff': { page: 'createStaff', auth: true, roles: ['admin'] },
      '/dashboard/admin/profile': { page: 'profilePage', auth: true, roles: ['admin'] },

      // Staff routes
      '/dashboard/staff': { page: 'staffDashboard', auth: true, roles: ['staff'] },
      '/dashboard/staff/subscriptions': { page: 'adminSubscriptions', auth: true, roles: ['staff'] },
      '/dashboard/staff/quotations': { page: 'adminQuotations', auth: true, roles: ['staff'] },
      '/dashboard/staff/profile': { page: 'profilePage', auth: true, roles: ['staff'] },

      // Customer routes
      '/dashboard/customer': { page: 'customerDashboard', auth: true, roles: ['customer'] },
      '/dashboard/customer/subscriptions': { page: 'customerSubscriptions', auth: true, roles: ['customer'] },
      '/dashboard/customer/quotations': { page: 'customerQuotations', auth: true, roles: ['customer'] },
      '/dashboard/customer/profile': { page: 'profilePage', auth: true, roles: ['customer'] },
    };

    // Listen for hash changes
    window.addEventListener('hashchange', () => this.resolve());

    // Handle initial route
    this.resolve();
  },

  /**
   * Navigate to a path.
   */
  navigate(path, queryParams = {}) {
    this.queryParams = queryParams;
    window.location.hash = path;
  },

  /**
   * Resolve the current route.
   */
  async resolve() {
    let path = window.location.hash.slice(1);
    if (!path && window.location.pathname && window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
      path = window.location.pathname;
    }
    if (!path) path = '/login';

    // Handle reset-password with query params
    if (path.includes('?')) {
      path = path.split('?')[0];
    }

    // Also check for query params in the original URL (for reset-password)
    const fullHash = window.location.hash.slice(1);
    if (fullHash.includes('?')) {
      const queryStr = fullHash.split('?')[1];
      const params = new URLSearchParams(queryStr);
      for (const [key, val] of params) {
        this.queryParams[key] = val;
      }
    }

    const route = this.routes[path];

    // Unknown route
    if (!route) {
      if (Auth.isAuthenticated()) {
        this.navigate(`/dashboard/${Auth.getRole()}`);
      } else {
        this.navigate('/login');
      }
      return;
    }

    // Auth required but not logged in
    if (route.auth && !Auth.isAuthenticated()) {
      Toast.warning('Access Denied', 'Please log in to continue.');
      this.navigate('/login');
      return;
    }

    // Already logged in, trying to access auth pages
    if (!route.auth && Auth.isAuthenticated()) {
      this.navigate(`/dashboard/${Auth.getRole()}`);
      return;
    }

    // Role check
    if (route.roles && !route.roles.includes(Auth.getRole())) {
      Toast.error('Forbidden', 'You do not have access to this page.');
      this.navigate(`/dashboard/${Auth.getRole()}`);
      return;
    }

    this.currentPath = path;

    // Render the page
    await this.render(route);
  },

  /**
   * Render a route.
   */
  async render(route) {
    const app = document.getElementById('app');
    const toastContainer = document.getElementById('toast-container');
    const loadingOverlay = document.getElementById('loading-overlay');

    Loading.show();

    try {
      let html = '';

      switch (route.page) {
        case 'login':
          html = Pages.login();
          break;
        case 'register':
          html = Pages.register();
          break;
        case 'forgotPassword':
          html = Pages.forgotPassword();
          break;
        case 'resetPassword':
          html = Pages.resetPassword();
          break;
        case 'adminDashboard':
          html = await Dashboards.adminDashboard();
          break;
        case 'adminSubscriptions':
          html = await Module3.subscriptionsPage(this.queryParams);
          break;
        case 'adminQuotations':
          html = await Module3.quotationsPage(this.queryParams);
          break;
        case 'customerSubscriptions':
          html = await Module3.subscriptionsPage(this.queryParams);
          break;
        case 'customerQuotations':
          html = await Module3.quotationsPage(this.queryParams);
          break;
        case 'adminProducts':
          html = await Module2.productsPage(this.queryParams);
          break;
        case 'adminPlans':
          html = await Module2.plansPage(this.queryParams);
          break;
        case 'adminTaxes':
          html = await Module2.taxesPage();
          break;
        case 'adminDiscounts':
          html = await Module2.discountsPage(this.queryParams);
          break;
        case 'pricingCalculator':
          html = await Module2.pricingCalculatorPage();
          break;
        case 'adminUsers':
          html = await Dashboards.adminUsers(this.queryParams);
          break;
        case 'createStaff':
          html = Dashboards.createStaff();
          break;
        case 'profilePage':
          html = await Dashboards.profilePage();
          break;
        case 'staffDashboard':
          html = await Dashboards.staffDashboard();
          break;
        case 'customerDashboard':
          html = await Dashboards.customerDashboard();
          break;
        default:
          html = '<p>Page not found</p>';
      }

      // Preserve toast container and loading overlay
      app.innerHTML = html;
      app.appendChild(toastContainer);
      app.appendChild(loadingOverlay);

      // Reset query params
      this.queryParams = {};

      // Run page-specific initialization
      this.initPage(route.page);

    } catch (error) {
      console.error('Render error:', error);
      Toast.error('Error', 'Failed to load page.');
    }

    Loading.hide();
  },

  /**
   * Run page-specific initialization logic.
   */
  initPage(page) {
    switch (page) {
      case 'register':
        Pages.initRegisterPage();
        break;
      case 'resetPassword':
        Pages.initResetPage();
        break;
      case 'createStaff':
        Dashboards.initStaffPage();
        break;
      case 'profilePage':
        Dashboards.initProfilePage();
        break;
    }
  }
};
