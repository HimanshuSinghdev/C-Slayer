/* C-Slayer · UI controller. All program text is rendered with textContent only. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };
  const MAX_OUT = 1000000;

  // ---------------- state ----------------
  let files = LS.get('cs.files', null);
  if (!Array.isArray(files) || !files.length) files = [{ name: 'main.c', code: window.SAMPLES[0].code }];
  files = files.filter(f => f && typeof f.name === 'string' && typeof f.code === 'string').slice(0, 50);
  if (!files.length) files = [{ name: 'main.c', code: window.SAMPLES[0].code }];
  let cur = Math.min(Math.max(0, LS.get('cs.cur', 0) | 0), files.length - 1);
  let limits = LS.get('cs.limits', { timeSec: 30, heapMB: 64 }); if (!limits || typeof limits !== 'object') limits = { timeSec: 30, heapMB: 64 };
  let tests = LS.get('cs.tests', []); if (!Array.isArray(tests)) tests = [];
  let stdinText = LS.get('cs.stdin', ''); if (typeof stdinText !== 'string') stdinText = '';
  let worker = null, runId = 0, outLen = 0, marks = [];

  // ---------------- editor ----------------
  const cm = CodeMirror.fromTextArea($('#code'), {
    mode: 'text/x-csrc', theme: 'slayer', lineNumbers: true, indentUnit: 4, tabSize: 4, indentWithTabs: false, smartIndent: true,
    matchBrackets: true, styleActiveLine: false, lineWrapping: false, gutters: ['CodeMirror-linenumbers', 'bp', 'gut'],
    extraKeys: {
      'Ctrl-Enter': () => run(), 'Cmd-Enter': () => run(), 'Ctrl-Space': (c) => window.CSlayerComplete.ctrlSpace(c),
      Tab: (c) => { if (c.somethingSelected()) c.indentSelection('add'); else c.replaceSelection('    ', 'end'); },
      'Shift-Tab': (c) => c.indentSelection('subtract')
    },
    inputStyle: 'contenteditable', autocorrect: false, autocapitalize: false, spellcheck: false
  });
  cm.setValue(files[cur].code);
  // ---- theme (Paper / Slate) and text size ----
  const root = document.documentElement;
  function isDark() { const t = root.getAttribute('data-theme'); return t ? t === 'slate' : !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches); }
  function applyTheme(t) {
    if (t === 'paper' || t === 'slate') root.setAttribute('data-theme', t); else root.removeAttribute('data-theme');
    $('#btnTheme').classList.toggle('is-dark', isDark());
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', isDark() ? '#1e2926' : '#e8ecf0');
  }
  applyTheme(LS.get('cs.theme', null));
  // wipe the whole editor in one tap; it is one undo step (Ctrl+Z) so a slip is recoverable
  $('#btnClear').onclick = () => {
    if (debugging) return toast('Stop debugging first');
    if (!cm.getValue().trim()) return toast('Nothing to clear');
    if (!confirm('Clear all code in ' + files[cur].name + '? (Ctrl+Z brings it back)')) return;
    cm.operation(() => cm.replaceRange('', { line: 0, ch: 0 }, { line: cm.lastLine(), ch: cm.getLine(cm.lastLine()).length }));
    cm.focus(); save(); toast('Cleared');
  };
  $('#btnTheme').onclick = () => { const t = isDark() ? 'paper' : 'slate'; LS.set('cs.theme', t); applyTheme(t); };
  const SIZES = [13, 14, 16, 18];
  let fsIdx = Math.max(0, SIZES.indexOf(LS.get('cs.fs', 14)));
  function applySize() { const f = SIZES[fsIdx]; root.style.setProperty('--fs', f + 'px'); root.style.setProperty('--lh', Math.round(f * 1.5) + 'px'); cm.refresh(); }
  $('#fsSel').value = String(SIZES[fsIdx]);
  $('#fsSel').addEventListener('change', (e) => { const i = SIZES.indexOf(+e.target.value); if (i >= 0) { fsIdx = i; LS.set('cs.fs', SIZES[i]); applySize(); } });
  applySize();
  window.CSlayerComplete.attach(cm);
  // ---- auto-close brackets/quotes (works with Android keyboards, which don't send keypress events) ----
  const OPEN = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" }, CLOSERS = ')]}"\'';
  const isWord = (c) => /[\w]/.test(c || '');
  function pairInput(c, ch) {
    // ch: the single character just typed, cursor is right after it
    const cur0 = c.getCursor(), line = c.getLine(cur0.line), prev = line.charAt(cur0.ch - 2), next = line.charAt(cur0.ch);
    const quote = ch === '"' || ch === "'";
    if (CLOSERS.indexOf(ch) >= 0 && !quote && next === ch) {
      c.replaceRange('', { line: cur0.line, ch: cur0.ch - 1 }, cur0, '+pair'); c.setCursor({ line: cur0.line, ch: cur0.ch }); return true;
    }
    if (OPEN[ch] === undefined) return false;
    if (quote && next === ch) { c.replaceRange('', { line: cur0.line, ch: cur0.ch - 1 }, cur0, '+pair'); c.setCursor({ line: cur0.line, ch: cur0.ch }); return true; }
    if (quote && (isWord(prev) || (ch === "'" && /\d/.test(prev || '')))) return false;
    if (next && /[\w\(\["']/.test(next) && !quote) return false;
    if (quote && next && isWord(next)) return false;
    c.replaceRange(OPEN[ch], cur0, cur0, '+pair'); c.setCursor(cur0);
    return true;
  }
  cm.on('changes', (c, list) => {
    if (list.length !== 1) return;
    const ch = list[0];
    if (ch.origin !== '+input' || c.somethingSelected() || ch.text.length > 2 || (ch.removed && ch.removed.join('').length)) return;
    if (ch.text.length === 1 && ch.text[0].length === 1) { pairInput(c, ch.text[0]); return; }
    if (ch.text.length === 2 && ch.text[0] === '' ) {   // Enter between { and }
      const cu = c.getCursor(), ln = c.getLine(cu.line), up = c.getLine(cu.line - 1) || '';
      if (up.replace(/\s+$/, '').slice(-1) === '{' && ln.trim().charAt(0) === '}') {
        const base = up.match(/^\s*/)[0], mid = base + '    ';
        c.operation(() => {
          c.replaceRange(mid + '\n' + base, { line: cu.line, ch: 0 }, { line: cu.line, ch: ln.length - ln.trim().length }, '+pair');
          c.setCursor({ line: cu.line, ch: mid.length });
        });
      }
    }
  });
  // Backspace on an empty pair () [] {} "" '' removes both
  cm.on('beforeChange', (c, ch) => {
    if (ch.origin !== '+delete' || ch.from.line !== ch.to.line || ch.to.ch - ch.from.ch !== 1 || c.somethingSelected()) return;
    const ln = c.getLine(ch.from.line), o = ln.charAt(ch.from.ch), n = ln.charAt(ch.to.ch);
    if (OPEN[o] !== undefined && OPEN[o] === n) ch.update(ch.from, { line: ch.to.line, ch: ch.to.ch + 1 });
  });
  window.CSlayerComplete.attach(cm);
  let saveT = 0;
  cm.on('change', () => {
    files[cur].code = cm.getValue();
    clearTimeout(saveT); saveT = setTimeout(save, 400);
    clearMarks();
  });
  // ---------------- breakpoints & debugger ----------------
  let bpLines = new Set(LS.get('cs.bp.' + (files[cur] && files[cur].name), []));
  let debugging = false, paused = false, curDbgLine = 0;
  function saveBp() { LS.set('cs.bp.' + files[cur].name, [...bpLines]); }
  function drawBp() {
    cm.clearGutter('bp');
    for (const ln of bpLines) { if (ln > cm.lineCount()) continue; const d = document.createElement('div'); d.className = 'bp-dot'; d.textContent = '●'; cm.setGutterMarker(ln - 1, 'bp', d); }
  }
  function toggleBp(line) { if (bpLines.has(line)) bpLines.delete(line); else bpLines.add(line); saveBp(); drawBp(); if (debugging && worker) worker.postMessage({ type: 'setbp', id: runId, breakpoints: [...bpLines] }); }
  cm.on('gutterClick', (c, n, gutter) => { if (gutter === 'bp' || gutter === 'CodeMirror-linenumbers') toggleBp(n + 1); });
  function showCurLine(line) {
    if (curDbgLine) { try { cm.removeLineClass(curDbgLine - 1, 'background', 'cm-curline'); } catch (e) { /* */ } }
    curDbgLine = line;
    if (line > 0 && line <= cm.lineCount()) { cm.addLineClass(line - 1, 'background', 'cm-curline'); cm.scrollIntoView({ line: line - 1, ch: 0 }, 90); }
  }
  function endDebug() {
    debugging = false; paused = false; showCurLine(0); cm.setOption('readOnly', false);
    $('#tabDebug').hidden = true; $('#btnDebug').hidden = false;
  }
  function el2(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function varRow(v, depth) {
    const box = el2('div', 'vrow');
    const head = el2('div', 'vhead');
    head.appendChild(el2('span', 'vname', v.name || ''));
    head.appendChild(el2('span', 'vtype', v.type || ''));
    head.appendChild(el2('span', 'vtext', v.text === undefined ? '' : v.text));
    if (v.hint) head.appendChild(el2('span', 'vwarn', v.hint));
    if (v.where) head.appendChild(el2('span', 'vwhere', '→ ' + v.where));
    box.appendChild(head);
    const kids = v.kids || (v.deref ? [Object.assign({}, v.deref, { name: '*' + (v.name || 'ptr') })] : null);
    if (kids && kids.length && depth < 4) {
      const det = document.createElement('details'); if (depth === 0 && v.kids && v.kids.length <= 8) det.open = true;
      det.appendChild(el2('summary', '', kids.length + (v.deref && !v.kids ? ' → pointed-to value' : ' items')));
      for (const k of kids) det.appendChild(varRow(k, depth + 1));
      box.appendChild(det);
    }
    return box;
  }
  function renderSnap(snap) {
    showCurLine(snap.line);
    const st = $('#dStack'); st.textContent = '';
    snap.stack.forEach((f, i) => st.appendChild(el2('div', 'sframe' + (i === 0 ? ' top' : ''), f.fn + '()  line ' + f.line)));
    const vs = $('#dVars'); vs.textContent = '';
    const top = snap.stack[0];
    if (top) { vs.appendChild(el2('h4', 'dh', 'Variables in ' + top.fn + '()')); if (!top.vars.length) vs.appendChild(el2('p', 'hint', 'No variables yet.')); for (const v of top.vars) vs.appendChild(varRow(v, 0)); }
    snap.stack.slice(1).forEach(f => { if (!f.vars.length) return; vs.appendChild(el2('h4', 'dh', 'In caller ' + f.fn + '()')); for (const v of f.vars) vs.appendChild(varRow(v, 0)); });
    const hp = $('#dHeap'); hp.textContent = '';
    if (!snap.heap.length) hp.appendChild(el2('p', 'hint', 'Nothing allocated yet.'));
    const mx = Math.max(16, ...snap.heap.map(b => b.size));
    for (const b of snap.heap) {
      const r = el2('div', 'hblock' + (b.freed ? ' freed' : ''));
      const bar = el2('i'); bar.style.width = Math.max(4, Math.round(100 * b.size / mx)) + '%'; r.appendChild(bar);
      r.appendChild(el2('span', '', '0x' + b.addr.toString(16) + ' · ' + b.size + ' bytes · line ' + b.line + (b.freed ? ' · FREED' : ' · in use')));
      hp.appendChild(r);
    }
  }
  function startDebug() {
    if (!$('#btnStop').hidden || debugging) return;
    resetOutput(); setState('running'); clearMarks(); debugging = true; paused = false;
    cm.setOption('readOnly', 'nocursor'); $('#tabDebug').hidden = false; showTab('debug'); $('#btnDebug').hidden = true;
    $('#btnRun').hidden = true; $('#btnStop').hidden = true; $('#btnScore').disabled = true;
    $('#dStack').textContent = ''; $('#dVars').textContent = ''; $('#dHeap').textContent = '';
    runId++; ensureWorker().postMessage({ type: 'debug', id: runId, src: cm.getValue(), limits, files: otherFiles(), breakpoints: [...bpLines] });
  }
  function dstep(mode) { if (!debugging || !paused || !worker) return; paused = false; $('#dHint').textContent = mode === 'run' ? 'Running…' : 'Stepping…'; worker.postMessage({ type: 'dstep', id: runId, mode, breakpoints: [...bpLines] }); }
  function stopDebug() { if (worker) worker.postMessage({ type: 'stop', id: runId }); }
  $('#btnDebug').onclick = startDebug;
  $('#dContinue').onclick = () => dstep('run'); $('#dOver').onclick = () => dstep('over'); $('#dInto').onclick = () => dstep('into'); $('#dOut').onclick = () => dstep('out'); $('#dStop').onclick = stopDebug;
  document.addEventListener('keydown', (e) => {
    if (!debugging) { if (e.key === 'F8') { e.preventDefault(); startDebug(); } return; }
    if (e.key === 'F8') { e.preventDefault(); dstep('run'); } else if (e.key === 'F10') { e.preventDefault(); dstep('over'); } else if (e.key === 'F11') { e.preventDefault(); dstep(e.shiftKey ? 'out' : 'into'); }
  });
  function save() { LS.set('cs.files', files); LS.set('cs.cur', cur); }
  function clearMarks() { for (const m of marks) { try { cm.removeLineClass(m, 'background'); cm.setGutterMarker(m, 'gut', null); } catch (e) { /* line gone */ } } marks = []; }
  function markLines(errors) {
    clearMarks();
    const best = new Map();
    for (const e of errors) { if (e.line < 1 || e.line > cm.lineCount()) continue; const prev = best.get(e.line); if (!prev || (e.sev === 'error' && prev !== 'error')) best.set(e.line, e.sev); }
    for (const [ln, sev] of best) {
      const h = ln - 1; marks.push(h);
      cm.addLineClass(h, 'background', sev === 'error' ? 'cm-lineerr' : 'cm-linewarn');
      const g = document.createElement('div'); g.className = sev === 'error' ? 'gut-err' : 'gut-warn'; g.textContent = sev === 'error' ? '✖' : '▲';
      cm.setGutterMarker(h, 'gut', g);
    }
  }

  // ---------------- files ----------------
  function renderFiles() {
    const sel = $('#fileSel'); sel.textContent = '';
    files.forEach((f, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = f.name; sel.appendChild(o); });
    sel.value = String(cur);
  }
  function cleanName(n) { n = String(n || '').replace(/[^\w.\- ]/g, '').trim().slice(0, 40); if (!n) return ''; if (!/\.[ch]$/i.test(n)) n += '.c'; return n; }
  $('#fileSel').addEventListener('change', (e) => { if (debugging) { e.target.value = String(cur); return toast('Stop debugging first'); } cur = +e.target.value | 0; bpLines = new Set(LS.get('cs.bp.' + files[cur].name, [])); drawBp(); cm.setValue(files[cur].code); cm.clearHistory(); save(); resetOutput(); });
  $('#fNew').onclick = () => { const n = cleanName(prompt('File name', 'program' + (files.length + 1) + '.c')); if (!n) return; if (files.length >= 50) return toast('Too many files'); files.push({ name: n, code: '#include <stdio.h>\n\nint main(void) {\n    \n    return 0;\n}\n' }); cur = files.length - 1; renderFiles(); cm.setValue(files[cur].code); save(); };
  $('#fRen').onclick = () => { const n = cleanName(prompt('Rename file', files[cur].name)); if (!n) return; files[cur].name = n; renderFiles(); save(); };
  $('#fDel').onclick = () => { if (files.length < 2) return toast('Keep at least one file'); if (!confirm('Delete ' + files[cur].name + '?')) return; files.splice(cur, 1); cur = Math.max(0, cur - 1); renderFiles(); cm.setValue(files[cur].code); save(); };
  $('#fDl').onclick = () => { const b = new Blob([cm.getValue()], { type: 'text/plain' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = files[cur].name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); };
  $('#fUp').onclick = () => $('#fileIn').click();
  $('#fileIn').addEventListener('change', (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (f.size > 300000) return toast('File too large (max 300 KB)');
    const r = new FileReader(); r.onload = () => { const n = cleanName(f.name) || 'upload.c'; files.push({ name: n, code: String(r.result) }); cur = files.length - 1; renderFiles(); cm.setValue(files[cur].code); save(); }; r.readAsText(f);
  });
  const sm = $('#samples');
  window.SAMPLES.forEach((s, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = s.name; sm.appendChild(o); });
  sm.addEventListener('change', () => { const s = window.SAMPLES[+sm.value]; sm.value = ''; if (!s) return; files.push({ name: cleanName(s.name.replace(/[^\w ]/g, '').replace(/\s+/g, '_').toLowerCase()) || 'sample.c', code: s.code }); cur = files.length - 1; renderFiles(); cm.setValue(s.code); save(); resetOutput(); });

  // ---------------- tabs ----------------
  function showTab(name) {
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
    document.querySelectorAll('.tabpane').forEach(p => p.classList.toggle('on', p.id === 'p-' + name));
  }
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

  // ---------------- toast ----------------
  let toastT = 0;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2200); }

  // ---------------- output ----------------
  const out = $('#out');
  function resetOutput() { out.textContent = ''; outLen = 0; $('#inForm').hidden = true; }
  function put(text, cls) {
    if (outLen > MAX_OUT) return;
    outLen += text.length;
    if (!cls) { const last = out.lastChild; if (last && last.nodeType === 3) { last.nodeValue += text; } else out.appendChild(document.createTextNode(text)); }
    else { const s = document.createElement('span'); s.className = cls; s.textContent = text; out.appendChild(s); }
    if (outLen > MAX_OUT) { const s = document.createElement('span'); s.className = 'm'; s.textContent = '\n… output truncated …'; out.appendChild(s); }
    out.scrollTop = out.scrollHeight;
  }
  function setState(s) { document.body.dataset.state = s; }

  // ---------------- problems ----------------
  function renderProblems(errors) {
    const ul = $('#probList'); ul.textContent = '';
    const ne = errors.filter(e => e.sev === 'error').length, nw = errors.filter(e => e.sev === 'warning').length;
    const badge = $('#probCount'); badge.hidden = !(ne + nw); badge.textContent = String(ne || nw); badge.classList.toggle('w', !ne);
    $('#probEmpty').hidden = errors.length > 0;
    for (const e of errors) {
      const li = document.createElement('li');
      const ln = document.createElement('span'); ln.className = 'ln'; ln.textContent = e.line ? 'L' + e.line : '';
      const sv = document.createElement('span'); sv.className = 'sv ' + e.sev; sv.textContent = e.sev;
      const tx = document.createElement('span'); tx.textContent = e.msg;
      const body = document.createElement('div'); body.className = 'pbody'; body.appendChild(tx);
      const ex = e.sev === 'note' ? null : window.CC.explain(e.msg);
      if (ex) {
        const w = document.createElement('div'); w.className = 'why'; w.textContent = ex.why; body.appendChild(w);
        if (ex.fix) { const f = document.createElement('div'); f.className = 'fix'; f.textContent = '→ ' + ex.fix; body.appendChild(f); }
      }
      li.append(ln, sv, body);
      li.addEventListener('click', () => { if (e.line > 0) { cm.focus(); cm.setCursor(Math.min(e.line, cm.lineCount()) - 1, 0); cm.scrollIntoView({ line: e.line - 1, ch: 0 }, 80); } });
      ul.appendChild(li);
    }
  }

  // ---------------- worker ----------------
  function ensureWorker() {
    if (worker) return worker;
    worker = new Worker('js/worker.js');
    worker.onmessage = (ev) => onMsg(ev.data || {});
    worker.onerror = () => { setState('error'); put('\nThe engine crashed and was restarted.\n', 'e'); finish(); try { worker.terminate(); } catch (e) { /* */ } worker = null; };
    return worker;
  }
  function finish() { if (debugging && !paused && false) return; $('#btnRun').hidden = false; $('#btnStop').hidden = true; $('#inForm').hidden = true; $('#btnScore').disabled = false; }

  function otherFiles() { const o = {}; files.forEach((f, i) => { if (i !== cur) o[f.name] = f.code; }); return o; }
  function run() {
    if (!$('#btnStop').hidden) return;
    resetOutput(); showTab('console'); setState('running'); clearMarks();
    $('#btnRun').hidden = true; $('#btnStop').hidden = false; $('#btnScore').disabled = true;
    runId++; ensureWorker().postMessage({ type: 'run', id: runId, src: cm.getValue(), limits, files: otherFiles() });
  }
  function stop() {
    if (!worker) return;
    const rid = runId, w = worker;
    w.postMessage({ type: 'stop', id: rid });
    // a Turbo run is one long synchronous stretch and cannot read the message: if nothing answers, restart the engine
    setTimeout(() => {
      if (worker !== w || runId !== rid || $('#btnStop').hidden) return;
      try { w.terminate(); } catch (e) { /* */ } worker = null;
      put('\n[stopped]\n', 'm'); setState('idle'); finish();
    }, 500);
  }
  $('#btnRun').onclick = run; $('#btnStop').onclick = stop;

  function onMsg(m) {
    if (m.type === 'ready' || (m.id !== undefined && m.id !== runId && m.type !== 'score-result')) return;
    switch (m.type) {
      case 'diag': renderProblems(m.errors); markLines(m.errors);
        if (!m.ok) { setState('error'); showTab('problems'); } break;
      case 'out': put(String(m.s), m.fd === 2 ? 'e' : ''); break;
      case 'wait': { const f = $('#inForm'); f.hidden = false; $('#inLine').focus(); break; }
      case 'paused': paused = true; $('#dHint').textContent = 'Paused at line ' + m.snap.line + '. Step with Over / Into / Out, or Continue.'; renderSnap(m.snap); break;
      case 'end': if (debugging) endDebug(); finish(); onEnd(m); break;
      case 'fatal': setState('error'); put('\nInternal error: ' + m.message + '\n', 'e'); finish(); break;
      case 'score-result': onScore(m); break;
    }
  }
  function onEnd(m) {
    if (!m.compiled) { put('Compilation failed — see Problems.\n', 'e'); return; }
    if (m.status === 'stopped') { put('\n[stopped]\n', 'm'); setState('idle'); return; }
    const nl = out.textContent.length && !out.textContent.endsWith('\n') ? '\n' : '';
    if (m.error) {
      setState('error');
      put(nl + '✖ ' + m.error.message + (m.error.line ? '  (line ' + m.error.line + (m.error.fn ? ', in ' + m.error.fn + '()' : '') + ')' : '') + '\n', 'e');
      if (m.error.line) markLines([{ line: m.error.line, sev: 'error' }]);
      const rx = window.CC.explainRuntime(m.error.kind);
      if (rx) { put('\nWhat happened: ' + rx.why + '\n', 'u'); put('How to fix: ' + rx.fix + '\n', 'u'); }
      return;
    }
    setState(m.exit === 0 ? 'ok' : 'error');
    put(nl + '[program exited with status ' + m.exit + ']\n', m.exit === 0 ? 'g' : 'e');
    if (m.leaks && m.leaks.length) put('⚠ ' + m.leaks.length + ' memory block' + (m.leaks.length > 1 ? 's' : '') + ' never freed' + (m.leaks[0].line ? ' (first allocated on line ' + m.leaks[0].line + ')' : '') + '.\n', 'u');
  }
  // stdin line
  $('#inForm').addEventListener('submit', (e) => {
    e.preventDefault(); const i = $('#inLine'); const t = i.value; i.value = '';
    put(t + '\n', 'u'); worker.postMessage({ type: 'stdin', id: runId, text: t + '\n', eof: false }); $('#inForm').hidden = true;
  });
  $('#btnEof').onclick = () => { worker.postMessage({ type: 'stdin', id: runId, text: '', eof: true }); $('#inForm').hidden = true; put('^D\n', 'm'); };
  $('#inLine').addEventListener('keydown', (e) => { if (e.ctrlKey && e.key === 'd') { e.preventDefault(); $('#btnEof').click(); } });

  // ---------------- tests tab ----------------
  function saveTests() { LS.set('cs.tests', tests); const b = $('#testCount'); b.hidden = !tests.length; b.textContent = String(tests.length); }
  function renderTests() {
    const box = $('#testList'); box.textContent = '';
    tests.forEach((t, i) => {
      const d = document.createElement('div'); d.className = 'tcase';
      const row = document.createElement('div'); row.className = 'row';
      const nm = document.createElement('input'); nm.className = 'nm'; nm.value = t.name; nm.maxLength = 60; nm.setAttribute('aria-label', 'Test name');
      nm.addEventListener('input', () => { t.name = nm.value; saveTests(); });
      const rm = document.createElement('button'); rm.className = 'chip'; rm.textContent = '✕'; rm.setAttribute('aria-label', 'Remove test');
      rm.onclick = () => { tests.splice(i, 1); saveTests(); renderTests(); };
      row.append(nm, rm);
      const mk = (label, key) => { const l = document.createElement('label'); l.textContent = label; const ta = document.createElement('textarea'); ta.rows = 2; ta.value = t[key]; ta.maxLength = 20000; ta.spellcheck = false; ta.addEventListener('input', () => { t[key] = ta.value; saveTests(); }); d.append(l, ta); };
      d.appendChild(row); mk('Input', 'input'); mk('Expected output', 'expected');
      box.appendChild(d);
    });
  }
  $('#addTest').onclick = () => { if (tests.length >= 25) return toast('Up to 25 test cases'); tests.push({ name: 'Test ' + (tests.length + 1), input: '', expected: '' }); saveTests(); renderTests(); };
  const st = $('#stdinText'); st.value = stdinText; st.addEventListener('input', () => { stdinText = st.value; LS.set('cs.stdin', stdinText); });

  const tl = $('#limTime'), ml = $('#limMem');
  tl.value = String(limits.timeSec); ml.value = String(limits.heapMB);
  if (!tl.value) tl.value = '30'; if (!ml.value) ml.value = '64';
  const saveLim = () => { limits = { timeSec: +tl.value, heapMB: +ml.value }; LS.set('cs.limits', limits); };
  tl.addEventListener('change', saveLim); ml.addEventListener('change', saveLim);

  // ---------------- scoring ----------------
  let scoreId = 0;
  $('#btnScore').onclick = () => {
    if (!$('#btnStop').hidden) return;
    $('#btnScore').disabled = true; setState('running'); showTab('score');
    const box = $('#scoreBox'); box.textContent = ''; const p = document.createElement('p'); p.className = 'empty'; p.textContent = 'Compiling, running and grading…'; box.appendChild(p);
    runId++; scoreId = runId;
    ensureWorker().postMessage({ type: 'score', id: runId, src: cm.getValue(), stdin: stdinText, limits, files: otherFiles(), tests: tests.map(t => ({ name: t.name, input: t.input, expected: t.expected })) });
  };
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function creditEl() { const c = el('p', 'credit', 'Graded by C·Slayer · built by '); c.appendChild(el('b', '', 'Himanshu Singh')); return c; }
  function onScore(m) {
    if (m.id !== scoreId) return;
    $('#btnScore').disabled = false;
    renderProblems(m.errors); markLines(m.errors);
    const r = m.result, box = $('#scoreBox'); box.textContent = '';
    setState(m.ok ? 'ok' : 'error');
    const wrap = el('div', 'score');
    const hero = el('div', 'hero');
    const ring = el('div', 'grade');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 132 112'); svg.setAttribute('aria-hidden', 'true');
    const fg = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    fg.setAttribute('d', 'M70 7C104 4 126 28 123 55C120 86 92 105 58 102C26 99 7 78 10 50C13 22 44 6 84 10C99 12 108 17 112 22'); svg.appendChild(fg);
    const num = el('div', 'num', '0'); const small = el('small', '', '/10'); num.appendChild(small);
    ring.append(svg, num);
    const info = el('div'); info.append(el('h3', '', r.grade), el('p', '', r.summary));
    hero.append(ring, info); wrap.appendChild(hero);
    if (r.tips && r.tips.length) {
      const tp = el('div', 'part tips'); tp.appendChild(el('div', 'hd', 'Quick wins — points you can win back'));
      const ul = document.createElement('ul');
      for (const t of r.tips) { const li = document.createElement('li'); const b = document.createElement('b'); b.textContent = '+' + t.gain + ' '; li.appendChild(b); li.appendChild(document.createTextNode((t.line ? 'Line ' + t.line + ': ' : '') + t.text)); ul.appendChild(li); }
      tp.appendChild(ul); wrap.appendChild(tp);
    }
    for (const part of r.parts) {
      const d = el('div', 'part'); const hd = el('div', 'hd'); hd.append(el('span', '', part.name), el('span', '', part.got + ' / ' + part.max));
      d.append(hd);
      if (part.notes.length) {
        const ul = document.createElement('ul');
        for (const n of part.notes) { const li = document.createElement('li'); if (n.line) { const b = document.createElement('b'); b.textContent = 'L' + n.line + ' '; li.appendChild(b); } li.appendChild(document.createTextNode(n.text)); ul.appendChild(li); }
        d.appendChild(ul);
      }
      if (part.id === 'tests' && m.tests && m.tests.length) {
        for (const t of m.tests) { const tr = el('div', 'tres'); const s = el('span', t.pass ? 'p' : 'f', t.pass ? '✔ ' : '✖ '); tr.append(s, document.createTextNode(t.name + (t.pass ? '' : ' — ' + t.reason))); d.appendChild(tr); }
      }
      wrap.appendChild(d);
    }
    wrap.appendChild(creditEl());
    box.appendChild(wrap);
    { const len = fg.getTotalLength ? Math.ceil(fg.getTotalLength()) : 400; fg.style.strokeDasharray = len; fg.style.strokeDashoffset = len; fg.getBoundingClientRect(); fg.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(.45,.05,.25,1) .15s'; requestAnimationFrame(() => { fg.style.strokeDashoffset = '0'; }); }
    const t0 = performance.now();
    (function tick(now) { const k = Math.min(1, (now - t0) / 1200); const v = Math.round(r.score * (1 - Math.pow(1 - k, 3)) * 10) / 10; num.firstChild.nodeValue = (Number.isInteger(v) ? v : v.toFixed(1)); if (k < 1) requestAnimationFrame(tick); else num.firstChild.nodeValue = Number.isInteger(r.score) ? String(r.score) : r.score.toFixed(1); })(t0);
    if (!m.ok) put('', '');
  }

  // ---------------- symbol keys ----------------
  const keys = ['Tab', '{', '}', '(', ')', '[', ']', ';', '"', "'", '*', '&', '<', '>', '=', '+', '-', '/', '!', '|', '%', ',', '.', '\\', '#', '_'];
  const kb = $('#keys');
  keys.forEach(k => { const b = document.createElement('button'); b.type = 'button'; b.textContent = k === 'Tab' ? '⇥' : k; b.setAttribute('aria-label', k);
    b.addEventListener('pointerdown', (e) => e.preventDefault());
    b.addEventListener('click', () => { cm.focus(); if (k === 'Tab') { cm.replaceSelection('    ', 'end'); return; } if (cm.somethingSelected() && OPEN[k] !== undefined && k !== '"' ) { const t = cm.getSelection(); cm.replaceSelection(k + t + OPEN[k], 'around'); return; } cm.replaceSelection(k, 'end'); }); kb.appendChild(b); });

  // keep the symbol bar above the on-screen keyboard
  if (window.visualViewport) {
    const vv = window.visualViewport, root = document.documentElement;
    const fit = () => { root.style.setProperty('--vvh', Math.round(vv.height) + 'px'); if (window.scrollY) window.scrollTo(0, 0); cm.refresh(); };
    vv.addEventListener('resize', fit); vv.addEventListener('scroll', () => { if (window.scrollY) window.scrollTo(0, 0); }); fit();
  }

  // ---------------- boot ----------------
  renderFiles(); renderTests(); saveTests(); renderProblems([]); drawBp();
  put('Write some C, then press Run. Press Grade to have it marked out of 10.\n\n', 'm');
  document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); } });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('service-worker.js').catch(() => { /* offline mode unavailable */ });
})();
