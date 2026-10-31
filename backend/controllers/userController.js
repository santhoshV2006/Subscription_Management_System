const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/database');

/**
 * Log activity helper.
 */
function logActivity(userId, action, details, ipAddress) {
  db.prepare('INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)')
    .run(userId, action, details, ipAddress);
}

// ─── Get All Users (Admin only) ─────────────────────────────────────────────────

exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (role) {
      whereClause += ' AND r.name = ?';
      params.push(role);
    }

    if (search) {
      whereClause += ' AND (u.name LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status === 'active') {
      whereClause += ' AND u.is_active = 1';
    } else if (status === 'inactive') {
      whereClause += ' AND u.is_active = 0';
    }

    const countQuery = `SELECT COUNT(*) as total FROM users u JOIN roles r ON u.role_id = r.id ${whereClause}`;
    const total = db.prepare(countQuery).get(...params).total;

    const users = db.prepare(`
      SELECT u.uuid, u.name, u.email, u.is_active, u.email_verified, u.last_login, u.created_at, r.name as role
      FROM users u JOIN roles r ON u.role_id = r.id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching users.'
    });
  }
};

// ─── Get User by UUID (Admin only) ──────────────────────────────────────────────

exports.getUserByUuid = async (req, res) => {
  try {
    const { uuid } = req.params;

    const user = db.prepare(`
      SELECT u.uuid, u.name, u.email, u.is_active, u.email_verified, u.last_login, u.created_at, u.updated_at, r.name as role
      FROM users u JOIN roles r ON u.role_id = r.id
      WHERE u.uuid = ?
    `).get(uuid);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Get recent activity
    const userRecord = db.prepare('SELECT id FROM users WHERE uuid = ?').get(uuid);
    const activities = db.prepare(`
      SELECT action, details, ip_address, created_at
      FROM activity_logs
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(userRecord.id);

    res.json({
      success: true,
      data: { user, activities }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching the user.'
    });
  }
};

// ─── Create Staff Account (Admin only) ──────────────────────────────────────────

exports.createStaff = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check for existing email
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Get staff role
    const staffRole = db.prepare("SELECT id FROM roles WHERE name = 'staff'").get();

    // Create user
    const uuid = uuidv4();
    db.prepare(`
      INSERT INTO users (uuid, name, email, password, role_id, email_verified)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(uuid, name.trim(), email.toLowerCase(), hashedPassword, staffRole.id);

    logActivity(req.user.id, 'STAFF_CREATED', `Created staff account for ${email}`, req.ip);

    res.status(201).json({
      success: true,
      message: 'Staff account created successfully.',
      data: {
        user: {
          uuid,
          name: name.trim(),
          email: email.toLowerCase(),
          role: 'staff'
        }
      }
    });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while creating the staff account.'
    });
  }
};

// ─── Update User Status (Admin only) ────────────────────────────────────────────

exports.updateUserStatus = async (req, res) => {
  try {
    const { uuid } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean' && is_active !== 0 && is_active !== 1) {
      return res.status(400).json({
        success: false,
        message: 'is_active must be a boolean.'
      });
    }

    const user = db.prepare('SELECT id, uuid, email FROM users WHERE uuid = ?').get(uuid);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Prevent admin from deactivating themselves
    if (user.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account.'
      });
    }

    const activeValue = is_active ? 1 : 0;
    db.prepare('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE uuid = ?')
      .run(activeValue, uuid);

    // If deactivated, remove all refresh tokens
    if (!is_active) {
      db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(user.id);
    }

    logActivity(req.user.id, 'USER_STATUS_CHANGED', `${is_active ? 'Activated' : 'Deactivated'} user ${user.email}`, req.ip);

    res.json({
      success: true,
      message: `User ${is_active ? 'activated' : 'deactivated'} successfully.`
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating the user status.'
    });
  }
};

// ─── Delete User (Admin only) ───────────────────────────────────────────────────

exports.deleteUser = async (req, res) => {
  try {
    const { uuid } = req.params;

    const user = db.prepare('SELECT id, email FROM users WHERE uuid = ?').get(uuid);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    if (user.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account.'
      });
    }

    // Delete refresh tokens
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(user.id);
    // Delete user
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);

    logActivity(req.user.id, 'USER_DELETED', `Deleted user ${user.email}`, req.ip);

    res.json({
      success: true,
      message: 'User deleted successfully.'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while deleting the user.'
    });
  }
};

// ─── Get Dashboard Stats (Admin) ────────────────────────────────────────────────

exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const activeUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get().count;
    const staffCount = db.prepare("SELECT COUNT(*) as count FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'staff'").get().count;
    const customerCount = db.prepare("SELECT COUNT(*) as count FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'customer'").get().count;

    const recentUsers = db.prepare(`
      SELECT u.uuid, u.name, u.email, u.created_at, r.name as role
      FROM users u JOIN roles r ON u.role_id = r.id
      ORDER BY u.created_at DESC LIMIT 5
    `).all();

    const recentActivity = db.prepare(`
      SELECT a.action, a.details, a.created_at, u.name as user_name
      FROM activity_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC LIMIT 10
    `).all();

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          activeUsers,
          inactiveUsers: totalUsers - activeUsers,
          staffCount,
          customerCount
        },
        recentUsers,
        recentActivity
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching dashboard stats.'
    });
  }
};

// ─── Get Roles ──────────────────────────────────────────────────────────────────

exports.getRoles = async (req, res) => {
  try {
    const roles = db.prepare('SELECT * FROM roles').all();
    res.json({
      success: true,
      data: { roles }
    });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching roles.'
    });
  }
};
