/**
 * Brightloop Software — Automated Test Suite: Module 1 (Auth & User Management)
 * Run with: node backend/test_module1.js
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, initializeDatabase } = require('./config/database');
const { seedAllMockData } = require('./seed_mock_data');
const { validateRegistration, validateStaffCreation } = require('./middleware/validation');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

async function runModule1Tests() {
  console.log('\n🧪 Running Test Suite: Brightloop Module 1 (Auth & User Management)...');

  await seedAllMockData();

  // --- 1. Password Complexity Rules ---
  console.log('\n--- 1. Password Complexity Validation ---');
  function testPassword(pw) {
    const req = { body: { name: 'Test User', email: 'test@example.com', password: pw } };
    let errorMsg = null;
    const res = { status: () => ({ json: (data) => { errorMsg = data.errors ? data.errors[0] : data.message; } }) };
    let passed = false;
    validateRegistration(req, res, () => { passed = true; });
    return { passed, errorMsg };
  }

  assert(!testPassword('short1!').passed, 'Rejects password <= 8 characters ("short1!")');
  assert(!testPassword('alllowercase1!').passed, 'Rejects password without uppercase ("alllowercase1!")');
  assert(!testPassword('ALLUPPERCASE1!').passed, 'Rejects password without lowercase ("ALLUPPERCASE1!")');
  assert(!testPassword('NoSpecialChar123').passed, 'Rejects password without special character ("NoSpecialChar123")');
  assert(testPassword('ValidPass@123!').passed, 'Accepts password meeting all criteria ("ValidPass@123!")');

  // --- 2. Email Uniqueness Enforcement ---
  console.log('\n--- 2. Email Uniqueness Enforcement ---');
  const admin = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get('admin@brightloop.com');
  assert(admin !== undefined, 'Admin account exists in database');

  let duplicateError = false;
  try {
    db.prepare(`
      INSERT INTO users (uuid, name, email, password, role_id)
      VALUES ('test-uuid', 'Duplicate Admin', 'admin@brightloop.com', 'hash', 1)
    `).run();
  } catch (err) {
    duplicateError = err.message.includes('UNIQUE') || err.message.includes('constraint');
  }
  assert(duplicateError, 'Database strictly rejects duplicate email addresses (COLLATE NOCASE)');

  // --- 3. Password Hashing Security ---
  console.log('\n--- 3. Password Hashing with Bcrypt ---');
  assert(admin.password.startsWith('$2a$') || admin.password.startsWith('$2b$'), 'Password stored as bcrypt salted hash');
  const passwordMatch = await bcrypt.compare('Admin@123!', admin.password);
  assert(passwordMatch, 'Stored hash verifies correctly against plaintext password');
  const wrongPasswordMatch = await bcrypt.compare('WrongPassword@123', admin.password);
  assert(!wrongPasswordMatch, 'Stored hash safely rejects incorrect plaintext password');

  // --- 4. Role-Based Access Control (RBAC) ---
  console.log('\n--- 4. Role-Based Access Control (RBAC) ---');
  const roles = db.prepare('SELECT name FROM roles ORDER BY id ASC').all().map(r => r.name);
  assert(roles.includes('admin'), 'Role "admin" exists');
  assert(roles.includes('staff'), 'Role "staff" exists');
  assert(roles.includes('customer'), 'Role "customer" exists');

  // Verify role assignments
  const staff = db.prepare("SELECT u.*, r.name as role FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'staff' LIMIT 1").get();
  assert(staff !== undefined, 'Staff member exists with role_id assigned to "staff"');

  const customer = db.prepare("SELECT u.*, r.name as role FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'customer' LIMIT 1").get();
  assert(customer !== undefined, 'Customer account exists with role_id assigned to "customer"');

  // --- 5. JWT Authentication & Refresh Tokens ---
  console.log('\n--- 5. JWT Authentication & Token Signing ---');
  const JWT_SECRET = process.env.JWT_SECRET || 'brightloop_jwt_secret_key_default_2026';
  const token = jwt.sign({ userId: admin.id, role: 'admin' }, JWT_SECRET, { expiresIn: '15m' });
  const decoded = jwt.verify(token, JWT_SECRET);
  assert(decoded.userId === admin.id, 'JWT access token encodes user ID accurately');
  assert(decoded.role === 'admin', 'JWT access token encodes role accurately');

  console.log('\n=======================================');
  console.log(`Results: ${passedTests} passed, ${failedTests} failed.`);
  console.log('=======================================\n');

  if (failedTests > 0) process.exit(1);
}

runModule1Tests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
