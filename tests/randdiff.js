// Random-program differential test: gcc (-O0, -O2) vs C-Slayer VM and Turbo. Usage: node tests/randdiff.js [count] [startSeed]
'use strict';
const fs = require('fs'), cp = require('child_process'), gen = require('./gen.js');
const { CC, run } = require('./harness.js');
const load = require('./load');
const CT = load(['lexer.js','preproc.js','types.js','parser.js','isa.js','vm.js','inspect.js','headers.js','libc.js','cdecl.js','cexpr.js','cstmt.js','cfmt.js','compile.js','turbo.js','wasm.js']);
function runT(src) { const c = CT.compile(src, {}); if (!c.ok) return 'COMPILE'; const vm = new CT.VM(c.program, {}); vm.feedInput('', true); let out = ''; const m = CT.Turbo.build(vm, { tick() { for (const q of vm.drainOutput()) if (q.fd !== 2) out += q.s; } }); const st = CT.Turbo.run(vm, m); for (const q of vm.drainOutput()) if (q.fd !== 2) out += q.s; return st === 'done' ? out : 'TURBO ' + st + out; }
let wasmRan = 0; const why = {};
function runW(src) { const c = CT.compile(src, {}); if (!c.ok) return null; const P = CT.Wasm.analyze(c.program); const vm = new CT.VM(c.program, { wasm: true }); vm.feedInput('', true); let out = ''; const m = CT.Wasm.build(vm, P, { tick() { for (const q of vm.drainOutput()) if (q.fd !== 2) out += q.s; } }); const st = CT.Turbo.run(vm, m); for (const q of vm.drainOutput()) if (q.fd !== 2) out += q.s; wasmRan++; return st === 'done' ? out : 'WASM ' + st + out; }
const N = +process.argv[2] || 50, S0 = +process.argv[3] || 1, dir = fs.mkdtempSync('/tmp/randdiff-');
let bad = 0, skipped = 0;
for (let s = S0; s < S0 + N; s++) {
  const src = gen(s), f = dir + '/p.c';
  fs.writeFileSync(f, src);
  const ref = [];
  for (const o of ['-O0', '-O2']) {
    const c = cp.spawnSync('gcc', [o, '-w', '-fwrapv', '-o', dir + '/p' + o, f]);
    if (c.status) { console.log('seed', s, 'gcc compile error'); bad++; fs.writeFileSync(`/tmp/rd_${s}.c`, src); ref.length = 0; break; }
    ref.push(cp.spawnSync(dir + '/p' + o, { timeout: 10000 }).stdout.toString());
  }
  if (!ref.length) continue;
  if (ref[0] !== ref[1]) { console.log('seed', s, 'gcc O0 != O2 (generator UB?)'); skipped++; continue; }
  let r;
  try { r = run(src); } catch (e) { r = { out: 'EXC ' + e.message }; }
  const out = r.ok === false ? 'COMPILE ' + JSON.stringify((r.errors||[])[0]) : r.runError ? 'RUNERR ' + JSON.stringify(r.runError) + r.out : r.out;
  let to; try { to = runT(src); } catch (e) { to = e instanceof CT.Turbo.Unsupported ? ref[0] : 'EXC ' + e.message; }
  if (to !== ref[0]) { bad++; fs.writeFileSync(`/tmp/rd_${s}.c`, src); console.log('seed', s, 'TURBO MISMATCH', JSON.stringify(to.slice(0, 80))); }
  let wo; try { wo = runW(src); } catch (e) { wo = e instanceof CT.Wasm.Unsupported ? (why[e.message.replace(/\d+/g,'#')] = (why[e.message.replace(/\d+/g,'#')]||0)+1, null) : 'EXC ' + e.message; }
  if (wo !== null && wo !== ref[0]) { bad++; fs.writeFileSync(`/tmp/rd_${s}.c`, src); console.log('seed', s, 'WASM MISMATCH', JSON.stringify(String(wo).slice(0, 80))); }
  if (out !== ref[0]) { bad++; fs.writeFileSync(`/tmp/rd_${s}.c`, src); console.log('seed', s, 'MISMATCH', JSON.stringify(String(out).slice(0, 80)), 'vs', JSON.stringify(ref[0].slice(0, 80))); }
}
console.log(why);
console.log(`randdiff: ${N} programs, bad ${bad}, skipped ${skipped}, wasm ran ${wasmRan}`);
process.exit(bad ? 1 : 0);
