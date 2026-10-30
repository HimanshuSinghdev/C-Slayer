/* C-Slayer · worker: compiles and runs C off the UI thread.
 * Messages in : {type:'run', id, src} · {type:'stdin', id, text, eof} · {type:'stop', id} · {type:'score', id, src, stdin, tests}
 * Messages out: {type:'diag', id, ok, errors} · {type:'out', id, fd, s} · {type:'wait', id} · {type:'end', id, ...} · {type:'score-result', id, ...}
 * Everything is plain data. No eval, no network.
 */
'use strict';
importScripts('cc/lexer.js', 'cc/preproc.js', 'cc/types.js', 'cc/parser.js', 'cc/isa.js', 'cc/vm.js',
  'cc/headers.js', 'cc/libc.js', 'cc/cdecl.js', 'cc/cexpr.js', 'cc/cstmt.js', 'cc/cfmt.js', 'cc/compile.js', 'cc/score.js');

const RUN_LIMIT_MS = 30000;     // default CPU time for an interactive run (time spent waiting for input is not counted)
const SCORE_RUN_MS = 10000;     // main run during scoring
const TEST_RUN_MS = 5000;       // each test case
const TIME_CHOICES = [10, 30, 60, 120, 300], HEAP_CHOICES = [32, 64, 128, 256];
function pick(list, v, d) { v = +v; return list.indexOf(v) >= 0 ? v : d; }
function limitsOf(m) { const l = (m && m.limits) || {}; return { timeMs: pick(TIME_CHOICES, l.timeSec, 30) * 1000, heapMB: pick(HEAP_CHOICES, l.heapMB, 64) }; }
const MAX_TESTS = 25, MAX_TEST_TEXT = 20000, SLICE = 150000;

let session = null;            // { id, vm, running, stopped, spent }

function plainErrors(list) {
  return (list || []).slice(0, 80).map(e => ({ line: e.line | 0, col: e.col | 0, msg: String(e.msg).slice(0, 400), sev: e.sev === 'warning' ? 'warning' : e.sev === 'note' ? 'note' : 'error' }));
}
function plainErr(e) {
  if (!e) return null;
  return { kind: String(e.kind || 'error'), message: String(e.message || e.kind || ''), line: e.line | 0, fn: e.fn || null };
}
function plainLeaks(vm) {
  return vm.leaks().slice(0, 50).map(b => ({ size: b.size | 0, line: b.line | 0 }));
}
const tick = () => new Promise(r => setTimeout(r, 0));

/** Runs a VM to completion in slices; calls onOut(fd, s). Resolves {status, spent}. */
async function drive(s, limitMs, onOut, onWait) {
  const vm = s.vm;
  for (;;) {
    if (s.stopped) return 'stopped';
    const t0 = performance.now();
    const st = vm.run(SLICE);
    s.spent += performance.now() - t0;
    for (const q of vm.drainOutput()) onOut(q.fd, q.s);
    if (st === 'done') return 'done';
    if (st === 'error') return 'error';
    if (st === 'wait') {
      if (!onWait) { vm.feedInput('', true); continue; }
      await onWait();
      continue;
    }
    if (s.spent > limitMs) return 'timeout';
    await tick();
  }
}

async function handleRun(m) {
  if (session) session.stopped = true;
  const id = m.id;
  const c = CC.compile(String(m.src || ''), {});
  postMessage({ type: 'diag', id, ok: c.ok, errors: plainErrors(c.errors) });
  if (!c.ok) { postMessage({ type: 'end', id, compiled: false }); return; }
  const lim = limitsOf(m);
  const vm = new CC.VM(c.program, { heapMB: lim.heapMB });
  const s = session = { id, vm, stopped: false, spent: 0, wake: null };
  const status = await drive(s, lim.timeMs,
    (fd, str) => postMessage({ type: 'out', id, fd, s: str }),
    () => new Promise(res => { s.wake = res; postMessage({ type: 'wait', id }); }));
  if (session !== s) return;       // superseded
  let err = status === 'error' ? plainErr(vm.error) : status === 'timeout' ? { kind: 'timeout', message: 'Stopped after ' + (lim.timeMs / 1000) + ' seconds of running — probably an infinite loop. (You can raise the time limit in the Tests tab.)', line: vm.where ? vm.where().line | 0 : 0 } : null;
  postMessage({
    type: 'end', id, compiled: true, status, exit: status === 'done' ? vm.exitCode : null, error: err,
    leaks: status === 'done' ? plainLeaks(vm) : [], steps: vm.stepCount | 0
  });
  session = null;
}

function handleStdin(m) {
  if (!session || session.id !== m.id) return;
  session.vm.feedInput(String(m.text || '').slice(0, 1 << 20), !!m.eof);
  if (session.wake) { const w = session.wake; session.wake = null; if (!m.eof && !String(m.text || '').length) { /* nothing */ } w(); }
}

function normalise(t) {
  return String(t).replace(/\r/g, '').split('\n').map(l => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '');
}

async function runOnce(program, stdin, limitMs, heapMB) {
  const vm = new CC.VM(program, { heapMB: heapMB || 64 });
  vm.feedInput(stdin, true);
  const s = { vm, stopped: false, spent: 0 };
  let out = '', outLen = 0;
  const status = await drive(s, limitMs, (fd, str) => { if (fd === 1 && outLen < 400000) { out += str; outLen += str.length; } }, null);
  return {
    out, status, exit: status === 'done' ? vm.exitCode : null,
    runError: status === 'error' ? plainErr(vm.error) : status === 'timeout' ? { kind: 'timeout', message: 'timeout', line: 0 } : null,
    leaks: status === 'done' ? plainLeaks(vm) : []
  };
}

async function handleScore(m) {
  const id = m.id;
  if (session) { session.stopped = true; session = null; }
  const c = CC.compile(String(m.src || ''), {});
  let run = null; const tests = [];
  const lim = limitsOf(m);
  if (c.ok) {
    run = await runOnce(c.program, String(m.stdin || '').slice(0, MAX_TEST_TEXT), Math.max(SCORE_RUN_MS, Math.min(lim.timeMs, 60000)), lim.heapMB);
    const list = Array.isArray(m.tests) ? m.tests.slice(0, MAX_TESTS) : [];
    for (let i = 0; i < list.length; i++) {
      const t = list[i] || {};
      const name = String(t.name || 'Test ' + (i + 1)).slice(0, 60);
      const r = await runOnce(c.program, String(t.input || '').slice(0, MAX_TEST_TEXT), TEST_RUN_MS, lim.heapMB);
      const exp = normalise(String(t.expected || '').slice(0, MAX_TEST_TEXT));
      let pass = false, reason = '';
      if (r.runError) reason = r.runError.kind === 'timeout' ? 'timed out' : 'crashed (' + r.runError.message + ')';
      else { pass = normalise(r.out) === exp; if (!pass) reason = 'output differs'; }
      tests.push({ name, pass, reason, got: r.out.slice(0, 400), expected: exp.slice(0, 400) });
    }
  }
  const result = CC.score({ compile: c, run: run ? { runError: run.runError, exit: run.exit, leaks: run.leaks } : null, tests: tests.length ? tests : null });
  postMessage({ type: 'score-result', id, ok: c.ok, errors: plainErrors(c.errors), result, tests, run: run ? { out: run.out.slice(0, 4000), exit: run.exit, error: run.runError } : null });
}

self.onmessage = (ev) => {
  const m = ev.data || {};
  if (m.type === 'run') handleRun(m).catch(e => postMessage({ type: 'fatal', id: m.id, message: String(e && e.message || e) }));
  else if (m.type === 'stdin') handleStdin(m);
  else if (m.type === 'stop') { if (session && session.id === m.id) { session.stopped = true; if (session.wake) session.wake(); postMessage({ type: 'end', id: m.id, compiled: true, status: 'stopped', exit: null, error: null, leaks: [] }); session = null; } }
  else if (m.type === 'score') handleScore(m).catch(e => postMessage({ type: 'fatal', id: m.id, message: String(e && e.message || e) }));
};
postMessage({ type: 'ready' });
