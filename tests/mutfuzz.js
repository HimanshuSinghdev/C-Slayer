// mutation fuzzer: mutate corpus programs; any thrown exception or "internal" error is a bug
const fs = require('fs'), path = require('path');
const { run } = require('./harness.js');
const dir = path.join(__dirname, 'corpus');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.c'));
let seed = +process.argv[3] || 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const N = +process.argv[2] || 2000; const SEM = process.argv[4] === 'sem';
const toks = s => s.match(/\w+|\s+|[^\w\s]/g) || [];
const EXT = ['0', '-1', '2147483647', '4294967296', '99999999999', '1e308', '0x7fffffffffffffff', '""', "'a'", 'NULL', '(', ')', '{', '}', ';', '*', '&', '[', ']', '->', '++', '<<', '/', '%', 'sizeof', 'void', 'struct', 'int', 'return', '...', '#'];
function mutate(src) {
  const t = toks(src); const k = 1 + Math.floor(rnd() * 4);
  for (let i = 0; i < k; i++) {
    let p = Math.floor(rnd() * t.length), r = rnd();
    if (SEM) { for (let g = 0; g < 50 && !/^(\d+|[-+*\/%<>=!&|^]+)$/.test(t[p]); g++) p = Math.floor(rnd() * t.length); if (/^\d+$/.test(t[p])) { t[p] = ['0', '1', '-1', '2147483647', '255', '65536', '1000000', '4294967295', '99'][Math.floor(rnd() * 9)]; continue; } r = 0.9; }
    if (r < 0.3) t.splice(p, 1);
    else if (r < 0.5) t.splice(p, 0, t[Math.floor(rnd() * t.length)]);
    else if (r < 0.8) t[p] = EXT[Math.floor(rnd() * EXT.length)];
    else { const q = Math.floor(rnd() * t.length); const x = t[p]; t[p] = t[q]; t[q] = x; }
  }
  return t.join('');
}
let bad = 0, compiled = 0, ran = 0, t0 = Date.now();
for (let n = 0; n < N; n++) {
  const f = files[Math.floor(rnd() * files.length)];
  const src = mutate(fs.readFileSync(path.join(dir, f), 'utf8'));
  const a = Date.now();
  try {
    const r = run(src, { stdin: '1 2 3\nabc def\n', maxSlices: 20 });
    if (r.ok) compiled++;
    if (r.runError && r.runError.kind === 'internal') { bad++; console.log('INTERNAL', f, r.runError.message); fs.writeFileSync('/tmp/mf_' + bad + '.c', src); }
    else if (r.ok) ran++;
  } catch (e) { bad++; console.log('THROW', f, String(e.stack).split('\n').slice(0, 3).join(' | ')); fs.writeFileSync('/tmp/mf_' + bad + '.c', src); }
  if (Date.now() - a > 8000) { bad++; console.log('SLOW', f, Date.now() - a, 'ms'); fs.writeFileSync('/tmp/mf_' + bad + '.c', src); }
}
console.log('iterations', N, 'compiled', compiled, 'bad', bad, 'secs', Math.round((Date.now() - t0) / 1000));
