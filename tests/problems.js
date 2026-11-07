// Reference solutions must pass every hidden test and score high; the starter code and slow/naive solutions must not.
const fs = require('fs'), path = require('path'), vm = require('vm');
const { CC, run } = require('./harness.js');
global.window = {}; vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../js/problems.js'), 'utf8'));
let bad = 0;
for (const pr of window.PROBLEMS) {
  const ref = fs.readFileSync(path.join(__dirname, '../tools/problems', pr.id + '.c'), 'utf8');
  const grade = (src) => {
    const r = run(src, { stdin: '', maxSlices: 100 }); let pass = 0;
    for (const t of pr.tests) { const x = run(src, { stdin: t.input, maxSlices: 300 }); if (!x.runError && x.out.trim().replace(/\s+/g, ' ') === t.expected.trim().replace(/\s+/g, ' ')) pass++; }
    const tests = pr.tests.map((t, i) => ({ name: t.name, pass: i < pass, reason: '' }));
    const s = CC.score({ compile: r.compile, tests, run: { runError: r.runError, exit: r.exit, leaks: r.leaks, noInput: true } });
    return { pass, score: s.score };
  };
  const a = grade(ref), b = grade(pr.starter);
  const ok = a.pass === pr.tests.length && a.score >= 8 && b.pass < pr.tests.length;
  if (!ok) bad++; console.log(ok ? 'ok  ' : 'FAIL', pr.id.padEnd(8), 'reference', a.pass + '/' + pr.tests.length, 'score', a.score, '| starter', b.pass + '/' + pr.tests.length);
}
process.exit(bad ? 1 : 0);
