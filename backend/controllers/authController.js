const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/database');
const { sendPasswordResetEmail } = require('../utils/email');

const JWT_SECRET = process.env.JWT_SECRET || 'brightloop_jwt_secret_key_default_2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'brightloop_refresh_jwt_secret_key_default_2026';

/**
 * Generate JWT access and refresh tokens.
 */
function generateTokens(user) {
  const accessToken = jwt.sign(
    { userId: user.id, uuid: user.uuid, role: user.role_name },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  const refreshToken = jwt.sign(
    { userId: user.id, uuid: user.uuid },
    JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  return { accessToken, refreshToken };
}

/**
 * Store refresh token in database.
 */
function storeRefreshToken(userId, token) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)')
    .run(userId, token, expiresAt);
}

/**
 * Log activity.
 */
function logActivity(userId, action, details, ipAddress) {
  db.prepare('INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)')
    .run(userId, action, details, ipAddress);
}

// ─── Register ───────────────────────────────────────────────────────────────────

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if email already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Get customer role (default)
    const customerRole = db.prepare("SELECT id FROM roles WHERE name = 'customer'").get();

    // Create user
    const uuid = uuidv4();
    const result = db.prepare(`
      INSERT INTO users (uuid, name, email, password, role_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuid, name.trim(), email.toLowerCase(), hashedPassword, customerRole.id);

    const user = db.prepare(`
      SELECT u.id, u.uuid, u.name, u.email, r.name as role_name
      FROM users u JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `).get(result.lastInsertRowid);

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);
    storeRefreshToken(user.id, refreshToken);

    // Log activity
    logActivity(user.id, 'REGISTER', 'New customer account created', req.ip);

    // Set cookies
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful.',
      data: {
        user: {
          uuid: user.uuid,
          name: user.name,
          email: user.email,
          role: user.role_name
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during registration.'
    });
  }
};

// ─── Login ──────────────────────────────────────────────────────────────────────

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = db.prepare(`
      SELECT u.*, r.name as role_name
      FROM users u JOIN roles r ON u.role_id = r.id
      WHERE u.email = ?
    `).get(email.toLowerCase());

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated. Contact an administrator.'
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logActivity(user.id, 'LOGIN_FAILED', 'Invalid password attempt', req.ip);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);
    storeRefreshToken(user.id, refreshToken);

    // Update last login
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    // Log activity
    logActivity(user.id, 'LOGIN', 'Successful login', req.ip);

    // Set cookies
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        user: {
          uuid: user.uuid,
          name: user.name,
          email: user.email,
          role: user.role_name
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during login.'
    });
  }
};

// ─── Logout ─────────────────────────────────────────────────────────────────────

exports.logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refresh_token || req.body.refreshToken;

    if (refreshToken) {
      db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
    }

    // If user is authenticated, log the activity
    if (req.user) {
      logActivity(req.user.id, 'LOGOUT', 'User logged out', req.ip);
    }

    // Clear cookies
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');

    res.json({
      success: true,
      message: 'Logged out successfully.'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during logout.'
    });
  }
};

// ─── Refresh Token ──────────────────────────────────────────────────────────────

exports.refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refresh_token || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token not provided.'
      });
    }

    // Verify token exists in DB
    const storedToken = db.prepare('SELECT * FROM refresh_tokens WHERE token = ?').get(refreshToken);
    if (!storedToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token.'
      });
    }

    // Verify JWT
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Fetch user
    const user = db.prepare(`
      SELECT u.id, u.uuid, u.name, u.email, u.is_active, r.name as role_name
      FROM users u JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `).get(decoded.userId);

    if (!user || !user.is_active) {
      db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
      return res.status(401).json({
        success: false,
        message: 'User not found or deactivated.'
      });
    }

    // Delete old refresh token and issue new ones (token rotation)
    db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);

    const tokens = generateTokens(user);
    storeRefreshToken(user.id, tokens.refreshToken);

    // Set cookies
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000
    });

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token.'
    });
  }
};

// ─── Forgot Password ───────────────────────────────────────────────────────────

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required.'
      });
    }

    const user = db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(email.toLowerCase());

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + (parseInt(process.env.RESET_TOKEN_EXPIRY) || 30) * 60 * 1000).toISOString();

    // Store hashed token
    db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?')
      .run(hashedToken, expiresAt, user.id);

    // Send email
    try {
      const emailResult = await sendPasswordResetEmail(user.email, user.name, resetToken);
      logActivity(user.id, 'PASSWORD_RESET_REQUESTED', 'Password reset email sent', req.ip);

      const response = {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      };

      // Include preview URL in development
      if (emailResult.previewUrl) {
        response.previewUrl = emailResult.previewUrl;
      }

      res.json(response);
    } catch (emailError) {
      console.error('Email send error:', emailError);
      // Clear the reset token since email failed
      db.prepare('UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = ?')
        .run(user.id);
      res.status(500).json({
        success: false,
        message: 'Failed to send reset email. Please try again later.'
      });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred. Please try again later.'
    });
  }
};

// ─── Reset Password ─────────────────────────────────────────────────────────────

exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Hash the provided token to compare
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with this reset token
    const user = db.prepare(`
      SELECT id, name, email FROM users
      WHERE reset_token = ? AND reset_token_expires > datetime('now')
    `).get(hashedToken);

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token. Please request a new password reset.'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update password and clear reset token
    db.prepare(`
      UPDATE users
      SET password = ?, reset_token = NULL, reset_token_expires = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(hashedPassword, user.id);

    // Invalidate all refresh tokens for this user
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(user.id);

    logActivity(user.id, 'PASSWORD_RESET', 'Password was reset successfully', req.ip);

    res.json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while resetting the password.'
    });
  }
};

// ─── Get Current User Profile ───────────────────────────────────────────────────

exports.getProfile = async (req, res) => {
  try {
    const user = db.prepare(`
      SELECT u.uuid, u.name, u.email, u.is_active, u.email_verified, u.last_login, u.created_at, r.name as role
      FROM users u JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `).get(req.user.id);

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching the profile.'
    });
  }
};

// ─── Update Profile ─────────────────────────────────────────────────────────────

exports.updateProfile = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name must be at least 2 characters long.'
      });
    }

    db.prepare('UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(name.trim(), req.user.id);

    logActivity(req.user.id, 'PROFILE_UPDATED', 'Profile name updated', req.ip);

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      data: { name: name.trim() }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating the profile.'
    });
  }
};

// ─── Change Password ────────────────────────────────────────────────────────────

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current and new passwords are required.'
      });
    }

    // Validate new password
    if (newPassword.length <= 8) {
      return res.status(400).json({ success: false, message: 'Password must contain more than 8 characters.' });
    }
    if (!/[A-Z]/.test(newPassword)) {
      return res.status(400).json({ success: false, message: 'Password must contain at least one uppercase letter.' });
    }
    if (!/[a-z]/.test(newPassword)) {
      return res.status(400).json({ success: false, message: 'Password must contain at least one lowercase letter.' });
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
      return res.status(400).json({ success: false, message: 'Password must contain at least one special character.' });
    }

    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.'
      });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(hashedPassword, req.user.id);

    logActivity(req.user.id, 'PASSWORD_CHANGED', 'Password changed successfully', req.ip);

    res.json({
      success: true,
      message: 'Password changed successfully.'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while changing the password.'
    });
  }
};
