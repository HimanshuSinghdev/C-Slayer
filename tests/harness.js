// Loads every engine module and exposes run(src, {stdin}) -> {ok, errors, out, err, exit, runError, vm}
const load = require('./load');
const CC = load(['lexer.js','preproc.js','types.js','parser.js','isa.js','vm.js','inspect.js','headers.js','libc.js','cdecl.js','cexpr.js','cstmt.js','cfmt.js','compile.js','score.js']);
function run(src, opts) {
  opts = opts || {};
  const c = CC.compile(src, opts);
  const res = { ok: c.ok, errors: c.errors, out: '', err: '', exit: null, runError: null, compile: c };
  if (!c.ok) return res;
  const vm = new CC.VM(c.program, { vfs: opts.vfs });
  res.vm = vm;
  if (opts.stdin !== undefined) vm.feedInput(opts.stdin, true);
  let guard = 0;
  for (;;) {
    const st = vm.run(100000);
    for (const q of vm.drainOutput()) { if (q.fd === 2) res.err += q.s; else res.out += q.s; }
    if (st === 'done') { res.exit = vm.exitCode; break; }
    if (st === 'error') { res.runError = vm.error; break; }
    if (st === 'wait') { vm.feedInput('', true); }
    if (++guard > (opts.maxSlices || 20000)) { res.runError = { kind: 'timeout', message: 'timeout' }; break; }
  }
  if (!res.runError) { res.leaks = vm.leaks(); }
  return res;
}
module.exports = { CC, run };
