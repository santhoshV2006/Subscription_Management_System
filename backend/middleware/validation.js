/**
 * Validation middleware for request data.
 */

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{9,}$/;

function validateRegistration(req, res, next) {
  const { name, email, password, confirmPassword } = req.body;
  const errors = [];

  // Name validation
  if (!name || name.trim().length < 2) {
    errors.push('Name must be at least 2 characters long.');
  }
  if (name && name.trim().length > 100) {
    errors.push('Name must not exceed 100 characters.');
  }

  // Email validation
  if (!email) {
    errors.push('Email is required.');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Please provide a valid email address.');
    }
  }

  // Password validation
  if (!password) {
    errors.push('Password is required.');
  } else {
    if (password.length <= 8) {
      errors.push('Password must contain more than 8 characters.');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter.');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter.');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character.');
    }
  }

  // Confirm password
  if (confirmPassword !== undefined && password !== confirmPassword) {
    errors.push('Passwords do not match.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors
    });
  }

  next();
}

function validateLogin(req, res, next) {
  const { email, password } = req.body;
  const errors = [];

  if (!email) {
    errors.push('Email is required.');
  }
  if (!password) {
    errors.push('Password is required.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors
    });
  }

  next();
}

function validatePasswordReset(req, res, next) {
  const { password, confirmPassword } = req.body;
  const errors = [];

  if (!password) {
    errors.push('New password is required.');
  } else {
    if (password.length <= 8) {
      errors.push('Password must contain more than 8 characters.');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter.');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter.');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character.');
    }
  }

  if (password !== confirmPassword) {
    errors.push('Passwords do not match.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors
    });
  }

  next();
}

function validateStaffCreation(req, res, next) {
  const { name, email, password } = req.body;
  const errors = [];

  if (!name || name.trim().length < 2) {
    errors.push('Name must be at least 2 characters long.');
  }
  if (!email) {
    errors.push('Email is required.');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Please provide a valid email address.');
    }
  }
  if (!password) {
    errors.push('Password is required.');
  } else {
    if (password.length <= 8) {
      errors.push('Password must contain more than 8 characters.');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter.');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter.');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character.');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors
    });
  }

  next();
}

module.exports = {
  validateRegistration,
  validateLogin,
  validatePasswordReset,
  validateStaffCreation
};
