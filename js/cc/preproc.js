/* C-Slayer · preprocessor
 * #define / #undef / #include (built-in headers only) / #if family / #error / #pragma.
 * Hard limits on expansion count, include depth and token count so nothing can run away.
 */
(function (g) {
  'use strict';
  const CC = g.CC = g.CC || {};

  const MAX_EXPANSIONS = 200000;
  const MAX_TOKENS = 400000;
  const MAX_INCLUDE_DEPTH = 16;

  function preprocess(tokens, opts) {
    opts = opts || {};
    const headers = opts.headers || {};
    const file = opts.file || 'main.c';
    const errors = [];
    const included = new Set();
    const macros = new Map();
    const out = [];
    let expansions = 0;
    let counter = 0;
    let aborted = false;

    const err = (tok, msg, sev) => errors.push({ line: tok ? tok.line : 0, col: tok ? tok.col : 0, msg, sev: sev || 'error', file: tok ? tok.file : file });
    const spell = t => t.v;
    const mkTok = (proto, k, v, extra) => Object.assign({ k, v, line: proto.line, col: proto.col, bol: false, sp: proto.sp, file: proto.file }, extra || {});

    // ---------- predefined ----------
    const now = new Date();
    const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][now.getMonth()];
    const pad = x => String(x).padStart(2, '0');
    const pre = {
      __STDC__: '1', __STDC_VERSION__: '201112L', __STDC_HOSTED__: '1', __GNUC__: '', __linux__: '1',
      __x86_64__: '1', __CHAR_BIT__: '8', __SIZEOF_INT__: '4', __SIZEOF_LONG__: '8', __SIZEOF_POINTER__: '8',
    };
    for (const k in pre) {
      if (pre[k] === '') continue;
      const r = CC.lex(pre[k], '<predefined>').tokens; r.pop();
      macros.set(k, { name: k, params: null, body: r });
    }
    const strTok = (proto, s) => {
      const b = []; for (const ch of s) CC.utf8Push(b, ch.codePointAt(0));
      return mkTok(proto, 'str', JSON.stringify(s), { bytes: b });
    };
    const builtins = {
      __LINE__: t => mkTok(t, 'num', String(t.line)),
      __FILE__: t => strTok(t, file),
      __DATE__: t => strTok(t, mon + ' ' + String(now.getDate()).padStart(2, ' ') + ' ' + now.getFullYear()),
      __TIME__: t => strTok(t, pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds())),
      __COUNTER__: t => mkTok(t, 'num', String(counter++)),
    };
    for (const k in builtins) macros.set(k, { name: k, builtin: builtins[k] });

    // ---------- helpers ----------
    function stringify(argToks, proto) {
      let s = '';
      argToks.forEach((t, idx) => {
        if (idx > 0 && t.sp) s += ' ';
        if (t.k === 'str' || t.k === 'chr') s += t.v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        else s += t.v;
      });
      const bytes = []; for (const ch of s) CC.utf8Push(bytes, ch.codePointAt(0));
      return mkTok(proto, 'str', '"' + s + '"', { bytes });
    }
    function pasteTokens(a, b, proto) {
      const text = a.v + b.v;
      const r = CC.lex(text, a.file);
      if (r.errors.length || r.tokens.length !== 2) {
        err(proto, "pasting \"" + a.v + "\" and \"" + b.v + "\" does not give a valid preprocessing token");
        return a;
      }
      const t = r.tokens[0];
      t.line = proto.line; t.col = proto.col; t.sp = a.sp; t.bol = false; t.file = proto.file;
      return t;
    }
    function addHide(tok, add) {
      if (!tok.hide) return Object.assign({}, tok, { hide: add });
      const h = new Set(tok.hide); for (const x of add) h.add(x);
      return Object.assign({}, tok, { hide: h });
    }

    // Try to expand a macro at w[i]. Returns true if w was changed (caller rescans from i).
    function tryExpand(w, i) {
      const t = w[i];
      if (t.k !== 'id') return false;
      const m = macros.get(t.v);
      if (!m) return false;
      if (t.hide && t.hide.has(t.v)) return false;
      if (++expansions > MAX_EXPANSIONS || w.length > MAX_TOKENS) {
        if (!aborted) err(t, 'macro expansion is too large (possible infinite macro recursion)');
        aborted = true;
        w.splice(i, 1);
        return true;
      }
      if (m.builtin) { w.splice(i, 1, m.builtin(t)); w[i].hide = new Set([t.v]); return true; }
      const add = new Set(t.hide || []); add.add(t.v);
      if (!m.params) {
        const rep = m.body.map((b, idx) => {
          const c = addHide(b, add);
          c.line = t.line; c.col = t.col; c.bol = false; c.file = t.file;
          if (idx === 0) c.sp = t.sp;
          return c;
        });
        const hasPaste = rep.some(x => x.k === 'punc' && x.v === '##');
        w.splice(i, 1, ...(hasPaste ? doPaste(rep, t) : rep));
        return true;
      }
      // function-like: needs '('
      const nx = w[i + 1];
      if (!nx || nx.k !== 'punc' || nx.v !== '(') return false;
      let j = i + 2, depth = 1;
      const args = [[]];
      for (; j < w.length; j++) {
        const x = w[j];
        if (x.k === 'eof') break;
        if (x.k === 'punc') {
          if (x.v === '(') depth++;
          else if (x.v === ')') { depth--; if (depth === 0) break; }
          else if (x.v === ',' && depth === 1 && !(m.variadic && args.length >= m.params.length)) { args.push([]); continue; }
        }
        args[args.length - 1].push(x);
      }
      if (j >= w.length || w[j].k === 'eof') {
        err(t, "unterminated argument list invoking macro \"" + t.v + "\"");
        w.splice(i, 1); return true;
      }
      const np = m.params.length;
      if (np === 0 && args.length === 1 && args[0].length === 0) args.length = 0;
      if (m.variadic) {
        while (args.length < np) args.push([]);
        if (args.length < np) { /* ok */ }
      }
      if ((!m.variadic && args.length !== np) || (m.variadic && args.length < np - 1 + 0)) {
        err(t, "macro \"" + t.v + "\" requires " + np + " argument" + (np === 1 ? '' : 's') + ", but " + args.length + " given");
        w.splice(i, j - i + 1); return true;
      }
      const pidx = new Map(m.params.map((p, k) => [p, k]));
      const expandedCache = [];
      const getExpanded = k => {
        if (!expandedCache[k]) {
          const copy = (args[k] || []).slice();
          expandList(copy);
          expandedCache[k] = copy;
        }
        return expandedCache[k];
      };
      const body = m.body;
      let rep = [];
      for (let b = 0; b < body.length; b++) {
        const bt = body[b];
        if (bt.k === 'punc' && bt.v === '#' && b + 1 < body.length && body[b + 1].k === 'id' && pidx.has(body[b + 1].v)) {
          rep.push(stringify(args[pidx.get(body[b + 1].v)] || [], t));
          b++; continue;
        }
        if (bt.k === 'id' && pidx.has(bt.v)) {
          const k = pidx.get(bt.v);
          const prevPaste = b > 0 && body[b - 1].k === 'punc' && body[b - 1].v === '##';
          const nextPaste = b + 1 < body.length && body[b + 1].k === 'punc' && body[b + 1].v === '##';
          const src = (prevPaste || nextPaste) ? (args[k] || []) : getExpanded(k);
          if (src.length === 0 && (prevPaste || nextPaste)) { rep.push({ k: 'placemarker', v: '', line: t.line, col: t.col }); continue; }
          src.forEach((x, idx) => { const c = Object.assign({}, x); if (idx === 0) c.sp = bt.sp; rep.push(c); });
          continue;
        }
        rep.push(Object.assign({}, bt));
      }
      rep = doPaste(rep, t);
      rep = rep.map((x, idx) => {
        const c = addHide(x, add);
        c.line = t.line; c.col = t.col; c.bol = false; c.file = t.file;
        if (idx === 0) c.sp = t.sp;
        return c;
      });
      w.splice(i, j - i + 1, ...rep);
      return true;
    }

    function doPaste(rep, proto) {
      if (!rep.some(x => x.k === 'punc' && x.v === '##')) return rep.filter(x => x.k !== 'placemarker');
      const res = [];
      for (let k = 0; k < rep.length; k++) {
        const x = rep[k];
        if (x.k === 'punc' && x.v === '##' && res.length && k + 1 < rep.length) {
          const left = res.pop(), right = rep[++k];
          if (left.k === 'placemarker') res.push(right);
          else if (right.k === 'placemarker') res.push(left);
          else res.push(pasteTokens(left, right, proto));
        } else res.push(x);
      }
      return res.filter(x => x.k !== 'placemarker');
    }

    function expandList(w) {
      let i = 0;
      while (i < w.length) {
        if (aborted) { w.length = i; return; }
        if (!tryExpand(w, i)) i++;
      }
    }

    // ---------- #if expression ----------
    function evalCondition(line, dirTok) {
      // handle defined
      const pre = [];
      for (let i = 0; i < line.length; i++) {
        const t = line[i];
        if (t.k === 'id' && t.v === 'defined') {
          let name, k = i + 1;
          if (line[k] && line[k].v === '(') { name = line[k + 1]; k += 2; if (line[k] && line[k].v === ')') k++; else { err(t, "missing ')' after \"defined\""); } }
          else { name = line[k]; k++; }
          if (!name || name.k !== 'id') { err(t, 'operator "defined" requires an identifier'); pre.push(mkTok(t, 'num', '0')); i = k - 1; continue; }
          pre.push(mkTok(t, 'num', macros.has(name.v) ? '1' : '0'));
          i = k - 1; continue;
        }
        pre.push(t);
      }
      expandList(pre);
      let p = 0;
      const peek = () => pre[p];
      const bad = (m) => { err(dirTok, m); throw new Error('ppx'); };
      function prim() {
        const t = pre[p++];
        if (!t) bad('#if with no expression');
        if (t.k === 'num') {
          const r = CC.parseNumber(t.v);
          if (r.error) bad(r.error);
          if (r.kind === 'float') bad('floating constant in preprocessor expression');
          return r.value;
        }
        if (t.k === 'chr') return BigInt(t.val);
        if (t.k === 'id') return 0n;
        if (t.k === 'punc') {
          if (t.v === '(') { const v = cond(); const c = pre[p++]; if (!c || c.v !== ')') bad("missing ')' in expression"); return v; }
          if (t.v === '!') return prim() === 0n ? 1n : 0n;
          if (t.v === '-') return -prim();
          if (t.v === '+') return prim();
          if (t.v === '~') return ~prim();
        }
        bad('token "' + t.v + '" is not valid in preprocessor expressions');
      }
      const PREC = { '*': 10, '/': 10, '%': 10, '+': 9, '-': 9, '<<': 8, '>>': 8, '<': 7, '>': 7, '<=': 7, '>=': 7, '==': 6, '!=': 6, '&': 5, '^': 4, '|': 3, '&&': 2, '||': 1 };
      function bin(minP) {
        let l = prim();
        for (;;) {
          const t = peek();
          if (!t || t.k !== 'punc' || !(t.v in PREC) || PREC[t.v] < minP) return l;
          p++;
          const r = bin(PREC[t.v] + 1);
          switch (t.v) {
            case '*': l = l * r; break;
            case '/': if (r === 0n) bad('division by zero in #if'); l = l / r; break;
            case '%': if (r === 0n) bad('division by zero in #if'); l = l % r; break;
            case '+': l = l + r; break;
            case '-': l = l - r; break;
            case '<<': l = l << r; break;
            case '>>': l = l >> r; break;
            case '<': l = l < r ? 1n : 0n; break;
            case '>': l = l > r ? 1n : 0n; break;
            case '<=': l = l <= r ? 1n : 0n; break;
            case '>=': l = l >= r ? 1n : 0n; break;
            case '==': l = l === r ? 1n : 0n; break;
            case '!=': l = l !== r ? 1n : 0n; break;
            case '&': l = l & r; break;
            case '^': l = l ^ r; break;
            case '|': l = l | r; break;
            case '&&': l = (l !== 0n && r !== 0n) ? 1n : 0n; break;
            case '||': l = (l !== 0n || r !== 0n) ? 1n : 0n; break;
          }
        }
      }
      function cond() {
        const c = bin(1);
        const t = peek();
        if (t && t.k === 'punc' && t.v === '?') {
          p++; const a = cond();
          const colon = pre[p++]; if (!colon || colon.v !== ':') bad("expected ':' in conditional expression");
          const b = cond();
          return c !== 0n ? a : b;
        }
        return c;
      }
      try {
        if (pre.length === 0) { err(dirTok, '#if with no expression'); return false; }
        const v = cond();
        if (p < pre.length) { err(dirTok, 'extra tokens at end of #if directive'); }
        return v !== 0n;
      } catch (e) { if (e.message === 'ppx') return false; throw e; }
    }

    // ---------- directives ----------
    function processTokens(toks, fname, depth, isSys) {
      const condStack = [];
      const emitting = () => condStack.every(c => c.active);
      let i = 0;
      const n = toks.length;
      while (i < n && toks[i].k !== 'eof') {
        if (aborted) return;
        const t = toks[i];
        if (t.k === 'punc' && t.v === '#' && t.bol) {
          let j = i + 1;
          while (j < n && toks[j].k !== 'eof' && !toks[j].bol) j++;
          directive(toks.slice(i + 1, j), t);
          i = j; continue;
        }
        if (!emitting()) { i++; continue; }
        // gather a run of non-directive tokens; expand in a work buffer
        let j = i;
        while (j < n && toks[j].k !== 'eof' && !(toks[j].bol && toks[j].k === 'punc' && toks[j].v === '#')) j++;
        const w = toks.slice(i, j);
        // a function-like macro name at the very end of a run can't pull '(' from past a directive; fine.
        let k = 0;
        while (k < w.length) {
          if (aborted) break;
          if (!tryExpand(w, k)) k++;
        }
        for (const x of w) { if (isSys) x.sys = true; out.push(x); }
        i = j;
      }
      if (condStack.length) {
        const c = condStack[condStack.length - 1];
        err(c.tok, 'unterminated #' + c.kind);
      }

      function directive(line, hash) {
        const nameTok = line[0];
        if (!nameTok) return; // null directive
        const name = nameTok.v;
        const rest = line.slice(1);
        const act = emitting();
        switch (name) {
          case 'if': {
            const parentActive = act;
            let v = false;
            if (parentActive) v = evalCondition(rest, hash);
            condStack.push({ active: parentActive && v, taken: v, parent: parentActive, kind: 'if', tok: hash, sawElse: false });
            return;
          }
          case 'ifdef': case 'ifndef': {
            const parentActive = act;
            if (!rest[0] || rest[0].k !== 'id') { err(hash, 'no macro name given in #' + name + ' directive'); }
            const d = rest[0] ? macros.has(rest[0].v) : false;
            const v = name === 'ifdef' ? d : !d;
            condStack.push({ active: parentActive && v, taken: v, parent: parentActive, kind: name, tok: hash, sawElse: false });
            return;
          }
          case 'elif': {
            const c = condStack[condStack.length - 1];
            if (!c) { err(hash, '#elif without #if'); return; }
            if (c.sawElse) { err(hash, '#elif after #else'); return; }
            if (c.taken || !c.parent) c.active = false;
            else { const v = evalCondition(rest, hash); c.active = v; c.taken = v; }
            return;
          }
          case 'else': {
            const c = condStack[condStack.length - 1];
            if (!c) { err(hash, '#else without #if'); return; }
            if (c.sawElse) { err(hash, '#else after #else'); return; }
            c.sawElse = true;
            c.active = c.parent && !c.taken; c.taken = true;
            return;
          }
          case 'endif': {
            if (!condStack.length) { err(hash, '#endif without #if'); return; }
            condStack.pop(); return;
          }
        }
        if (!act) return;
        switch (name) {
          case 'define': return defineMacro(rest, hash);
          case 'undef': if (rest[0] && rest[0].k === 'id') macros.delete(rest[0].v); return;
          case 'include': return includeFile(rest, hash, depth);
          case 'error': err(hash, '#error ' + rest.map(spell).join(' ')); return;
          case 'warning': err(hash, '#warning ' + rest.map(spell).join(' '), 'warning'); return;
          case 'pragma': case 'line': case 'ident': return;
          default: err(nameTok, 'invalid preprocessing directive #' + name);
        }
      }
    }

    function defineMacro(rest, hash) {
      const nt = rest[0];
      if (!nt || nt.k !== 'id') { err(hash, 'macro names must be identifiers'); return; }
      if (nt.v === 'defined') { err(nt, '"defined" cannot be used as a macro name'); return; }
      let k = 1, params = null, variadic = false;
      const nx = rest[1];
      if (nx && nx.k === 'punc' && nx.v === '(' && !nx.sp) {
        params = []; k = 2;
        for (;;) {
          const p = rest[k];
          if (!p) { err(nt, 'missing ")" in macro parameter list'); return; }
          if (p.k === 'punc' && p.v === ')') { k++; break; }
          if (p.k === 'punc' && p.v === '...') { variadic = true; params.push('__VA_ARGS__'); k++; if (rest[k] && rest[k].v === ')') { k++; break; } err(nt, 'missing ")" in macro parameter list'); return; }
          if (p.k !== 'id') { err(p, 'expected parameter name'); return; }
          params.push(p.v); k++;
          if (rest[k] && rest[k].v === '...') { variadic = true; k++; if (rest[k] && rest[k].v === ')') { k++; break; } err(nt, 'missing ")"'); return; }
          if (rest[k] && rest[k].v === ',') { k++; continue; }
          if (rest[k] && rest[k].v === ')') { k++; break; }
          err(nt, 'expected comma in macro parameter list'); return;
        }
      }
      const body = rest.slice(k).map((t, idx) => { const c = Object.assign({}, t); c.bol = false; if (idx === 0) c.sp = false; return c; });
      macros.set(nt.v, { name: nt.v, params, variadic, body });
    }

    function includeFile(rest, hash, depth) {
      let name = null, sys = false;
      if (rest[0] && rest[0].k === 'str') name = String.fromCharCode.apply(null, rest[0].bytes);
      else if (rest[0] && rest[0].v === '<') {
        sys = true; name = '';
        let k = 1;
        while (rest[k] && rest[k].v !== '>') { name += rest[k].v; k++; }
        if (!rest[k]) { err(hash, 'missing terminating > character'); return; }
      } else {
        const w = rest.slice(); expandList(w);
        if (w[0] && w[0].k === 'str') name = String.fromCharCode.apply(null, w[0].bytes);
        else { err(hash, '#include expects "FILENAME" or <FILENAME>'); return; }
      }
      if (depth >= MAX_INCLUDE_DEPTH) { err(hash, '#include nested too deeply'); return; }
      if (Object.prototype.hasOwnProperty.call(headers, name)) {
        if (included.has(name)) return;
        included.add(name);
        const r = CC.lex(headers[name], name);
        if (r.errors.length) { for (const e of r.errors) errors.push(Object.assign({ file: name }, e)); }
        processTokens(r.tokens, name, depth + 1, true);
        return;
      }
      if (/\.(cpp|hpp)$|^(bits\/stdc\+\+\.h|iostream|vector|string|algorithm|map|set)$/.test(name)) {
        err(hash, name + ': this is a C++ header. C-Slayer compiles C, not C++ (use <stdio.h> instead of <iostream>)');
      } else {
        err(hash, name + ': No such file or directory (only the standard C headers are available)');
      }
    }

    processTokens(tokens, file, 0, false);
    const last = tokens[tokens.length - 1];
    out.push(last && last.k === 'eof' ? last : { k: 'eof', v: '', line: 0, col: 0 });
    return { tokens: out, errors, included, macros };
  }

  CC.preprocess = preprocess;
})(typeof globalThis !== 'undefined' ? globalThis : self);
