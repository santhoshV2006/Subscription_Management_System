/**
 * Brightloop — Authentication State Manager
 */
const Auth = {
  user: null,

  /**
   * Initialize auth state from localStorage.
   */
  init() {
    API.init();
    const storedUser = localStorage.getItem('bl_user');
    if (storedUser) {
      try {
        this.user = JSON.parse(storedUser);
      } catch {
        this.user = null;
      }
    }
  },

  /**
   * Check if user is authenticated.
   */
  isAuthenticated() {
    return !!this.user && !!API.accessToken;
  },

  /**
   * Get current user.
   */
  getUser() {
    return this.user;
  },

  /**
   * Get user role.
   */
  getRole() {
    return this.user?.role || null;
  },

  /**
   * Store user data after login/register.
   */
  setUser(userData, tokens) {
    this.user = userData;
    localStorage.setItem('bl_user', JSON.stringify(userData));
    if (tokens) {
      API.setTokens(tokens.accessToken, tokens.refreshToken);
    }
  },

  /**
   * Register a new customer account.
   */
  async register(name, email, password, confirmPassword) {
    const result = await API.post('/auth/register', { name, email, password, confirmPassword });
    if (result.success) {
      this.setUser(result.data.user, {
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken
      });
    }
    return result;
  },

  /**
   * Login with email and password.
   */
  async login(email, password) {
    const result = await API.post('/auth/login', { email, password });
    if (result.success) {
      this.setUser(result.data.user, {
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken
      });
    }
    return result;
  },

  /**
   * Logout.
   */
  async logout(silent = false) {
    try {
      await API.post('/auth/logout', {});
    } catch (e) {
      // Ignore errors during logout
    }
    this.user = null;
    API.clearTokens();
    if (!silent) {
      Router.navigate('/login');
      Toast.success('Logged out', 'You have been logged out successfully.');
    }
  },

  /**
   * Forgot password request.
   */
  async forgotPassword(email) {
    return API.post('/auth/forgot-password', { email });
  },

  /**
   * Reset password with token.
   */
  async resetPassword(token, password, confirmPassword) {
    return API.post(`/auth/reset-password/${token}`, { password, confirmPassword });
  },

  /**
   * Get current user profile from server.
   */
  async fetchProfile() {
    const result = await API.get('/auth/profile');
    if (result.success) {
      this.user = { ...this.user, ...result.data.user };
      localStorage.setItem('bl_user', JSON.stringify(this.user));
    }
    return result;
  },

  /**
   * Update user profile.
   */
  async updateProfile(name) {
    return API.put('/auth/profile', { name });
  },

  /**
   * Change password.
   */
  async changePassword(currentPassword, newPassword) {
    return API.put('/auth/change-password', { currentPassword, newPassword });
  },

  /**
   * Check if user has a specific role.
   */
  hasRole(...roles) {
    return roles.includes(this.getRole());
  }
};
