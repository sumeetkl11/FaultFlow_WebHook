const { execSync } = require('child_process');
const path = require('path');

// Locate Python user scripts directory if not already in PATH
let additionalPaths = [];
try {
  const pyScriptsPath = execSync('python -c "import sysconfig; print(sysconfig.get_path(\'scripts\'))"', { encoding: 'utf-8' }).trim();
  if (pyScriptsPath) additionalPaths.push(pyScriptsPath);
} catch (e) {
  // Ignore fallback
}

const env = {
  ...process.env,
  PATH: [...additionalPaths, process.env.PATH].join(path.delimiter)
};

console.log('\n🔒 [1/3] Running npm audit...');
try {
  execSync('npm audit', { stdio: 'inherit', env });
} catch (err) {
  console.warn('⚠️ npm audit reported vulnerabilities (see above).');
}

console.log('\n🔎 [2/3] Running Semgrep SAST Scan...');
try {
  execSync('semgrep --config auto .', { stdio: 'inherit', env });
} catch (err) {
  console.warn('⚠️ Semgrep detected potential issues.');
}

console.log('\n🛡️ [3/3] Running Node.js Security Scan (njsscan)...');
try {
  execSync('njsscan .', { stdio: 'inherit', env });
} catch (err) {
  console.warn('⚠️ njsscan completed with findings.');
}

console.log('\n✅ Security checks complete.\n');
