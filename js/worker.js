/* C-Slayer · worker: compiles and runs C off the UI thread.
 * Messages in : {type:'run', id, src} · {type:'stdin', id, text, eof} · {type:'stop', id} · {type:'score', id, src, stdin, tests}
 * Messages out: {type:'diag', id, ok, errors} · {type:'out', id, fd, s} · {type:'wait', id} · {type:'end', id, ...} · {type:'score-result', id, ...}
 * Everything is plain data. No eval, no network.
 */
'use strict';
importScripts('cc/lexer.js', 'cc/preproc.js', 'cc/types.js', 'cc/parser.js', 'cc/isa.js', 'cc/vm.js', 'cc/turbo.js', 'cc/inspect.js',
  'cc/headers.js', 'cc/libc.js', 'cc/cdecl.js', 'cc/cexpr.js', 'cc/cstmt.js', 'cc/cfmt.js', 'cc/compile.js', 'cc/score.js');

const RUN_LIMIT_MS = 30000;     // default CPU time for an interactive run (time spent waiting for input is not counted)
const SCORE_RUN_MS = 10000;     // main run during scoring
const TEST_RUN_MS = 5000;       // each test case
const TIME_CHOICES = [10, 30, 60, 120, 300], HEAP_CHOICES = [32, 64, 128, 256];
function pick(list, v, d) { v = +v; return list.indexOf(v) >= 0 ? v : d; }
const OUT_SEND_CAP = 220000;   // a little over the screen's own cap (MAX_OUT in app.js)
function limitsOf(m) { const l = (m && m.limits) || {}; return { timeMs: pick(TIME_CHOICES, l.timeSec, 30) * 1000, heapMB: pick(HEAP_CHOICES, l.heapMB, 64) }; }
const MAX_TESTS = 25, MAX_TEST_TEXT = 20000, SLICE = 150000;

let session = null;            // { id, vm, running, stopped, spent }

function plainErrors(list) {
  return (list || []).slice(0, 80).map(e => ({ line: e.line | 0, col: e.col | 0, msg: String(e.msg).slice(0, 400), sev: e.sev === 'warning' ? 'warning' : e.sev === 'note' ? 'note' : 'error' }));
}
function plainErr(e, table) {
  if (!e) return null;
  let line = e.line | 0, message = String(e.message || e.kind || '');
  if (line >= 100000 && table) { const f = table.find(x => line >= x.base && line < x.base + 100000); if (f) { message += ' (in ' + f.name + ':' + (line - f.base) + ')'; line = 0; } }
  return { kind: String(e.kind || 'error'), message, line, fn: e.fn || null };
}
// other editor tabs, available to #include "name.h"
function userFilesOf(m) {
  const out = Object.create(null); let total = 0;
  const src = m && m.files && typeof m.files === 'object' ? m.files : {};
  for (const k of Object.keys(src).slice(0, 50)) {
    const v = src[k];
    if (typeof v !== 'string' || !/^[\w.\-]{1,40}$/.test(k)) continue;
    total += v.length; if (total > 600000) break;
    out[k] = v;
  }
  return out;
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
    if (st === 'break') return 'break';
    if (st === 'wait') {
      if (!onWait) { vm.feedInput('', true); continue; }
      await onWait();
      continue;
    }
    if (s.spent > limitMs) return 'timeout';
    await tick();
  }
}

async function handleRun(m, debugging) {
  if (session) session.stopped = true;
  const id = m.id;
  const c = CC.compile(String(m.src || ''), { userFiles: userFilesOf(m), debug: !!debugging });
  postMessage({ type: 'diag', id, ok: c.ok, errors: plainErrors(c.errors) });
  if (!c.ok) { postMessage({ type: 'end', id, compiled: false }); return; }
  const lim = limitsOf(m);
  let vm = new CC.VM(c.program, { heapMB: lim.heapMB });
  const s = session = { id, vm, stopped: false, spent: 0, wake: null, resume: null };
  if (debugging) vm.dbgSet('into', m.breakpoints);
  let status;
  const skip = { 1: 0, 2: 0 }, shown = { 1: 0, 2: 0 };      // `shown`: text already on screen; `skip`: what a redone run must not print again
  const post = (fd, str) => {
    if (skip[fd] > 0) { const k = Math.min(skip[fd], str.length); skip[fd] -= k; str = str.slice(k); if (!str.length) return; }
    shown[fd] += str.length;
    // Batch: one message per printf floods the page when a loop prints forever and freezes it (even the Stop button). Send
    // merged text every ~50 ms, and nothing past what the screen keeps anyway.
    if (sentChars > OUT_SEND_CAP) return;
    sentChars += str.length;
    const last = pend[pend.length - 1];
    if (last && last.fd === fd) last.s += str; else pend.push({ fd, s: str });
    pendLen += str.length;
    if (pendLen > 32768 || performance.now() - lastSend > 50) sendOut();
  };
  let pend = [], pendLen = 0, sentChars = 0, lastSend = performance.now();
  const sendOut = () => { lastSend = performance.now(); if (!pend.length) return; const list = pend; pend = []; pendLen = 0; for (const q of list) postMessage({ type: 'out', id, fd: q.fd, s: q.s }); };
  s.stdinAll = ''; s.eof = false; const startMs = Date.now();
  // Turbo: translate to JS and let the browser's JIT run it. When the program needs more keyboard input the run is
  // paused by *replaying*: ask for the line, then run again from the top with everything typed so far, hiding the text
  // already shown. C programs here are deterministic (time() is pinned), so the replay prints exactly the same prefix.
  if (!debugging && !m.noTurbo && CC.Turbo) {
    for (let attempt = 0; ; attempt++) {
      if (attempt > 0) { vm = s.vm = new CC.VM(c.program, { heapMB: lim.heapMB, startMs }); vm.feedInput(s.stdinAll, s.eof); }
      else vm.startMs = startMs;
      skip[1] = shown[1]; skip[2] = shown[2];
      let mod = null; const t0 = performance.now();
      const flush = () => { for (const q of vm.drainOutput()) post(q.fd, q.s); };
      try { mod = CC.Turbo.build(vm, { needInput: true, tick() { flush(); if (performance.now() - t0 > lim.timeMs) throw new CC.Turbo.TurboTimeout(); } }); } catch (e) { mod = null; }
      if (!mod) break;
      status = CC.Turbo.run(vm, mod); flush();
      if (status === 'overflow') { skip[1] = shown[1]; skip[2] = shown[2]; vm = s.vm = new CC.VM(c.program, { heapMB: lim.heapMB, startMs }); vm.feedInput(s.stdinAll, s.eof); status = undefined; break; }
      if (status !== 'wait') break;
      if (s.stopped) { status = 'stopped'; break; }
      const had = s.stdinAll.length;
      sendOut(); await new Promise(res => { s.wake = res; postMessage({ type: 'wait', id }); });
      if (s.stopped) { status = 'stopped'; break; }
      if (s.stdinAll.length === had && !s.eof) { s.eof = true; }   // woken with nothing new: treat as end of input
    }
    if (status === undefined && vm === s.vm) { /* fall through to the VM below */ }
  }
  while (status === undefined) {
    status = await drive(s, lim.timeMs, post,
      () => { sendOut(); return new Promise(res => { s.wake = res; postMessage({ type: 'wait', id }); }); });
    if (status === 'break') {
      sendOut(); postMessage({ type: 'paused', id, snap: vm.inspect() });
      await new Promise(res => { s.resume = res; });
      if (s.stopped) { status = 'stopped'; break; }
      status = undefined;
    }
  }
  if (session !== s) return;       // superseded
  sendOut();
  let err = status === 'error' ? plainErr(vm.error, c.fileTable) : status === 'timeout' ? { kind: 'timeout', message: 'Stopped after ' + (lim.timeMs / 1000) + ' seconds of running — probably an infinite loop. (You can raise the time limit in the Tests tab.)', line: vm.where ? vm.where().line | 0 : 0 } : null;
  postMessage({
    type: 'end', id, compiled: true, status, exit: status === 'done' ? vm.exitCode : null, error: err,
    leaks: status === 'done' ? plainLeaks(vm) : [], steps: vm.stepCount | 0
  });
  session = null;
}

function handleStdin(m) {
  if (!session || session.id !== m.id) return;
  const txt = String(m.text || '').slice(0, 1 << 20);
  session.vm.feedInput(txt, !!m.eof);
  session.stdinAll = (session.stdinAll || '') + txt; if (m.eof) session.eof = true;
  if (session.wake) { const w = session.wake; session.wake = null; if (!m.eof && !String(m.text || '').length) { /* nothing */ } w(); }
}

function normalise(t) {
  return String(t).replace(/\r/g, '').split('\n').map(l => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '');
}

async function runOnce(program, stdin, limitMs, heapMB) {
  let vm = new CC.VM(program, { heapMB: heapMB || 64 });
  vm.feedInput(stdin, true);
  let out = '', outLen = 0, errLen = 0;
  if (CC.Turbo) {      // stdin is complete, so nothing can block: Turbo is safe here
    let mod = null; const t0 = performance.now();
    const take = () => { for (const q of vm.drainOutput()) { if (q.fd === 1 && outLen < 400000) { out += q.s; outLen += q.s.length; } else if (q.fd === 2) errLen += q.s.length; } };
    try { mod = CC.Turbo.build(vm, { tick() { take(); if (performance.now() - t0 > limitMs) throw new CC.Turbo.TurboTimeout(); } }); } catch (e) { mod = null; }
    if (mod) {
      const st = CC.Turbo.run(vm, mod); take();
      if (st !== 'overflow') return {
        out, status: st, exit: st === 'done' ? vm.exitCode : null, hadStderr: errLen > 0, noInput: !stdin,
        runError: st === 'error' ? plainErr(vm.error, null) : st === 'timeout' ? { kind: 'timeout', message: 'timeout', line: 0 } : null,
        leaks: st === 'done' ? plainLeaks(vm) : []
      };
      out = ''; outLen = 0; errLen = 0;
      vm = new CC.VM(program, { heapMB: heapMB || 64 }); vm.feedInput(stdin, true);
    }
  }
  const s = { vm, stopped: false, spent: 0 };
  const status = await drive(s, limitMs, (fd, str) => { if (fd === 1 && outLen < 400000) { out += str; outLen += str.length; } else if (fd === 2) errLen += str.length; }, null);
  return {
    out, status, exit: status === 'done' ? vm.exitCode : null, hadStderr: errLen > 0, noInput: !stdin,
    runError: status === 'error' ? plainErr(vm.error, null) : status === 'timeout' ? { kind: 'timeout', message: 'timeout', line: 0 } : null,
    leaks: status === 'done' ? plainLeaks(vm) : []
  };
}

function list0(m) { return Array.isArray(m.tests) && m.tests.length > 0; }

async function handleScore(m) {
  const id = m.id;
  if (session) { session.stopped = true; session = null; }
  const c = CC.compile(String(m.src || ''), { userFiles: userFilesOf(m) });
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
  let probes = null;
  if (c.ok && run && !list0(m) && CC.scoreProbes.wantsProbes(c.source || m.src)) {
    probes = [];
    for (const q of CC.scoreProbes.inputs) {
      const r = await runOnce(c.program, q.in, q.big ? 2000 : 1000, lim.heapMB);
      probes.push({ id: q.id, in: q.in, big: !!q.big, out: r.out.slice(0, 400), exit: r.exit, runError: r.runError });
    }
  }
  const result = CC.score({ compile: c, probes, run: run ? { runError: run.runError, exit: run.exit, leaks: run.leaks, hadStderr: run.hadStderr, noInput: run.noInput } : null, tests: tests.length ? tests : null });
  postMessage({ type: 'score-result', id, ok: c.ok, errors: plainErrors(c.errors), result, tests, run: run ? { out: run.out.slice(0, 4000), exit: run.exit, error: run.runError } : null });
}

self.onmessage = (ev) => {
  const m = ev.data || {};
  if (m.type === 'debug') handleRun(m, true).catch(e => postMessage({ type: 'fatal', id: m.id, message: String(e && e.message || e) }));
  else if (m.type === 'dstep') {
    if (session && session.id === m.id && session.resume) {
      const r = session.resume; session.resume = null;
      session.vm.dbgSet(['into', 'over', 'out', 'run'].indexOf(m.mode) >= 0 ? m.mode : 'run', Array.isArray(m.breakpoints) ? m.breakpoints.slice(0, 200).map(x => x | 0) : []);
      r();
    }
  } else if (m.type === 'setbp') { if (session && session.vm.dbg) session.vm.dbg.bp = new Set((m.breakpoints || []).slice(0, 200).map(x => x | 0)); }
  else if (m.type === 'run') handleRun(m).catch(e => postMessage({ type: 'fatal', id: m.id, message: String(e && e.message || e) }));
  else if (m.type === 'stdin') handleStdin(m);
  else if (m.type === 'stop') { if (session && session.id === m.id) { session.stopped = true; if (session.wake) session.wake(); if (session.resume) session.resume(); postMessage({ type: 'end', id: m.id, compiled: true, status: 'stopped', exit: null, error: null, leaks: [] }); session = null; } }
  else if (m.type === 'score') handleScore(m).catch(e => postMessage({ type: 'fatal', id: m.id, message: String(e && e.message || e) }));
};
postMessage({ type: 'ready' });
