/**
 * Seed script to create an initial admin user.
 * Run with: npm run seed
 */
require('dotenv').config();

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db, initializeDatabase } = require('./config/database');

async function seed() {
  try {
    initializeDatabase();

    const adminEmail = 'admin@brightloop.com';
    const adminPassword = 'Admin@123!';

    // Check if admin already exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
    if (existing) {
      console.log('⚠️  Admin user already exists. Skipping seed.');
      return;
    }

    // Get admin role
    const adminRole = db.prepare("SELECT id FROM roles WHERE name = 'admin'").get();

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    // Create admin user
    db.prepare(`
      INSERT INTO users (uuid, name, email, password, role_id, is_active, email_verified)
      VALUES (?, ?, ?, ?, ?, 1, 1)
    `).run(uuidv4(), 'System Admin', adminEmail, hashedPassword, adminRole.id);

    console.log('✅ Admin user created successfully!');
    console.log('   Email:    admin@brightloop.com');
    console.log('   Password: Admin@123!');
    console.log('\n⚠️  Please change this password after first login.\n');
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed();
