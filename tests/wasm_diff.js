// differential: VM vs the WebAssembly tier on every corpus program (stdout, exit code, error kind); counts what falls back and why
const fs = require('fs'), path = require('path');
const load = require('./load');
const CC = load(['lexer.js', 'preproc.js', 'types.js', 'parser.js', 'isa.js', 'vm.js', 'inspect.js', 'headers.js', 'libc.js', 'cdecl.js', 'cexpr.js', 'cstmt.js', 'cfmt.js', 'compile.js', 'turbo.js', 'wasm.js']);
const dir = path.join(__dirname, 'corpus'), only = process.argv[2];
let ok = 0, bad = 0, unsup = 0; const why = {};
function runVM(c, stdin) {
  const vm = new CC.VM(c.program, {}); vm.feedInput(stdin, true); let out = '';
  for (let g = 0; g < 100000; g++) { const st = vm.run(100000); for (const q of vm.drainOutput()) if (q.fd !== 2) out += q.s;
    if (st === 'done') return { out, exit: vm.exitCode }; if (st === 'error') return { out, err: vm.error.kind, line: vm.error.line }; if (st === 'wait') vm.feedInput('', true); }
  return { out, err: 'timeout' };
}
function runW(c, stdin, P) {
  const vm = new CC.VM(c.program, { wasm: true }); vm.feedInput(stdin, true); let out = '';
  const t0 = Date.now();
  const mod = CC.Wasm.build(vm, P, { tick() { if (Date.now() - t0 > 4000) throw new CC.Turbo.TurboTimeout(); for (const q of vm.drainOutput()) if (q.fd !== 2) out += q.s; } });
  const st = CC.Turbo.run(vm, mod); for (const q of vm.drainOutput()) if (q.fd !== 2) out += q.s;
  if (st === 'done') return { out, exit: vm.exitCode };
  if (st === 'error') return { out, err: vm.error.kind, line: vm.error.line, msg: vm.error.message };
  return { out, err: st };
}
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.c')).sort()) {
  if (only && !f.includes(only)) continue;
  const src = fs.readFileSync(path.join(dir, f), 'utf8'), inf = path.join(dir, f.replace(/\.c$/, '.in'));
  const stdin = fs.existsSync(inf) ? fs.readFileSync(inf, 'utf8') : '';
  const c = CC.compile(src, {}); if (!c.ok) continue;
  let P; try { P = CC.Wasm.analyze(c.program); } catch (e) { if (e instanceof CC.Wasm.Unsupported) { unsup++; const k = e.message.replace(/\d+/g, '#'); why[k] = (why[k] || 0) + 1; if (only || process.env.LIST) console.log(f, "UNSUP", e.message); continue; } console.log('EXC analyze', f, e.stack.split('\n').slice(0, 3).join(' | ')); bad++; continue; }
  const a = runVM(c, stdin); let b;
  try { b = runW(c, stdin, P); } catch (e) { if (e instanceof CC.Wasm.Unsupported) { unsup++; const k = 'build: ' + e.message.replace(/\d+/g, '#'); why[k] = (why[k] || 0) + 1; if (only || process.env.LIST) console.log(f, "UNSUP", e.message); continue; } console.log('EXC', f, e.message.slice(0, 160)); bad++; continue; }
  if (b.err === 'overflow') continue;
  if (a.out === b.out && a.exit === b.exit && a.err === b.err && a.line === b.line) ok++; else { bad++; console.log('DIFF', f, JSON.stringify([a.exit, a.err, a.line, a.out.slice(0, 40)]), JSON.stringify([b.exit, b.err, b.line, b.out.slice(0, 40), b.msg])); }
}
console.log({ ok, bad, unsup }); const top = Object.entries(why).sort((x, y) => y[1] - x[1]).slice(0, 12); for (const [k, v] of top) console.log(String(v).padStart(4), k);
