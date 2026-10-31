/**
 * Brightloop Software — High-Performance Parallel Test Runner
 * Executes all module test suites concurrently using Node child processes to maximize throughput.
 *
 * Run with: node backend/test_parallel_runner.js
 */

const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');

const testSuites = [
  { name: 'Module 1: Authentication & RBAC', file: path.join(__dirname, 'test_module1.js'), dbName: 'test_m1.db' },
  { name: 'Module 2: Products, Plans & Pricing', file: path.join(__dirname, 'test_module2.js'), dbName: 'test_m2.db' },
  { name: 'Module 3: Subscriptions & Quotations', file: path.join(__dirname, 'test_module3.js'), dbName: 'test_m3.db' },
  { name: 'Module 4: Invoice Management', file: path.join(__dirname, 'test_module4.js'), dbName: 'test_m4.db' }
];

console.log('\n⚡ ═══════════════════════════════════════════════════════════════');
console.log('   Brightloop Software — Parallel Test Execution Suite');
console.log(`   Running ${testSuites.length} test suites concurrently across worker processes`);
console.log('═════════════════════════════════════════════════════════════════\n');

const startTime = Date.now();

function runTestSuite({ name, file, dbName }) {
  return new Promise((resolve) => {
    const suiteStart = Date.now();
    const testDbPath = path.join(__dirname, 'data', dbName);

    // Clean test DB if already exists
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch (_) {}
    }

    const child = fork(file, [], {
      silent: true,
      env: {
        ...process.env,
        DB_PATH: testDbPath
      }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => { stdout += data.toString(); });
    child.stderr.on('data', data => { stderr += data.toString(); });

    child.on('close', code => {
      const duration = ((Date.now() - suiteStart) / 1000).toFixed(2);
      // Clean up test DB file after run
      try { if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath); } catch (_) {}
      resolve({
        name,
        code,
        stdout,
        stderr,
        duration
      });
    });
  });
}

async function runAllParallel() {
  const results = await Promise.all(testSuites.map(runTestSuite));
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

  let allPassed = true;

  results.forEach(res => {
    console.log(`\n─────────────────────────────────────────────────────────────────`);
    console.log(`📦 Suite: ${res.name} (Duration: ${res.duration}s)`);
    console.log(`─────────────────────────────────────────────────────────────────`);
    console.log(res.stdout);
    if (res.stderr) {
      console.error(res.stderr);
    }
    if (res.code !== 0) {
      allPassed = false;
      console.log(`❌ ${res.name} FAILED with exit code ${res.code}`);
    } else {
      console.log(`✅ ${res.name} PASSED in ${res.duration}s`);
    }
  });

  console.log('\n═════════════════════════════════════════════════════════════════');
  console.log(`🏁 PARALLEL TEST EXECUTION COMPLETED IN ${totalDuration}s`);
  if (allPassed) {
    console.log('🎉 ALL TEST SUITES PASSED FLAWLESSLY! 100% SUCCESS RATE.');
    console.log('═════════════════════════════════════════════════════════════════\n');
    process.exit(0);
  } else {
    console.error('❌ ONE OR MORE TEST SUITES FAILED.');
    console.log('═════════════════════════════════════════════════════════════════\n');
    process.exit(1);
  }
}

runAllParallel();
