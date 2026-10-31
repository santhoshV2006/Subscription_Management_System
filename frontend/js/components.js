/**
 * Brightloop — Reusable UI Components
 */

// ─── Toast Notification System ──────────────────────────────────────────────────

const Toast = {
  container: null,

  init() {
    this.container = document.getElementById('toast-container');
  },

  show(type, title, message, duration = 4500) {
    if (!this.container) this.init();

    const icons = {
      success: 'check_circle',
      error: 'error',
      warning: 'warning',
      info: 'info'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="material-icons-round toast-icon">${icons[type]}</span>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close" onclick="Toast.dismiss(this)">
        <span class="material-icons-round">close</span>
      </button>
    `;

    this.container.appendChild(toast);

    setTimeout(() => {
      this.dismiss(toast.querySelector('.toast-close'));
    }, duration);
  },

  dismiss(btn) {
    const toast = btn.closest ? btn.closest('.toast') : btn.parentElement;
    if (!toast) return;
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  },

  success(title, message) { this.show('success', title, message); },
  error(title, message) { this.show('error', title, message); },
  warning(title, message) { this.show('warning', title, message); },
  info(title, message) { this.show('info', title, message); }
};


// ─── Loading Overlay ────────────────────────────────────────────────────────────

const Loading = {
  el: null,

  init() {
    this.el = document.getElementById('loading-overlay');
  },

  show() {
    if (!this.el) this.init();
    this.el.classList.remove('hidden');
  },

  hide() {
    if (!this.el) this.init();
    this.el.classList.add('hidden');
  }
};


// ─── Modal ──────────────────────────────────────────────────────────────────────

const Modal = {
  open(titleOrConfig, bodyHTML = '', footerHTML = '', width = '') {
    // Remove any existing modal
    this.close();

    let title = '';
    let body = '';
    let footer = '';
    let modalWidth = '';
    const buttonActionMap = [];

    if (titleOrConfig && typeof titleOrConfig === 'object') {
      title = titleOrConfig.title || '';
      body = titleOrConfig.body || titleOrConfig.bodyHTML || titleOrConfig.content || '';
      modalWidth = titleOrConfig.width || '';

      if (titleOrConfig.footer || titleOrConfig.footerHTML) {
        footer = titleOrConfig.footer || titleOrConfig.footerHTML;
      } else if (Array.isArray(titleOrConfig.buttons)) {
        footer = titleOrConfig.buttons.map((btn, idx) => {
          const btnId = btn.id || `modal-btn-${idx}`;
          if (typeof btn.onclick === 'function' || typeof btn.action === 'function') {
            buttonActionMap.push({ id: btnId, fn: btn.onclick || btn.action });
          }
          const onclickAttr = (typeof btn.onclick === 'string') ? `onclick="${btn.onclick}"` : '';
          return `
            <button type="button" class="btn ${btn.class || 'btn-secondary'}"
              id="${btnId}"
              ${onclickAttr}
              ${btn.disabled ? 'disabled' : ''}>
              ${btn.label || btn.text || 'Action'}
            </button>
          `;
        }).join('');
      }
    } else {
      title = titleOrConfig || '';
      body = bodyHTML || '';
      footer = footerHTML || '';
      modalWidth = width || '';
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-overlay';
    const styleAttr = modalWidth ? `style="max-width: ${modalWidth}; width: 100%;"` : '';
    overlay.innerHTML = `
      <div class="modal" ${styleAttr}>
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close" onclick="Modal.close()" aria-label="Close modal">
            <span class="material-icons-round">close</span>
          </button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    `;

    // Close on backdrop click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) Modal.close();
    });

    document.body.appendChild(overlay);

    // Wire functional button callbacks if any
    buttonActionMap.forEach(({ id, fn }) => {
      const btnEl = document.getElementById(id);
      if (btnEl) {
        btnEl.addEventListener('click', (e) => fn(e));
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', this._escHandler);
  },

  close() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.remove();
    document.removeEventListener('keydown', this._escHandler);
  },

  _escHandler(e) {
    if (e.key === 'Escape') Modal.close();
  }
};


// ─── Confirm Dialog ─────────────────────────────────────────────────────────────

const Confirm = {
  show(title, message, onConfirm, confirmText = 'Confirm', isDanger = false) {
    const body = `<p style="color: var(--text-secondary); line-height: 1.6;">${message}</p>`;
    const footer = `
      <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
      <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'}" id="confirm-action-btn">${confirmText}</button>
    `;
    Modal.open(title, body, footer);

    document.getElementById('confirm-action-btn').addEventListener('click', () => {
      Modal.close();
      onConfirm();
    });
  }
};


// ─── Form Utilities ─────────────────────────────────────────────────────────────

const FormUtils = {
  /**
   * Create a form input group with icon.
   */
  inputGroup(id, label, type, placeholder, icon, extra = '') {
    const isPassword = type === 'password';
    return `
      <div class="form-group">
        <label class="form-label" for="${id}">${label}</label>
        <div class="form-input-wrapper">
          <span class="material-icons-round">${icon}</span>
          <input
            type="${type}"
            id="${id}"
            class="form-input"
            placeholder="${placeholder}"
            autocomplete="${type === 'password' ? 'current-password' : type === 'email' ? 'email' : 'off'}"
          >
          ${isPassword ? `<button type="button" class="password-toggle" onclick="FormUtils.togglePassword('${id}', this)"><span class="material-icons-round">visibility_off</span></button>` : ''}
        </div>
        <div class="form-error" id="${id}-error" style="display:none"></div>
        ${extra}
      </div>
    `;
  },

  /**
   * Toggle password visibility.
   */
  togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('.material-icons-round');
    if (input.type === 'password') {
      input.type = 'text';
      icon.textContent = 'visibility';
    } else {
      input.type = 'password';
      icon.textContent = 'visibility_off';
    }
  },

  /**
   * Show validation error for a field.
   */
  showError(fieldId, message) {
    const errorEl = document.getElementById(`${fieldId}-error`);
    const input = document.getElementById(fieldId);
    if (errorEl) {
      errorEl.innerHTML = `<span class="material-icons-round">error</span> ${message}`;
      errorEl.style.display = 'flex';
    }
    if (input) input.classList.add('is-invalid');
  },

  /**
   * Clear validation error for a field.
   */
  clearError(fieldId) {
    const errorEl = document.getElementById(`${fieldId}-error`);
    const input = document.getElementById(fieldId);
    if (errorEl) {
      errorEl.innerHTML = '';
      errorEl.style.display = 'none';
    }
    if (input) input.classList.remove('is-invalid');
  },

  /**
   * Clear all errors in a container.
   */
  clearAllErrors(containerId) {
    const container = document.getElementById(containerId) || document;
    container.querySelectorAll('.form-error').forEach(el => {
      el.innerHTML = '';
      el.style.display = 'none';
    });
    container.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
  },

  /**
   * Validate password and return errors.
   */
  validatePassword(password) {
    const errors = [];
    if (password.length <= 8) errors.push('Must be more than 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('Must contain an uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('Must contain a lowercase letter');
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('Must contain a special character');
    return errors;
  },

  /**
   * Create password requirements checklist.
   */
  passwordRequirements(password = '') {
    const checks = [
      { label: 'More than 8 characters', met: password.length > 8 },
      { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
      { label: 'One lowercase letter', met: /[a-z]/.test(password) },
      { label: 'One special character', met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) }
    ];

    return `<div class="password-requirements">${checks.map(c => `
      <div class="password-req ${c.met ? 'met' : ''}">
        <span class="material-icons-round">${c.met ? 'check_circle' : 'radio_button_unchecked'}</span>
        ${c.label}
      </div>
    `).join('')}</div>`;
  },

  /**
   * Set button loading state.
   */
  setLoading(btnId, isLoading, originalText = 'Submit') {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (isLoading) {
      btn.disabled = true;
      btn.innerHTML = `<span class="btn-spinner"></span> Please wait...`;
    } else {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
};


// ─── Date Formatting ────────────────────────────────────────────────────────────

const DateUtils = {
  format(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },

  formatFull(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  timeAgo(dateStr) {
    if (!dateStr) return '—';
    const now = new Date();
    const date = new Date(dateStr);
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return DateUtils.format(dateStr);
  }
};


// ─── Utility: Get initials ──────────────────────────────────────────────────────

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
