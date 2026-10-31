/**
 * Brightloop — API Client
 * Handles all HTTP communication with the backend, including automatic token refresh.
 */
const API = {
  accessToken: null,
  refreshToken: null,

  /**
   * Initialize tokens from localStorage.
   */
  init() {
    this.accessToken = localStorage.getItem('bl_access_token');
    this.refreshToken = localStorage.getItem('bl_refresh_token');
  },

  /**
   * Store tokens after login/register.
   */
  setTokens(accessToken, refreshToken) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem('bl_access_token', accessToken);
    localStorage.setItem('bl_refresh_token', refreshToken);
  },

  /**
   * Clear tokens on logout.
   */
  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('bl_access_token');
    localStorage.removeItem('bl_refresh_token');
    localStorage.removeItem('bl_user');
  },

  /**
   * Make an authenticated API request.
   */
  async request(endpoint, options = {}) {
    const url = `${CONFIG.API_BASE}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    try {
      let response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include'
      });

      // If 401 with TOKEN_EXPIRED, try refreshing
      if (response.status === 401) {
        const data = await response.json();
        if (data.code === 'TOKEN_EXPIRED' && this.refreshToken) {
          const refreshed = await this.doRefreshToken();
          if (refreshed) {
            // Retry original request with new token
            headers['Authorization'] = `Bearer ${this.accessToken}`;
            response = await fetch(url, {
              ...options,
              headers,
              credentials: 'include'
            });
          } else {
            // Refresh failed, log out
            Auth.logout(true);
            return { success: false, message: 'Session expired. Please log in again.' };
          }
        }
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('API Error:', error);
      return {
        success: false,
        message: 'Network error. Please check your connection.'
      };
    }
  },

  /**
   * Refresh the access token.
   */
  async doRefreshToken() {
    try {
      const response = await fetch(`${CONFIG.API_BASE}/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ refreshToken: this.refreshToken })
      });

      if (!response.ok) return false;

      const data = await response.json();
      if (data.success) {
        this.setTokens(data.data.accessToken, data.data.refreshToken);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  // ─── Convenience Methods ────────────────────────────────────────

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  patch(endpoint, body) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
};
