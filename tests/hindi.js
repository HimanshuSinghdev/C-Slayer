// Every score note produced on the sample programs must have a Hinglish line; explain rules must align.
const fs = require('fs'), path = require('path');
const { CC, run } = require('./harness.js');
require('../js/explain.js'); require('../js/explain_hi.js');
let bad = 0;
if (CC.explainRules.length !== CC.explainHi.rules.length) { bad++; console.log('rule count mismatch'); }
CC.explainRules.forEach((r, i) => { const f = (s) => [...new Set((s.match(/\$\d/g) || []))].sort().join(); if (f(r[1] + r[2]) !== f(CC.explainHi.rules[i][0] + CC.explainHi.rules[i][1])) { bad++; console.log('placeholder mismatch', i); } });
const miss = new Set();
for (const f of fs.readdirSync(path.join(__dirname, 'students')).filter(x => x.endsWith('.c'))) {
  const src = fs.readFileSync(path.join(__dirname, 'students', f), 'utf8');
  const r = run(src, { stdin: '10\n', maxSlices: 100 });
  const probes = CC.scoreProbes.inputs.map(q => { const p = run(src, { stdin: q.in, maxSlices: 100 }); return { id: q.id, in: q.in, big: !!q.big, out: p.out, exit: p.exit, runError: p.runError }; });
  const s = CC.score({ compile: r.compile, probes, run: { runError: r.runError, exit: r.exit, leaks: r.leaks } });
  const warnTexts = new Set((r.compile.warnings || []).concat(r.compile.errors || []).map(w => w.msg));
  for (const p of s.parts) for (const n of p.notes) { if (warnTexts.has(n.text)) continue; if (!CC.scoreRules.some(([re]) => re.test(n.text))) miss.add(n.text); }
}
for (const t of miss) { bad++; console.log('NO HINGLISH FOR:', t); }
console.log(bad ? 'problems ' + bad : 'hindi ok');
process.exit(bad ? 1 : 0);
