/**
 * Brightloop — Application Entry Point
 */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize auth state
  Auth.init();

  // Initialize components
  Toast.init();
  Loading.init();

  // Initialize router (this will render the initial page)
  Router.init();

  console.log('🚀 Brightloop Software initialized');
});
