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
// Fibonacci calibration set: stdin-driven programs get hidden edge probes (0, 1, -1, 45)
const fib = { 'fib1.c': 4, 'fib2.c': 5, 'fib3.c': 7, 'fib4.c': 10 };
for (const [f, target] of Object.entries(fib)) {
  const src = fs.readFileSync(path.join(__dirname, 'students', f), 'utf8');
  const r = run(src, { stdin: '10\n', maxSlices: 300 });
  const probes = CC.scoreProbes.inputs.map(q => { const p = run(src, { stdin: q.in, maxSlices: q.big ? 300 : 100 }); return { id: q.id, in: q.in, big: !!q.big, out: p.out, exit: p.exit, runError: p.runError }; });
  const s = CC.score({ compile: r.compile, probes, run: { runError: r.runError, exit: r.exit, leaks: r.leaks, hadStderr: !!(r.err && r.err.length) } });
  const ok = s.score === target; if (!ok) bad++;
  console.log(ok ? 'ok  ' : 'FAIL', f, s.score, s.grade, '[=' + target + ']');
}
process.exit(bad ? 1 : 0);
