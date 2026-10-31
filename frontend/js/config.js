/**
 * Brightloop — Configuration
 * Automatically detects whether frontend is served standalone or unified with backend.
 */
const isStandaloneFrontend = typeof window !== 'undefined' && window.location.port !== '3000';

const CONFIG = {
  API_BASE: isStandaloneFrontend ? 'http://localhost:3000/api' : window.location.origin + '/api',
  BACKEND_URL: 'http://localhost:3000',
  APP_NAME: 'Brightloop',
  APP_SUBTITLE: 'Subscription Management System'
};
