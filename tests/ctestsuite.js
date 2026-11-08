// Runs the public c-testsuite (github.com/c-testsuite/c-testsuite) on our engine. Nothing is vendored: it is cloned into /tmp on first use.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const { run } = require('./harness.js');
const dir = process.env.CTS || '/tmp/cts';
if (!fs.existsSync(dir)) cp.execSync('git clone -q --depth 1 https://github.com/c-testsuite/c-testsuite ' + dir, { stdio: 'inherit' });
const sd = path.join(dir, 'tests', 'single-exec');
const only = process.argv[2];
let pass = 0; const fails = [];
for (const f of fs.readdirSync(sd).filter(f => f.endsWith('.c')).sort()) {
  if (only && !f.includes(only)) continue;
  const src = fs.readFileSync(path.join(sd, f), 'utf8'), exp = fs.readFileSync(path.join(sd, f + '.expected'), 'utf8');
  let why = '';
  try {
    const r = run(src, { stdin: '', maxSlices: 2000 });
    if (!r.compile.ok) why = 'COMPILE: ' + String((r.compile.errors && r.compile.errors[0] && r.compile.errors[0].msg) || '').slice(0, 90);
    else if (r.runError) why = 'RUNTIME: ' + (r.runError.kind || '') + ' ' + String(r.runError.message || '').slice(0, 70);
    else if (r.out !== exp) why = 'OUTPUT differs';
    else if (r.exit !== 0) why = 'EXIT ' + r.exit;
  } catch (e) { why = 'CRASH: ' + String(e.message).slice(0, 80); }
  if (why) fails.push(f + '  ' + why); else pass++;
}
console.log('pass', pass, 'fail', fails.length);
for (const x of fails) console.log(' ', x);
process.exit(0);
