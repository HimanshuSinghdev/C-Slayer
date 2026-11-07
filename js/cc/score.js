/* C-Slayer · 1–10 grader.
 * Pure function of (compile result, run result, optional test results). No I/O, no eval.
 *   CC.score({ compile, run, tests }) -> { score, grade, parts:[{id,name,got,max,notes:[{line?,text,delta}]}], summary }
 * Weights (sum 10):  runtime 3 · tests 2.5 · warnings 1.5 · safety 1 · style 1 · structure 1
 */
(function (g) {
  'use strict';
  const CC = g.CC = g.CC || {};

  function stripSource(src) {            // blank out comments and string/char contents, keep newlines and length
    let out = '', i = 0; const n = src.length;
    while (i < n) {
      const c = src[i], d = src[i + 1];
      if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') { out += ' '; i++; } }
      else if (c === '/' && d === '*') { out += '  '; i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; } out += '  '; i += 2; }
      else if (c === '"' || c === "'") {
        out += c; i++;
        while (i < n && src[i] !== c && src[i] !== '\n') { if (src[i] === '\\') { out += ' '; i++; } out += ' '; i++; }
        if (i < n && src[i] === c) { out += c; i++; }
      } else { out += c; i++; }
    }
    return out;
  }

  function walk(node, fn, depth) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const x of node) walk(x, fn, depth); return; }
    if (typeof node.k === 'string') { if (fn(node, depth) === false) return; }
    for (const key of Object.keys(node)) {
      if (key === 'spec' || key === 'nameTok' || key === 'bytes') continue;
      const v = node[key];
      if (v && typeof v === 'object') walk(v, fn, depth);
    }
  }

  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const round1 = (x) => Math.round(x * 10) / 10;

  function part(id, name, max) { return { id, name, max, got: max, notes: [] }; }
  function dock(p, delta, text, line) { p.got = clamp(p.got - delta, 0, p.max); p.notes.push({ text, line: line || 0, delta: -delta }); }
  function good(p, text) { p.notes.push({ text, line: 0, delta: 0 }); }

  // ---------- style / safety analysis on the user's own (non-system) source ----------
  function analyseSource(src, stripped) {
    const lines = src.split('\n'), sl = stripped.split('\n');
    return { lines, sl };
  }

  function userFuncs(ast) {
    return ((ast && ast.items) || []).filter(it => it.k === 'FuncDef' && !it.sys);
  }
  function funcName(f) { return (f.nameTok && f.nameTok.v) || '?'; }

  function maxNesting(body) {
    let best = 0;
    const rec = (node, d) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { for (const x of node) rec(x, d); return; }
      let nd = d;
      if (typeof node.k === 'string' && /^(If|For|While|DoWhile|Switch)$/.test(node.k)) { nd = d + 1; if (nd > best) best = nd; }
      for (const key of Object.keys(node)) {
        if (key === 'spec' || key === 'nameTok' || key === 'bytes') continue;
        const v = node[key];
        if (!v || typeof v !== 'object') continue;
        // `else if` chains do not add depth
        if (node.k === 'If' && key === 'b' && v.k === 'If') rec(v, d); else rec(v, nd);
      }
    };
    rec(body, 0);
    return best;
  }

  // Hidden edge-case probes: programs that read input are re-run on boundary values.
  // Only things detectable without a reference answer are judged: garbage (uninitialised) output, crashes, and
  // running out of time on a moderately large input (exponential / quadratic algorithms).
  const GARBAGE = /-858993460|3435973836|-3689348814741910324|14757395258967641292|-52\b/;
  CC.scoreProbes = {
    inputs: [{ id: 'zero', in: '0\n' }, { id: 'one', in: '1\n' }, { id: 'neg', in: '-1\n' }, { id: 'big', in: '45\n', big: true }],
    wantsProbes: function (src) { return /\b(scanf|fscanf|getchar|fgets|gets|getc|scanf_s)\s*\(/.test(src || ''); },
    GARBAGE: GARBAGE
  };

  CC.score = function (input) {
    const cr = input.compile, rr = input.run || null, tests = input.tests || null, probes = input.probes || null;
    let ceiling = 10; const capNotes = [];
    const cap = (v, text) => { ceiling = Math.min(ceiling, v); capNotes.push({ text, line: 0, delta: 0 }); };
    const src = cr.source || '';
    const parts = [];

    // ---------------- gate: does it compile? ----------------
    const errs = (cr.errors || []).filter(e => e.sev === 'error');
    if (!cr.ok) {
      const p = part('compile', 'Compiles', 10); p.got = 0;
      const n = errs.length;
      const score = n >= 4 ? 1 : n >= 2 ? 1.5 : 2;
      for (const e of errs.slice(0, 8)) p.notes.push({ line: e.line, text: e.msg, delta: 0 });
      return {
        score, grade: gradeWord(score), parts: [p],
        summary: 'The program does not compile (' + n + ' error' + (n === 1 ? '' : 's') + '). Fix the errors first; every other part of the score depends on a program that builds.'
      };
    }

    const stripped = stripSource(src), A = analyseSource(src, stripped);
    const warns = (cr.errors || []).filter(e => e.sev === 'warning');

    // ---------------- runtime health (3) ----------------
    const rt = part('runtime', 'Runs without crashing', 3);
    if (!rr) { good(rt, 'Program was not run.'); }
    else if (rr.runError) {
      const k = rr.runError.kind || '';
      const m = rr.runError.message || k;
      const line = rr.runError.line || 0;
      if (k === 'timeout' || k === 'step-limit' || /time/.test(k)) dock(rt, 2.2, 'Ran out of time — probably an infinite loop or a very slow algorithm.', line);
      else if (k === 'output-limit') dock(rt, 2.4, 'Printed an enormous amount of output (runaway loop?).', line);
      else if (k === 'stack-overflow') dock(rt, 2.4, 'Stack overflow — recursion without a working base case, or huge local arrays.', line);
      else if (k === 'abort' || k === 'assert') dock(rt, 1.5, 'Program aborted: ' + m, line);
      else dock(rt, 2.6, 'Memory/arithmetic error at runtime: ' + m, line);
    } else if (rr.exit !== 0 && rr.exit !== null && rr.exit !== undefined) {
      if (rr.noInput && rr.hadStderr) good(rt, 'Exited with status ' + rr.exit + ' after reporting an error on empty input — that is correct behaviour.');
      else dock(rt, 0.5, 'main() exited with status ' + rr.exit + ' (0 means success).');
    } else good(rt, 'Ran to completion with exit status 0.');
    if (rr && !rr.runError && rr.leaks && rr.leaks.length) {
      const bytes = rr.leaks.reduce((a, l) => a + (l.size || 0), 0);
      dock(rt, Math.min(1.2, 0.8 + 0.2 * rr.leaks.length), 'Memory leak: ' + rr.leaks.length + ' block' + (rr.leaks.length === 1 ? '' : 's') + ' (' + bytes + ' bytes) never freed.', rr.leaks[0].line || 0);
    }
    if (rr && !rr.runError && rr.leaks && rr.leaks.length) cap(7, 'Leaked memory keeps a program out of the top bands even when its answers are right.');
    parts.push(rt);

    // ---------------- correctness against tests (2.5) ----------------
    const tp = part('tests', tests && tests.length ? 'Correct output' : 'Correct output (no test cases given)', 2.5);
    if (tests && tests.length) {
      const passed = tests.filter(t => t.pass).length;
      tp.got = round1(2.5 * passed / tests.length);
      tp.notes.push({ text: passed + ' of ' + tests.length + ' test cases passed.', line: 0, delta: 0 });
      for (const t of tests.filter(t => !t.pass).slice(0, 4)) tp.notes.push({ text: 'Failed: ' + (t.name || 'test') + (t.reason ? ' — ' + t.reason : ''), line: 0, delta: 0 });
    } else {
      // without a reference we can only reward a clean run
      tp.got = rr && !rr.runError && (rr.exit === 0 || rr.exit == null) ? 2.0 : rr && rr.noInput && rr.hadStderr && !rr.runError ? 1.5 : rr ? 0.5 : 1.5;
      if (warns.some(w => /format '%.*expects/.test(w.msg) || /used uninitialized/.test(w.msg))) { tp.got = Math.max(0, tp.got - 1.0); tp.notes.push({ text: 'A warning (wrong printf/scanf type or uninitialized variable) means the output is probably wrong.', line: 0, delta: -1.0 }); }
      const pr = probes && rr && !rr.runError ? probes : null;
      if (pr) {
        const bad = [];
        for (const q of pr) {
          if (q.runError && /time|step/.test(q.runError.kind || 'timeout')) { if (q.big) cap(4, 'Too slow: input ' + q.in.trim() + ' did not finish in time — the algorithm grows too fast (exponential or quadratic). Use a loop or memoisation.'); else cap(4, 'Hung on input ' + q.in.trim() + '.'); bad.push(q.id); }
          else if (q.runError) { cap(5, 'Crashed on input ' + q.in.trim() + ': ' + (q.runError.message || q.runError.kind)); bad.push(q.id); }
          else if (!q.big && GARBAGE.test(q.out || '')) { cap(5, 'Printed garbage for input ' + q.in.trim() + ' — a variable is read before it is set (uninitialised).'); bad.push(q.id); }
        }
        const neg = pr.find(q => q.id === 'neg');
        if (neg && !neg.runError && neg.exit === 0 && (neg.out || '').trim() && !bad.length) tp.notes.push({ text: 'Negative input is accepted silently; consider validating it.', line: 0, delta: 0 });
        if (!bad.length) { tp.got = Math.max(tp.got, 2.5); tp.notes.push({ text: 'Edge-case probes (0, 1, negative, large) all ran cleanly.', line: 0, delta: 0 }); }
        else tp.got = Math.min(tp.got, 0.5);
        for (const n of capNotes) tp.notes.push(n);
      }
      good(tp, 'No test cases were provided, so correctness is estimated from a clean run only. Add test cases for a precise grade.');
    }
    parts.push(tp);

    // ---------------- compiler warnings (1.5) ----------------
    const wp = part('warnings', 'Compiler warnings', 1.5);
    const heavy = /uninitialized|format|return-local|implicit|incompatible|int-conversion|pointer|array-bounds|return-type|sequence|Wsign|parentheses/;
    for (const w of warns.slice(0, 12)) dock(wp, heavy.test(w.msg) ? 0.75 : 0.25, w.msg, w.line);
    if (warns.length > 12) dock(wp, 0.5, (warns.length - 12) + ' more warnings');
    if (!warns.length) good(wp, 'No warnings — clean build.');
    parts.push(wp);

    // ---------------- safe practices (1) ----------------
    const sp = part('safety', 'Safe coding practices', 1);
    const sl = A.sl;
    const flagged = new Set();
    const once = (key, delta, text, line) => { if (flagged.has(key)) return; flagged.add(key); dock(sp, delta, text, line); };
    sl.forEach((ln, idx) => {
      const L = idx + 1;
      if (/\b(strcpy|strcat|sprintf|vsprintf)\s*\(/.test(ln)) once('unbounded', 0.3, 'strcpy/strcat/sprintf do not check the destination size; prefer strncpy/snprintf with a length.', L);
      if (/\b(scanf|fscanf|sscanf)\s*\(/.test(ln) && /%s/.test(A.lines[idx])) once('scan%s', 0.3, "scanf(\"%s\") without a width can overflow the buffer; use e.g. \"%31s\".", L);
      if (/\bgets\s*\(/.test(ln)) once('gets', 0.5, 'gets() is unsafe and was removed from C.', L);
      if (/\batoi\s*\(/.test(ln)) once('atoi', 0.1, 'atoi() cannot report errors; strtol() can.', L);
      if (/^\s*(scanf|fscanf|sscanf)\s*\(/.test(ln)) once('scanfret', 0.25, 'The return value of scanf is ignored — check that it read what you expected.', L);
    });
    // malloc results never compared to NULL
    const mallocVars = [];
    sl.forEach((ln, idx) => { const m = /\b([A-Za-z_]\w*)\s*=\s*(?:\([^)]*\)\s*)?(malloc|calloc|realloc)\s*\(/.exec(ln); if (m) mallocVars.push({ name: m[1], line: idx + 1 }); });
    for (const mv of mallocVars) {
      const nm = mv.name.replace(/[$]/g, '\\$&');
      const re = new RegExp('(!\\s*' + nm + '\\b)|(\\b' + nm + '\\s*(==|!=)\\s*(NULL|0)\\b)|((NULL|0)\\s*(==|!=)\\s*' + nm + '\\b)|(if\\s*\\(\\s*' + nm + '\\s*\\))|(\\(\\s*' + nm + '\\s*=\\s*(?:\\([^)]*\\)\\s*)?(malloc|calloc|realloc)[^)]*\\)\\s*(==|!=))');
      if (!re.test(stripped)) { once('mallocchk', 0.3, "malloc/calloc result '" + mv.name + "' is never checked for NULL.", mv.line); break; }
    }
    if (!sp.notes.length) good(sp, 'No risky library calls found.');
    parts.push(sp);

    // ---------------- style / readability (1) ----------------
    const st = part('style', 'Style & readability', 1);
    const lines = A.lines;
    const codeLines = sl.filter(l => l.trim()).length;
    // comments
    const nComments = (cr.comments || []).length;
    if (codeLines >= 25 && nComments === 0) dock(st, 0.3, 'No comments at all — explain the purpose of the program and tricky parts.');
    else if (codeLines >= 40 && nComments < Math.floor(codeLines / 40)) dock(st, 0.15, 'Very few comments for the amount of code.');
    // indentation: tab/space mix and inconsistent step
    let tabs = 0, spaces = 0; const steps = new Map();
    for (const l of lines) { if (/^\t/.test(l)) tabs++; else if (/^ +\S/.test(l)) spaces++; }
    if (tabs && spaces) dock(st, 0.2, 'Tabs and spaces are mixed for indentation.');
    // indentation vs. brace depth (spaces only): infer the indent unit, then count lines that disagree
    if (!tabs) {
      const leads = [];
      let depth = 0; const rows = [];
      sl.forEach((ln, idx) => {
        const t = ln.trim();
        if (!t) return;
        const prev = rows.length ? rows[rows.length - 1].t : '';
        const cont = /[,(+\-*/&|=?:]$/.test(prev) || /^[)\]]/.test(t) && false;
        const d = depth - (t[0] === '}' ? 1 : 0);
        const skip = /^#/.test(t) || /^(case\b|default\s*:)/.test(t) || /^\w+\s*:\s*$/.test(t) || cont || depth < 0;
        if (!skip) rows.push({ line: idx + 1, d, lead: ln.length - ln.trimStart().length, t });
        else rows.push({ line: idx + 1, d: -1, lead: 0, t });
        for (const ch of t) { if (ch === '{') depth++; else if (ch === '}') depth--; }
      });
      const cnt = new Map();
      for (const r of rows) if (r.d === 1 && r.lead > 0) cnt.set(r.lead, (cnt.get(r.lead) || 0) + 1);
      let unit = 4, best = 0; for (const [k, v] of cnt) if (v > best) { best = v; unit = k; }
      let bad = 0, total = 0, firstBad = 0;
      for (const r of rows) { if (r.d < 0) continue; total++; if (r.lead !== r.d * unit) { bad++; if (!firstBad) firstBad = r.line; } }
      if (total >= 6 && bad / total > 0.12) dock(st, 0.3, 'Indentation does not follow the block structure in ' + bad + ' lines.', firstBad);
    }
    // long lines
    const longs = lines.map((l, i) => [l.length, i + 1]).filter(x => x[0] > 100);
    if (longs.length) dock(st, 0.1, 'Lines longer than 100 characters (' + longs.length + ').', longs[0][1]);
    // naming
    const names = new Set();
    for (const t of cr.tokens || []) if (t.k === 'id' && !t.sys) names.add(t.v);
    const okShort = new Set(['i', 'j', 'k', 'n', 'm', 'x', 'y', 'z', 'c', 'p', 'q', 's', 't', 'a', 'b', 'e', 'f', 'r', 'u', 'v', 'w', 'd', 'l', 'h']);
    const userDecls = [];
    walk(cr.ast, (nd) => { if (nd.k === 'Decl' && !nd.sys && nd.items) for (const it of nd.items) { const nm = it && ((it.decl && it.decl.name) || it.name); if (nm) userDecls.push(nm); } });
    const vague = userDecls.filter(nm => /^(temp|tmp|foo|bar|baz|var\d*|val\d+|a\d+|x\d+|aa+|asdf\w*|test\d*)$/i.test(nm));
    if (vague.length >= 2) dock(st, 0.15, 'Non-descriptive names: ' + [...new Set(vague)].slice(0, 5).join(', ') + '.');
    const camelOrSnake = userDecls.filter(nm => /^[a-z]+[A-Z]/.test(nm)).length, snake = userDecls.filter(nm => /_/.test(nm)).length;
    if (camelOrSnake >= 2 && snake >= 2) dock(st, 0.1, 'Mixed naming styles (camelCase and snake_case).');
    // magic numbers (rough): numeric literals >= 3 digits outside #define / declarations of const
    let magic = 0, magicLine = 0;
    sl.forEach((ln, idx) => { if (/^\s*#/.test(ln) || /\bconst\b/.test(ln)) return; const m = ln.match(/(?<![\w.])\d{3,}(?![\w.])/g); if (m) { magic += m.length; if (!magicLine) magicLine = idx + 1; } });
    if (magic >= 4) dock(st, 0.1, 'Several unexplained numeric constants — name them with #define or const.', magicLine);
    if (!st.notes.length) good(st, 'Consistent, readable layout.');
    parts.push(st);

    // ---------------- structure & complexity (1) ----------------
    const sc = part('structure', 'Structure & complexity', 1);
    const fns = userFuncs(cr.ast);
    for (const f of fns) {
      const len = (f.endLine || f.line) - f.line + 1;
      const nm = funcName(f);
      if (len > 60) dock(sc, 0.3, "Function '" + nm + "' is " + len + ' lines long; split it into smaller functions.', f.line);
      else if (len > 40) dock(sc, 0.15, "Function '" + nm + "' is " + len + ' lines long.', f.line);
      const depth = maxNesting(f.body);
      if (depth > 4) dock(sc, 0.3, "Function '" + nm + "' nests " + depth + ' levels deep; flatten with early returns or helper functions.', f.line);
      else if (depth === 4) dock(sc, 0.1, "Function '" + nm + "' nests 4 levels deep.", f.line);
    }
    if (fns.length === 1 && codeLines > 45) dock(sc, 0.3, 'Everything is in main(); break the work into functions.');
    let gotos = 0, gline = 0;
    walk(cr.ast, (nd) => { if (nd.k === 'Goto' && !nd.sys) { gotos++; if (!gline) gline = nd.line; } });
    if (gotos) dock(sc, 0.2, 'goto makes control flow hard to follow.', gline);
    // mutable globals: declarations at brace depth 0 that are not functions / typedefs / const
    const mg = [];
    { let depth = 0, paren = 0;
      sl.forEach((ln, idx) => {
        const t = ln.trim();
        if (depth === 0 && paren === 0 && t && !/^#/.test(t) && !/\b(const|typedef|extern|struct\s+\w+\s*\{|enum|union)\b/.test(t) && !/\)\s*\{?\s*$/.test(t) && /^(static\s+)?(unsigned\s+|signed\s+|long\s+|short\s+)*(int|char|float|double|long|short|size_t|bool|FILE|\w+_t)\b[^()]*[;=]/.test(t)) mg.push(idx + 1);
        for (const ch of t) { if (ch === '{') depth++; else if (ch === '}') depth--; else if (ch === '(') paren++; else if (ch === ')') paren--; }
      }); }
    if (mg.length > 2) dock(sc, 0.15, 'Several mutable global variables (' + mg.length + '); pass data through parameters instead.', mg[0]);
    if (!sc.notes.length) good(sc, 'Well-sized functions with shallow nesting.');
    parts.push(sc);

    // ---------------- total ----------------
    let total = parts.reduce((a, p) => a + p.got, 0);
    for (const p of parts) p.got = round1(p.got);
    // a program that crashes cannot score as "excellent"
    if (rr && rr.runError) total = Math.min(total, 6);
    total = Math.min(total, ceiling);
    let score = Math.round(total * 2) / 2;
    score = clamp(score, 1, 10);
    // "quick wins": the biggest deductions, with the points you would get back by fixing each
    const tips = [];
    for (const p of parts) for (const n of p.notes) if (n.delta < 0) tips.push({ gain: round1(Math.min(-n.delta, p.max)), text: n.text, line: n.line || 0, part: p.name });
    tips.sort((a, b) => b.gain - a.gain);
    return { score, grade: gradeWord(score), parts, tips: tips.slice(0, 4), summary: summarise(score, parts, rr) };
  };

  function gradeWord(s) {
    return s >= 9.5 ? 'Outstanding' : s >= 8.5 ? 'Excellent' : s >= 6.5 ? 'Good' : s >= 5 ? 'Fair' : s >= 3 ? 'Needs work' : 'Not yet';
  }

  function summarise(score, parts, rr) {
    const lost = parts.map(p => ({ p, d: p.max - p.got })).filter(x => x.d > 0.05).sort((a, b) => b.d - a.d);
    if (!lost.length) return 'Clean build, clean run, tidy code. Nothing to improve.';
    const top = lost.slice(0, 2).map(x => x.p.name.toLowerCase()).join(' and ');
    return 'Biggest gains available in: ' + top + '.' + (rr && rr.runError ? ' A crashing program is capped at 6.' : '');
  }
})(typeof globalThis !== 'undefined' ? globalThis : self);
