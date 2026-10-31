/**
 * Brightloop — Auth Pages (Login, Register, Forgot Password, Reset Password)
 */
const Pages = {

  // ─── Login Page ───────────────────────────────────────────────────────────────

  login() {
    return `
      <div class="auth-layout">
        <div class="auth-branding fade-in">
          <div class="logo">
            <div class="logo-icon">
              <span class="material-icons-round">all_inclusive</span>
            </div>
            <span class="logo-text">Brightloop</span>
          </div>
          <h1>Manage your<br>subscriptions <span>effortlessly</span></h1>
          <p>Streamline billing, track subscriptions, and automate invoicing — all in one powerful platform designed for modern businesses.</p>
          <div class="auth-features">
            <div class="auth-feature">
              <span class="material-icons-round">payments</span>
              Automated billing & invoicing
            </div>
            <div class="auth-feature">
              <span class="material-icons-round">analytics</span>
              Real-time analytics & insights
            </div>
            <div class="auth-feature">
              <span class="material-icons-round">group</span>
              Multi-role team collaboration
            </div>
            <div class="auth-feature">
              <span class="material-icons-round">security</span>
              Enterprise-grade security
            </div>
          </div>
        </div>

        <div class="auth-form-panel">
          <div class="auth-card">
            <h2>Welcome back</h2>
            <p class="auth-subtitle">Sign in to your Brightloop account</p>

            <form id="login-form" onsubmit="Pages.handleLogin(event)">
              ${FormUtils.inputGroup('login-email', 'Email address', 'email', 'Enter your email', 'mail')}
              ${FormUtils.inputGroup('login-password', 'Password', 'password', 'Enter your password', 'lock')}

              <div style="display: flex; justify-content: flex-end; margin-bottom: 20px;">
                <a href="#" onclick="Router.navigate('/forgot-password'); return false;" style="font-size: 13px;">Forgot password?</a>
              </div>

              <button type="submit" id="login-btn" class="btn btn-primary btn-block btn-lg">
                Sign in
              </button>
            </form>

            <div class="auth-links">
              <span style="font-size: 13.5px; color: var(--text-secondary);">Don't have an account?</span>
              <a href="#" onclick="Router.navigate('/register'); return false;">Create account</a>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async handleLogin(e) {
    e.preventDefault();
    FormUtils.clearAllErrors('login-form');

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    let hasError = false;
    if (!email) { FormUtils.showError('login-email', 'Email is required'); hasError = true; }
    if (!password) { FormUtils.showError('login-password', 'Password is required'); hasError = true; }
    if (hasError) return;

    FormUtils.setLoading('login-btn', true, 'Sign in');

    const result = await Auth.login(email, password);

    if (result.success) {
      Toast.success('Welcome!', `Logged in as ${result.data.user.name}`);
      const role = result.data.user.role;
      Router.navigate(`/dashboard/${role}`);
    } else {
      Toast.error('Login failed', result.message);
      if (result.errors) {
        result.errors.forEach(err => Toast.error('Error', err));
      }
    }

    FormUtils.setLoading('login-btn', false, 'Sign in');
  },

  // ─── Register Page ────────────────────────────────────────────────────────────

  register() {
    return `
      <div class="auth-layout">
        <div class="auth-branding fade-in">
          <div class="logo">
            <div class="logo-icon">
              <span class="material-icons-round">all_inclusive</span>
            </div>
            <span class="logo-text">Brightloop</span>
          </div>
          <h1>Start your <span>subscription</span><br>journey today</h1>
          <p>Create your free account and take control of your subscriptions with powerful tools built for teams of all sizes.</p>
          <div class="auth-features">
            <div class="auth-feature">
              <span class="material-icons-round">rocket_launch</span>
              Quick and easy setup
            </div>
            <div class="auth-feature">
              <span class="material-icons-round">dashboard</span>
              Personal dashboard
            </div>
            <div class="auth-feature">
              <span class="material-icons-round">receipt_long</span>
              Track invoices & payments
            </div>
          </div>
        </div>

        <div class="auth-form-panel">
          <div class="auth-card">
            <h2>Create account</h2>
            <p class="auth-subtitle">Sign up to get started with Brightloop</p>

            <form id="register-form" onsubmit="Pages.handleRegister(event)">
              ${FormUtils.inputGroup('register-name', 'Full name', 'text', 'Enter your full name', 'person')}
              ${FormUtils.inputGroup('register-email', 'Email address', 'email', 'Enter your email', 'mail')}
              ${FormUtils.inputGroup('register-password', 'Password', 'password', 'Create a strong password', 'lock',
                '<div id="password-reqs"></div>'
              )}
              ${FormUtils.inputGroup('register-confirm', 'Confirm password', 'password', 'Confirm your password', 'lock_reset')}

              <button type="submit" id="register-btn" class="btn btn-primary btn-block btn-lg">
                Create account
              </button>
            </form>

            <div class="auth-links">
              <span style="font-size: 13.5px; color: var(--text-secondary);">Already have an account?</span>
              <a href="#" onclick="Router.navigate('/login'); return false;">Sign in</a>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  initRegisterPage() {
    const passwordInput = document.getElementById('register-password');
    if (passwordInput) {
      passwordInput.addEventListener('input', (e) => {
        const reqsContainer = document.getElementById('password-reqs');
        if (reqsContainer) {
          reqsContainer.innerHTML = FormUtils.passwordRequirements(e.target.value);
        }
      });
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    FormUtils.clearAllErrors('register-form');

    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm').value;

    let hasError = false;

    if (!name || name.length < 2) { FormUtils.showError('register-name', 'Name must be at least 2 characters'); hasError = true; }
    if (!email) { FormUtils.showError('register-email', 'Email is required'); hasError = true; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { FormUtils.showError('register-email', 'Please enter a valid email'); hasError = true; }

    const pwErrors = FormUtils.validatePassword(password);
    if (pwErrors.length > 0) { FormUtils.showError('register-password', pwErrors[0]); hasError = true; }
    if (password !== confirmPassword) { FormUtils.showError('register-confirm', 'Passwords do not match'); hasError = true; }
    if (hasError) return;

    FormUtils.setLoading('register-btn', true, 'Create account');

    const result = await Auth.register(name, email, password, confirmPassword);

    if (result.success) {
      Toast.success('Welcome!', 'Your account has been created successfully.');
      Router.navigate('/dashboard/customer');
    } else {
      Toast.error('Registration failed', result.message);
      if (result.errors) {
        result.errors.forEach(err => Toast.error('Validation', err));
      }
    }

    FormUtils.setLoading('register-btn', false, 'Create account');
  },

  // ─── Forgot Password Page ────────────────────────────────────────────────────

  forgotPassword() {
    return `
      <div class="auth-layout">
        <div class="auth-branding fade-in">
          <div class="logo">
            <div class="logo-icon">
              <span class="material-icons-round">all_inclusive</span>
            </div>
            <span class="logo-text">Brightloop</span>
          </div>
          <h1>Reset your <span>password</span></h1>
          <p>Don't worry, it happens to the best of us. Enter your email and we'll send you a link to reset your password.</p>
        </div>

        <div class="auth-form-panel">
          <div class="auth-card">
            <h2>Forgot password?</h2>
            <p class="auth-subtitle">Enter your email address and we'll send you a reset link</p>

            <div id="forgot-form-container">
              <form id="forgot-form" onsubmit="Pages.handleForgotPassword(event)">
                ${FormUtils.inputGroup('forgot-email', 'Email address', 'email', 'Enter your registered email', 'mail')}

                <button type="submit" id="forgot-btn" class="btn btn-primary btn-block btn-lg">
                  Send reset link
                </button>
              </form>
            </div>

            <div id="forgot-success" style="display: none; text-align: center; padding: 20px 0;">
              <div style="width: 72px; height: 72px; background: var(--success-50); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                <span class="material-icons-round" style="font-size: 36px; color: var(--success-500);">mark_email_read</span>
              </div>
              <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">Check your email</h3>
              <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
                If an account with that email exists, we've sent a password reset link. Please check your inbox and spam folder.
              </p>
              <div id="forgot-preview-link" style="margin-top: 16px;"></div>
            </div>

            <div class="auth-links">
              <a href="#" onclick="Router.navigate('/login'); return false;">
                <span class="material-icons-round" style="font-size: 18px; vertical-align: middle; margin-right: 4px;">arrow_back</span>
                Back to sign in
              </a>
              <span></span>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async handleForgotPassword(e) {
    e.preventDefault();
    FormUtils.clearAllErrors('forgot-form');

    const email = document.getElementById('forgot-email').value.trim();
    if (!email) { FormUtils.showError('forgot-email', 'Email is required'); return; }

    FormUtils.setLoading('forgot-btn', true, 'Send reset link');

    const result = await Auth.forgotPassword(email);

    if (result.success) {
      document.getElementById('forgot-form-container').style.display = 'none';
      document.getElementById('forgot-success').style.display = 'block';

      // Show preview link for development
      if (result.previewUrl) {
        document.getElementById('forgot-preview-link').innerHTML = `
          <a href="${result.previewUrl}" target="_blank" class="btn btn-outline btn-sm" style="margin-top: 8px;">
            <span class="material-icons-round" style="font-size: 18px;">open_in_new</span>
            Preview email (dev only)
          </a>
        `;
      }
    } else {
      Toast.error('Error', result.message);
    }

    FormUtils.setLoading('forgot-btn', false, 'Send reset link');
  },

  // ─── Reset Password Page ──────────────────────────────────────────────────────

  resetPassword() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      return `
        <div class="auth-layout">
          <div class="auth-form-panel" style="width: 100%; min-width: unset;">
            <div class="auth-card" style="text-align: center;">
              <div style="width: 72px; height: 72px; background: var(--danger-50); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                <span class="material-icons-round" style="font-size: 36px; color: var(--danger-500);">link_off</span>
              </div>
              <h2>Invalid Reset Link</h2>
              <p class="auth-subtitle">This password reset link is invalid or has expired.</p>
              <a href="#" onclick="Router.navigate('/forgot-password'); return false;" class="btn btn-primary" style="margin-top: 16px;">
                Request new reset link
              </a>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="auth-layout">
        <div class="auth-branding fade-in">
          <div class="logo">
            <div class="logo-icon">
              <span class="material-icons-round">all_inclusive</span>
            </div>
            <span class="logo-text">Brightloop</span>
          </div>
          <h1>Set your new <span>password</span></h1>
          <p>Choose a strong password to keep your account secure.</p>
        </div>

        <div class="auth-form-panel">
          <div class="auth-card">
            <h2>Reset password</h2>
            <p class="auth-subtitle">Create a new secure password for your account</p>

            <div id="reset-form-container">
              <form id="reset-form" onsubmit="Pages.handleResetPassword(event)">
                <input type="hidden" id="reset-token" value="${token}">
                ${FormUtils.inputGroup('reset-password', 'New password', 'password', 'Enter new password', 'lock',
                  '<div id="reset-password-reqs"></div>'
                )}
                ${FormUtils.inputGroup('reset-confirm', 'Confirm password', 'password', 'Confirm new password', 'lock_reset')}

                <button type="submit" id="reset-btn" class="btn btn-primary btn-block btn-lg">
                  Reset password
                </button>
              </form>
            </div>

            <div id="reset-success" style="display: none; text-align: center; padding: 20px 0;">
              <div style="width: 72px; height: 72px; background: var(--success-50); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                <span class="material-icons-round" style="font-size: 36px; color: var(--success-500);">check_circle</span>
              </div>
              <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">Password reset!</h3>
              <p style="color: var(--text-secondary); font-size: 14px;">Your password has been reset successfully.</p>
              <a href="#" onclick="Router.navigate('/login'); return false;" class="btn btn-primary" style="margin-top: 20px;">
                Sign in with new password
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  initResetPage() {
    const passwordInput = document.getElementById('reset-password');
    if (passwordInput) {
      passwordInput.addEventListener('input', (e) => {
        const reqsContainer = document.getElementById('reset-password-reqs');
        if (reqsContainer) {
          reqsContainer.innerHTML = FormUtils.passwordRequirements(e.target.value);
        }
      });
    }
  },

  async handleResetPassword(e) {
    e.preventDefault();
    FormUtils.clearAllErrors('reset-form');

    const token = document.getElementById('reset-token').value;
    const password = document.getElementById('reset-password').value;
    const confirmPassword = document.getElementById('reset-confirm').value;

    let hasError = false;
    const pwErrors = FormUtils.validatePassword(password);
    if (pwErrors.length > 0) { FormUtils.showError('reset-password', pwErrors[0]); hasError = true; }
    if (password !== confirmPassword) { FormUtils.showError('reset-confirm', 'Passwords do not match'); hasError = true; }
    if (hasError) return;

    FormUtils.setLoading('reset-btn', true, 'Reset password');

    const result = await Auth.resetPassword(token, password, confirmPassword);

    if (result.success) {
      document.getElementById('reset-form-container').style.display = 'none';
      document.getElementById('reset-success').style.display = 'block';
    } else {
      Toast.error('Reset failed', result.message);
    }

    FormUtils.setLoading('reset-btn', false, 'Reset password');
  }
};
