const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Robust Cross-Platform Security Check Runner
 * Enforces CI/CD failure exit codes and validates dependencies.
 */

// 1. Resolve Python Scripts Directory cross-platform
const additionalPaths = [];

function tryAddPythonScripts() {
  const pythonBinaries = ['python', 'python3', 'py'];
  for (const py of pythonBinaries) {
    try {
      const pyScripts = execSync(`${py} -c "import sysconfig; print(sysconfig.get_path('scripts'))"`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      if (pyScripts && fs.existsSync(pyScripts)) {
        additionalPaths.push(pyScripts);
        break;
      }
    } catch {
      // Continue searching next binary
    }
  }

  // Windows fallback paths
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      const pyCorePath = path.join(localAppData, 'Python');
      if (fs.existsSync(pyCorePath)) {
        try {
          const entries = fs.readdirSync(pyCorePath);
          for (const entry of entries) {
            const scriptsDir = path.join(pyCorePath, entry, 'Scripts');
            if (fs.existsSync(scriptsDir) && !additionalPaths.includes(scriptsDir)) {
              additionalPaths.push(scriptsDir);
            }
          }
        } catch {
          // Ignore read errors
        }
      }
    }
  }
}

tryAddPythonScripts();

const env = {
  ...process.env,
  PATH: [...additionalPaths, process.env.PATH].filter(Boolean).join(path.delimiter),
};

function isCommandAvailable(command) {
  const binary = process.platform === 'win32' ? 'where.exe' : 'which';
  const res = spawnSync(binary, [command], { env, stdio: 'pipe' });
  return res.status === 0;
}

const failures = [];

// Step 1: npm audit
console.log('\n🔒 [1/3] Running npm audit...');
try {
  execSync('npm audit', { stdio: 'inherit', env });
  console.log('✅ npm audit passed: No vulnerabilities found.');
} catch (error) {
  failures.push('npm audit (dependency vulnerabilities detected)');
}

// Step 2: Semgrep SAST Scan
console.log('\n🔎 [2/3] Running Semgrep SAST Scan...');
if (!isCommandAvailable('semgrep')) {
  console.error('❌ Error: "semgrep" binary not found in PATH.');
  console.error('   Please install it via: pip install semgrep\n');
  failures.push('semgrep (binary not installed or not in PATH)');
} else {
  try {
    execSync('semgrep --config auto --error .', { stdio: 'inherit', env });
    console.log('✅ Semgrep passed: No security findings.');
  } catch (error) {
    failures.push('semgrep (security rules violation detected)');
  }
}

// Step 3: Node.js Security Scanner (njsscan)
console.log('\n🛡️ [3/3] Running Node.js Security Scan (njsscan)...');
if (!isCommandAvailable('njsscan')) {
  console.error('❌ Error: "njsscan" binary not found in PATH.');
  console.error('   Please install it via: pip install njsscan\n');
  failures.push('njsscan (binary not installed or not in PATH)');
} else {
  try {
    execSync('njsscan --exit-warning .', { stdio: 'inherit', env });
    console.log('✅ njsscan passed: No security issues detected.');
  } catch (error) {
    failures.push('njsscan (code vulnerabilities detected)');
  }
}

// Summary & Exit Code Enforcement
console.log('\n========================================');
console.log('       SECURITY AUDIT SUMMARY');
console.log('========================================');

if (failures.length > 0) {
  console.error(`❌ FAILED: ${failures.length} security check(s) failed:`);
  failures.forEach((f, idx) => console.error(`   ${idx + 1}. ${f}`));
  console.error('\n⚠️ Push rejected / CI check failed. Fix the issues before proceeding.\n');
  process.exit(1);
} else {
  console.log('🎉 SUCCESS: All security and SAST audits passed cleanly!\n');
  process.exit(0);
}
