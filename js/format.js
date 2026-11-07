/* C-Slayer · code formatter: re-indents by block structure and fixes a few safe spacing habits.
   It only changes whitespace (never tokens), so the program means exactly the same thing. */
(function (g) {
  'use strict';
  const CC = g.CC = g.CC || {};
  CC.formatC = function (src, opt) {
    const unit = ' '.repeat((opt && opt.indent) || 4);
    const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    const stack = [];          // open braces: { sw: switch body?, inCase: inside a case label's statements? }
    let paren = 0;             // open ( and [ across lines
    let inBlock = false;       // inside /* ... */
    let macroCont = false;     // previous preprocessor line ended with backslash
    let strCont = false;       // string literal continued with a backslash
    let pend = null;           // absolute level of a braceless if/for/while/else body waiting for its statement
    let ifs = [];              // levels of braceless if headers, so a later else lines up with its if
    let blank = 0, swPending = false;
    for (let li = 0; li < lines.length; li++) {
      const raw = lines[li];
      const t = raw.trim();
      // lines whose text must not be touched
      if (macroCont) { out.push(raw.replace(/\s+$/, '')); macroCont = /\\\s*$/.test(raw); blank = 0; continue; }
      if (strCont) { out.push(raw); strCont = false; blank = 0; if (/\\$/.test(raw)) strCont = true; continue; }
      if (!inBlock && t === '') { if (blank < 1 && out.length) out.push(''); blank++; continue; }
      blank = 0;
      if (!inBlock && t[0] === '#') { out.push(t); macroCont = /\\\s*$/.test(t); continue; }
      // mask strings, chars and comments (same length) so structure can be read safely
      let m = '', mode = inBlock ? 'b' : 'c', i = 0;
      const startedInBlock = inBlock;
      const s = raw;
      while (i < s.length) {
        const ch = s[i], nx = s[i + 1];
        if (mode === 'c') {
          if (ch === '/' && nx === '/') { m += ' '.repeat(s.length - i); i = s.length; break; }
          if (ch === '/' && nx === '*') { mode = 'b'; m += '  '; i += 2; continue; }
          if (ch === '"') { mode = 's'; m += '"'; i++; continue; }
          if (ch === "'") { mode = 'q'; m += "'"; i++; continue; }
          m += ch; i++;
        } else if (mode === 'b') {
          if (ch === '*' && nx === '/') { mode = 'c'; m += '  '; i += 2; continue; }
          m += ' '; i++;
        } else {
          const q = mode === 's' ? '"' : "'";
          if (ch === '\\') { m += '  '.slice(0, Math.min(2, s.length - i)); i += 2; continue; }
          if (ch === q) { mode = 'c'; m += q; i++; continue; }
          m += '_'; i++;
        }
      }
      m = m.slice(0, s.length);
      inBlock = mode === 'b';
      if (mode === 's' || mode === 'q') strCont = /\\$/.test(s);
      const mt = m.trim();
      // a line that is only the middle/end of a block comment: keep its text, re-align only a leading '*'
      if (startedInBlock && mt === '' ) {
        const lvl = level(0);
        out.push(t[0] === '*' ? unit.repeat(lvl) + ' ' + t : raw.replace(/\s+$/, ''));
        continue;
      }
      // spacing fixes (insert-only, on code characters)
      let o = raw, ins = [];
      if (!startedInBlock || /\S/.test(m)) {
        const mc = m;
        for (const x of mc.matchAll(/\b(if|for|while|switch)\(/g)) ins.push(x.index + x[1].length);
        for (const x of mc.matchAll(/\)\{/g)) ins.push(x.index + 1);
        for (const x of mc.matchAll(/\belse\{/g)) ins.push(x.index + 4);
        for (const x of mc.matchAll(/\}else\b/g)) ins.push(x.index + 1);
        for (const x of mc.matchAll(/,(?=[^\s])/g)) ins.push(x.index + 1);
        for (const x of mc.matchAll(/;(?=[^\s;)])/g)) { if (paren > 0 || /\bfor\s*\(/.test(mc)) ins.push(x.index + 1); }
        { const re = /<<=|>>=|<<|>>|->|\+\+|--|==|!=|<=|>=|&&|\|\||[+\-*\/%&|^]=|=|[\s\S]/g; let x;
          const spaced = { '==': 1, '!=': 1, '<=': 1, '>=': 1, '&&': 1, '||': 1, '=': 1, '+=': 1, '-=': 1, '*=': 1, '/=': 1, '%=': 1, '&=': 1, '|=': 1, '^=': 1, '<<=': 1, '>>=': 1 };
          while ((x = re.exec(mc))) { const tk = x[0]; if (!spaced[tk]) continue; const a = x.index, b = a + tk.length;
            if (a > 0 && !/\s/.test(mc[a - 1])) ins.push(a);
            if (b < mc.length && !/[\s;,)\]]/.test(mc[b])) ins.push(b); } }
        ins = [...new Set(ins)].sort((a, b) => b - a);
        for (const p of ins) { o = o.slice(0, p) + ' ' + o.slice(p); m = m.slice(0, p) + ' ' + m.slice(p); }
      }
      const body = o.replace(/\s+$/, '').replace(/^\s+/, ''), lead = o.length - o.replace(/^\s+/, '').length;
      const mb = m.slice(lead).replace(/\s+$/, '');
      // leading closing braces pop first
      let k = 0;
      while (k < mb.length && (mb[k] === '}' || mb[k] === ' ')) { if (mb[k] === '}') stack.pop(); k++; }
      const closing = mb[0] === '}';
      const isCase = /^(case\b[^;{]*:|default\s*:)/.test(mb) && !startedInBlock;
      let lvl;
      if (isCase && stack.length && stack[stack.length - 1].sw) { stack[stack.length - 1].inCase = true; lvl = level(-1); }
      else {
        lvl = level(0);
        if (paren > 0 && mb[0] !== ')' && mb[0] !== '}') lvl += 1;
        else if (paren === 0 && !closing && /^else\b/.test(mb) && ifs.length) lvl = ifs.pop();
        else if (paren === 0 && !closing && pend !== null) lvl = mb[0] === '{' ? pend - 1 : pend;
      }
      out.push(unit.repeat(Math.max(0, lvl)) + body);
      if (!/^(\}\s*)?else\b/.test(mb) && !/^(if|for|while)\b/.test(mb) && pend === null && paren === 0) ifs.length = 0;
      // update state from the rest of the line
      const isCtl = /^(if|for|while|switch)\b/.test(mb.replace(/^\}\s*/, '')) || /^(\}\s*)?else\b/.test(mb);
      for (let j = k; j < mb.length; j++) {
        const c = mb[j];
        if (c === '(' || c === '[') paren++;
        else if (c === ')' || c === ']') paren = Math.max(0, paren - 1);
        else if (c === '{') { stack.push({ sw: /\bswitch\b/.test(mb) || swPending, inCase: false }); swPending = false; }
        else if (c === '}') stack.pop();
      }
      if (/\bswitch\b[^{]*$/.test(mb) && paren === 0 && !/\{/.test(mb)) swPending = true;
      else if (mb.indexOf('{') >= 0 || /;\s*$/.test(mb)) swPending = false;
      // braceless bodies: header line with nothing after the closing paren (or a bare else/do)
      const endsHeader = paren === 0 && (/^(\}\s*)?(if|for|while)\b.*\)\s*$/.test(mb) || /(^|[\s}])else\s*$/.test(mb) || /^do\s*$/.test(mb) || /\belse\s+if\b.*\)\s*$/.test(mb));
      if (endsHeader && !/\{\s*$/.test(mb)) { if (/\bif\b/.test(mb) || /^do\b/.test(mb) === false && /\bif\b/.test(mb)) ifs.push(lvl); pend = lvl + 1; }
      else if (paren === 0 && mb.trim() !== '' && (/[;}]\s*$/.test(mb) || /\{\s*$/.test(mb))) { pend = null; if (!/^else\b/.test(mb) && !/^if\b/.test(mb) && !/^\}?\s*else\b/.test(mb)) { /* keep ifs until a non-else statement starts */ } }
      else if (mb.trim() === '' ) { /* comment only: keep */ }
      void isCtl;
    }
    while (out.length && out[out.length - 1] === '') out.pop();
    return out.join('\n') + '\n';
    function level(extra) {
      let n = stack.length + extra;
      for (const e of stack) if (e.sw && e.inCase) n++;
      return n;
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
