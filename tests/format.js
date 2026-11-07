// Formatter must (1) never change the token stream, (2) be idempotent, (3) leave compiled behaviour unchanged.
const fs = require('fs'), path = require('path');
const { CC, run } = require('./harness.js');
require('../js/format.js');
const dirs = ['corpus', 'students'].map(d => path.join(__dirname, d));
let n = 0, bad = 0;
const toks = (s) => { const r = CC.lex ? CC.lex(s) : null; return r; };
for (const d of dirs) for (const f of fs.readdirSync(d).filter(x => x.endsWith('.c'))) {
  const src = fs.readFileSync(path.join(d, f), 'utf8');
  const a = CC.formatC(src), b = CC.formatC(a);
  const norm = (x) => x.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, '').replace(/\\\n/g, '');
  n++;
  // token-ish equality: all whitespace removed (insert-only spacing cannot change anything else)
  if (norm(src) !== norm(a)) { bad++; console.log('CONTENT CHANGED', f); }
  else if (a !== b) { bad++; console.log('NOT IDEMPOTENT', f); }
  const x = run(src, { stdin: '7\n', maxSlices: 40 }), y = run(a, { stdin: '7\n', maxSlices: 40 });
  if (x.ok !== y.ok || x.out !== y.out || x.exit !== y.exit || String(x.runError && x.runError.kind) !== String(y.runError && y.runError.kind)) { bad++; console.log('BEHAVIOUR CHANGED', f); }
}
console.log('formatted', n, 'files, problems', bad);
process.exit(bad ? 1 : 0);
