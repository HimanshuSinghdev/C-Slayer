// scoring regression: each sample must land in its expected band
const fs = require('fs'), path = require('path');
const { CC, run } = require('./harness.js');
const want = { 'excellent.c': [8.5, 10], 'messy.c': [7.5, 9.5], 'leaky.c': [6.5, 8.4], 'average.c': [5.5, 7.9], 'oob.c': [3, 6], 'poor.c': [1, 3] };
let bad = 0;
for (const [f, [lo, hi]] of Object.entries(want)) {
  const src = fs.readFileSync(path.join(__dirname, 'students', f), 'utf8');
  const r = run(src, { stdin: '', maxSlices: 30 });
  const s = CC.score({ compile: r.compile, run: { runError: r.runError, exit: r.exit, leaks: r.leaks, noInput: true, hadStderr: !!(r.err && r.err.length) } });
  const ok = s.score >= lo && s.score <= hi; if (!ok) bad++;
  console.log(ok ? 'ok  ' : 'FAIL', f, s.score, s.grade, '[' + lo + '..' + hi + ']');
}
process.exit(bad ? 1 : 0);
