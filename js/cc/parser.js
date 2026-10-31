/* C-Slayer · parser
 * Preprocessed tokens -> AST. Hand-written recursive descent, gcc-style diagnostics,
 * statement-level error recovery, hard nesting limit.
 */
(function (g) {
  'use strict';
  const CC = g.CC = g.CC || {};

  const KEYWORDS = new Set(['auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if', 'inline', 'int', 'long', 'register', 'restrict', 'return', 'short', 'signed', 'sizeof', 'static', 'struct', 'switch', 'typedef', 'union', 'unsigned', 'void', 'volatile', 'while', '_Bool', '_Noreturn', '_Alignof', '_Alignas', '_Generic', '_Static_assert', '_Complex', '_Atomic', '__restrict', '__inline', '__inline__', '__attribute__', '__extension__']);
  const TYPE_KW = new Set(['void', 'char', 'short', 'int', 'long', 'float', 'double', 'signed', 'unsigned', '_Bool']);
  const QUAL_KW = new Set(['const', 'volatile', 'restrict', '__restrict', '_Atomic']);
  const STORAGE_KW = new Set(['typedef', 'extern', 'static', 'auto', 'register']);
  const MAX_DEPTH = 220;

  class Abort extends Error {}

  function parse(tokens) {
    let p = 0;
    const errors = [];
    const typedefScopes = [new Map()];
    let depth = 0;
    let lastTok = tokens[0];

    const cur = () => tokens[p];
    const peek = (k) => tokens[Math.min(p + k, tokens.length - 1)];
    const isP = (v) => { const t = tokens[p]; return t.k === 'punc' && t.v === v; };
    const isId = (v) => { const t = tokens[p]; return t.k === 'id' && t.v === v; };
    const next = () => { const t = tokens[p]; if (t.k !== 'eof') p++; lastTok = t; return t; };
    const accept = (v) => { if (isP(v)) { next(); return true; } return false; };
    const tokDesc = (t) => t.k === 'eof' ? 'end of input' : (t.k === 'str' ? 'string literal' : "'" + t.v + "'");

    function err(tok, msg, sev) {
      if (tok.sys) return;
      const last = errors[errors.length - 1];
      if (sev !== 'warning' && last && last.line === tok.line && last.sev === 'error') return; // one per line
      if (errors.filter(e => e.sev === 'error').length >= 25) throw new Abort('too many errors');
      errors.push({ line: tok.line, col: tok.col, msg, sev: sev || 'error', file: tok.file });
    }
    // gcc reports "expected X before Y" at the end of the previous token
    function errExpected(what) {
      const t = cur();
      const at = lastTok && lastTok !== t && (what === "';'" || what === "')'" || what === "']'" || what === "'}'") ? { line: lastTok.line, col: lastTok.col + (lastTok.v ? lastTok.v.length : 0), file: lastTok.file, sys: lastTok.sys } : t;
      err(at, 'expected ' + what + ' before ' + tokDesc(t));
    }
    function expectP(v) {
      if (isP(v)) return next();
      errExpected("'" + v + "'");
      throw new Syntax();
    }
    class Syntax extends Error {}

    function isTypedef(name) {
      for (let i = typedefScopes.length - 1; i >= 0; i--) {
        if (typedefScopes[i].has(name)) return typedefScopes[i].get(name);
      }
      return false;
    }
    const declareName = (name, isTd) => typedefScopes[typedefScopes.length - 1].set(name, isTd);
    const pushScope = () => typedefScopes.push(new Map());
    const popScope = () => typedefScopes.pop();

    const enter = () => { if (++depth > MAX_DEPTH) { err(cur(), 'code is nested too deeply to compile'); throw new Abort('depth'); } };
    const leave = () => { depth--; };

    // ---------- type specifiers ----------
    function isTypeStart(t) {
      if (t.k !== 'id') return false;
      if (KEYWORDS.has(t.v)) return TYPE_KW.has(t.v) || QUAL_KW.has(t.v) || t.v === 'struct' || t.v === 'union' || t.v === 'enum' || STORAGE_KW.has(t.v) || t.v === 'inline' || t.v === '_Noreturn' || t.v === '__inline' || t.v === '__inline__' || t.v === '__extension__';
      return isTypedef(t.v);
    }

    function skipAttributes() {
      while (isId('__attribute__')) {
        next();
        if (isP('(')) { let d = 0; do { if (isP('(')) d++; else if (isP(')')) d--; next(); } while (d > 0 && cur().k !== 'eof'); }
      }
    }

    function parseSpecifiers(allowStorage) {
      const startTok = cur();
      const spec = { storage: null, quals: { const: false, volatile: false }, base: null, inline: false, line: startTok.line, col: startTok.col, sys: !!startTok.sys };
      let sawType = false;
      const w = { signed: 0, unsigned: 0, short: 0, long: 0, kind: null };
      let any = false;
      for (;;) {
        skipAttributes();
        const t = cur();
        if (t.k !== 'id') break;
        const v = t.v;
        if (STORAGE_KW.has(v)) {
          if (!allowStorage) { err(t, "storage class specified for '" + v + "' here"); }
          if (spec.storage && spec.storage !== v) err(t, 'multiple storage classes in declaration specifiers');
          spec.storage = v; next(); any = true; continue;
        }
        if (v === 'inline' || v === '__inline' || v === '__inline__' || v === '_Noreturn' || v === '__extension__') { spec.inline = true; next(); any = true; continue; }
        if (QUAL_KW.has(v)) { if (v === 'const') spec.quals.const = true; else if (v === 'volatile') spec.quals.volatile = true; next(); any = true; continue; }
        if (TYPE_KW.has(v)) {
          if (spec.base && spec.base.t !== 'arith') { err(t, 'two or more data types in declaration specifiers'); }
          if (v === 'signed') w.signed++;
          else if (v === 'unsigned') w.unsigned++;
          else if (v === 'short') w.short++;
          else if (v === 'long') w.long++;
          else {
            if (w.kind) err(t, 'two or more data types in declaration specifiers');
            w.kind = v;
          }
          sawType = true; any = true; next(); continue;
        }
        if (v === 'struct' || v === 'union') {
          if (sawType) err(t, 'two or more data types in declaration specifiers');
          spec.base = parseStructSpec(); sawType = true; any = true; continue;
        }
        if (v === 'enum') {
          if (sawType) err(t, 'two or more data types in declaration specifiers');
          spec.base = parseEnumSpec(); sawType = true; any = true; continue;
        }
        if (!sawType && !KEYWORDS.has(v) && isTypedef(v)) {
          // a typedef name, unless it's immediately followed by something that shows it's being redeclared as a variable
          spec.base = { t: 'typedef', name: v, line: t.line, col: t.col };
          sawType = true; any = true; next(); continue;
        }
        break;
      }
      if (w.kind || w.signed || w.unsigned || w.short || w.long) {
        const base = { t: 'arith', kind: w.kind, signed: w.signed > 0, unsigned: w.unsigned > 0, short: w.short, long: w.long, line: startTok.line, col: startTok.col };
        // validate
        let bad = null;
        if (w.signed && w.unsigned) bad = "both 'signed' and 'unsigned' in declaration specifiers";
        else if (w.short && w.long) bad = "both 'short' and 'long' in declaration specifiers";
        else if (w.short > 1) bad = "duplicate 'short'";
        else if (w.long > 2) bad = "'long long long' is too long for GCC";
        else if (w.kind === 'void' && (w.signed || w.unsigned || w.short || w.long)) bad = "'void' cannot be combined with other type specifiers";
        else if (w.kind === 'char' && (w.short || w.long)) bad = "'char' cannot be combined with 'short' or 'long'";
        else if (w.kind === 'float' && (w.signed || w.unsigned || w.short || w.long)) bad = "'float' cannot be combined with other type specifiers";
        else if (w.kind === 'double' && (w.signed || w.unsigned || w.short || w.long > 1)) bad = "'double' cannot be combined with these type specifiers";
        else if (w.kind === '_Bool' && (w.signed || w.unsigned || w.short || w.long)) bad = "'_Bool' cannot be combined with other type specifiers";
        if (bad) err(startTok, bad);
        spec.base = base;
      }
      spec.any = any;
      return spec;
    }

    function parseStructSpec() {
      const kw = next(); // struct | union
      skipAttributes();
      let tag = null, tagTok = null;
      if (cur().k === 'id' && !KEYWORDS.has(cur().v)) { tagTok = next(); tag = tagTok.v; }
      const node = { t: kw.v, tag, fields: null, line: kw.line, col: kw.col };
      if (isP('{')) {
        next();
        node.fields = [];
        while (!isP('}') && cur().k !== 'eof') {
          try {
            if (isId('_Static_assert')) { parseStaticAssert(); continue; }
            const spec = parseSpecifiers(false);
            if (!spec.base) { err(cur(), 'expected specifier-qualifier-list before ' + tokDesc(cur())); throw new Syntax(); }
            const decls = [];
            if (isP(';')) { next(); // anonymous struct/union member
              node.fields.push({ spec, decls: [], anon: true, line: spec.line }); continue; }
            for (;;) {
              const d = isP(':') ? { name: null, nameTok: null, ptrs: [], inner: null, suffix: [], line: cur().line, col: cur().col } : parseDeclarator(false);
              let bits = null;
              if (accept(':')) bits = parseAssign();
              decls.push({ decl: d, bits });
              if (!accept(',')) break;
            }
            expectP(';');
            node.fields.push({ spec, decls, line: spec.line });
          } catch (e) {
            if (!(e instanceof Syntax)) throw e;
            // recover inside struct body
            while (cur().k !== 'eof' && !isP(';') && !isP('}')) next();
            accept(';');
          }
        }
        if (!isP('}')) { errExpected("'}'"); } else next();
        node.endLine = lastTok.line;
      }
      skipAttributes();
      return node;
    }

    function parseEnumSpec() {
      const kw = next();
      let tag = null;
      if (cur().k === 'id' && !KEYWORDS.has(cur().v)) tag = next().v;
      const node = { t: 'enum', tag, items: null, line: kw.line, col: kw.col };
      if (isP('{')) {
        next();
        node.items = [];
        while (!isP('}') && cur().k !== 'eof') {
          const nt = cur();
          if (nt.k !== 'id' || KEYWORDS.has(nt.v)) { errExpected('identifier'); throw new Syntax(); }
          next();
          let value = null;
          if (accept('=')) value = parseAssign();
          node.items.push({ name: nt.v, value, line: nt.line, col: nt.col });
          declareName(nt.v, false);
          if (!accept(',')) break;
        }
        expectP('}');
      }
      return node;
    }

    // ---------- declarators ----------
    function parseDeclarator(abstractOk) {
      enter();
      try {
        const d = { name: null, nameTok: null, ptrs: [], inner: null, suffix: [], line: cur().line, col: cur().col };
        skipAttributes();
        while (isP('*')) {
          next();
          const q = { const: false, volatile: false };
          for (;;) {
            const t = cur();
            if (t.k === 'id' && QUAL_KW.has(t.v)) { if (t.v === 'const') q.const = true; if (t.v === 'volatile') q.volatile = true; next(); continue; }
            break;
          }
          d.ptrs.push(q);
          skipAttributes();
        }
        const t = cur();
        if (isP('(')) {
          const n1 = peek(1);
          const innerStarts = (n1.k === 'punc' && (n1.v === '*' || n1.v === '(' || n1.v === '^')) || (n1.k === 'id' && !KEYWORDS.has(n1.v) && !isTypedef(n1.v)) || (n1.k === 'id' && n1.v === '__attribute__');
          if (innerStarts) {
            next();
            d.inner = parseDeclarator(abstractOk);
            expectP(')');
          }
        } else if (t.k === 'id' && !KEYWORDS.has(t.v)) {
          d.name = t.v; d.nameTok = t; next();
        } else if (!abstractOk) {
          if (t.k === 'id' && KEYWORDS.has(t.v)) { err(t, "expected identifier or '(' before '" + t.v + "'"); }
          else errExpected("identifier or '('");
          throw new Syntax();
        }
        // suffixes
        for (;;) {
          if (isP('[')) {
            const lb = next();
            let size = null, star = false;
            // skip qualifiers/static in array params
            while (cur().k === 'id' && (QUAL_KW.has(cur().v) || cur().v === 'static')) next();
            if (isP('*') && peek(1).v === ']') { next(); star = true; }
            else if (!isP(']')) size = parseAssign();
            expectP(']');
            d.suffix.push({ k: 'arr', size, star, line: lb.line, col: lb.col });
          } else if (isP('(')) {
            const lp = next();
            const fn = { k: 'fn', params: [], variadic: false, unspecified: false, line: lp.line, col: lp.col };
            if (isP(')')) { fn.unspecified = true; next(); }
            else if (isId('void') && peek(1).k === 'punc' && peek(1).v === ')') { next(); next(); }
            else {
              pushScope();
              for (;;) {
                if (isP('.') || isP('...')) {
                  if (isP('...')) { next(); fn.variadic = true; break; }
                }
                const pspec = parseSpecifiers(true);
                if (!pspec.base) {
                  if (cur().k === 'id' && !KEYWORDS.has(cur().v)) err(cur(), "unknown type name '" + cur().v + "'");
                  else errExpected('declaration specifiers');
                  popScope(); throw new Syntax();
                }
                const pd = parseDeclarator(true);
                if (pd.name) declareName(pd.name, false);
                fn.params.push({ spec: pspec, decl: pd, line: pspec.line });
                if (!accept(',')) break;
              }
              popScope();
              expectP(')');
            }
            d.suffix.push(fn);
          } else break;
        }
        skipAttributes();
        return d;
      } finally { leave(); }
    }

    function parseTypeName() {
      const spec = parseSpecifiers(false);
      if (!spec.base) { errExpected('type name'); throw new Syntax(); }
      const decl = parseDeclarator(true);
      return { spec, decl, line: spec.line, col: spec.col };
    }

    // ---------- initializers ----------
    function parseInitializer() {
      if (isP('{')) {
        const lb = next();
        const items = [];
        enter();
        while (!isP('}') && cur().k !== 'eof') {
          const designators = [];
          for (;;) {
            if (isP('.') && peek(1).k === 'id') { next(); designators.push({ field: next().v }); continue; }
            if (isP('[')) { next(); const e = parseAssign(); expectP(']'); designators.push({ index: e }); continue; }
            break;
          }
          if (designators.length) expectP('=');
          const e = parseInitializer();
          items.push({ designators, e });
          if (!accept(',')) break;
        }
        leave();
        expectP('}');
        return { k: 'InitList', items, line: lb.line, col: lb.col };
      }
      return parseAssign();
    }

    // ---------- expressions ----------
    function parseExpr() {
      enter();
      try {
        let l = parseAssign();
        while (isP(',')) {
          const op = next();
          const r = parseAssign();
          l = { k: 'Comma', l, r, line: op.line, col: op.col };
        }
        return l;
      } finally { leave(); }
    }

    const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=']);
    function parseAssign() {
      enter();
      try {
        const l = parseCond();
        const t = cur();
        if (t.k === 'punc' && ASSIGN_OPS.has(t.v)) {
          next();
          const r = parseAssign();
          return { k: 'Assign', op: t.v, l, r, line: t.line, col: t.col };
        }
        return l;
      } finally { leave(); }
    }

    function parseCond() {
      const c = parseBin(1);
      if (isP('?')) {
        const q = next();
        const a = parseExpr();
        expectP(':');
        const b = parseCond();
        return { k: 'Cond', c, a, b, line: q.line, col: q.col };
      }
      return c;
    }

    const BIN_PREC = { '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5, '==': 6, '!=': 6, '<': 7, '>': 7, '<=': 7, '>=': 7, '<<': 8, '>>': 8, '+': 9, '-': 9, '*': 10, '/': 10, '%': 10 };
    function parseBin(minP) {
      let l = parseCast();
      for (;;) {
        const t = cur();
        if (t.k !== 'punc') return l;
        const pr = BIN_PREC[t.v];
        if (pr === undefined || pr < minP) return l;
        next();
        const r = parseBin(pr + 1);
        l = (t.v === '&&' || t.v === '||')
          ? { k: 'Logic', op: t.v, l, r, line: t.line, col: t.col }
          : { k: 'Bin', op: t.v, l, r, line: t.line, col: t.col };
      }
    }

    function parseCast() {
      if (isP('(') && isTypeStart(peek(1))) {
        const lp = cur();
        const save = p;
        next();
        let tn;
        try { tn = parseTypeName(); expectP(')'); }
        catch (e) { if (e instanceof Syntax) throw e; throw e; }
        if (isP('{')) {
          const init = parseInitializer();
          return parsePostfixOps({ k: 'CompoundLit', tn, init, line: lp.line, col: lp.col });
        }
        const e = parseCast();
        return { k: 'Cast', tn, e, line: lp.line, col: lp.col };
      }
      return parseUnary();
    }

    function parseUnary() {
      enter();
      try {
        const t = cur();
        if (t.k === 'punc') {
          switch (t.v) {
            case '++': case '--': { next(); const e = parseUnary(); return { k: 'Un', op: t.v, e, line: t.line, col: t.col }; }
            case '&': case '*': case '+': case '-': case '~': case '!': {
              next(); const e = parseCast();
              return { k: 'Un', op: t.v, e, line: t.line, col: t.col };
            }
          }
        } else if (t.k === 'id' && t.v === 'sizeof') {
          next();
          if (isP('(') && isTypeStart(peek(1))) {
            next();
            const tn = parseTypeName();
            expectP(')');
            return { k: 'SizeofT', tn, line: t.line, col: t.col };
          }
          const e = parseUnary();
          return { k: 'SizeofE', e, line: t.line, col: t.col };
        } else if (t.k === 'id' && (t.v === '_Alignof')) {
          next(); expectP('(');
          const tn = parseTypeName(); expectP(')');
          return { k: 'AlignofT', tn, line: t.line, col: t.col };
        }
        return parsePostfix();
      } finally { leave(); }
    }

    function parsePostfix() { return parsePostfixOps(parsePrimary()); }
    function parsePostfixOps(e) {
      for (;;) {
        const t = cur();
        if (t.k !== 'punc') return e;
        if (t.v === '[') {
          next(); const i = parseExpr(); expectP(']');
          e = { k: 'Index', a: e, i, line: t.line, col: t.col };
        } else if (t.v === '(') {
          next();
          const args = [];
          if (!isP(')')) {
            for (;;) { args.push(parseAssign()); if (!accept(',')) break; }
          }
          if (!isP(')')) { errExpected("')'"); throw new Syntax(); }
          next();
          e = { k: 'Call', f: e, args, line: t.line, col: t.col, endLine: lastTok.line };
        } else if (t.v === '.' || t.v === '->') {
          next();
          const nt = cur();
          if (nt.k !== 'id') { errExpected('identifier'); throw new Syntax(); }
          next();
          e = { k: 'Mem', e, name: nt.v, arrow: t.v === '->', line: t.line, col: t.col };
        } else if (t.v === '++' || t.v === '--') {
          next();
          e = { k: 'Post', op: t.v, e, line: t.line, col: t.col };
        } else return e;
      }
    }

    function parsePrimary() {
      const t = cur();
      switch (t.k) {
        case 'num': {
          next();
          const r = CC.parseNumber(t.v);
          if (r.error) { err(t, r.error); return { k: 'Num', kind: 'int', value: 0n, u: false, l: 0, base: 10, line: t.line, col: t.col }; }
          return Object.assign({ k: 'Num', line: t.line, col: t.col, text: t.v }, r);
        }
        case 'chr': next(); return { k: 'Chr', value: t.val, line: t.line, col: t.col };
        case 'str': {
          const bytes = t.bytes.slice();
          next();
          while (cur().k === 'str') { const s = next(); for (const b of s.bytes) bytes.push(b); }
          return { k: 'Str', bytes, line: t.line, col: t.col };
        }
        case 'id': {
          if (KEYWORDS.has(t.v)) {
            if (isTypeStart(t)) { err(t, "expected expression before '" + t.v + "'"); throw new Syntax(); }
            err(t, "expected expression before '" + t.v + "'"); throw new Syntax();
          }
          next();
          return { k: 'Id', name: t.v, line: t.line, col: t.col };
        }
        case 'punc':
          if (t.v === '(') {
            next();
            if (isP('{')) { err(t, 'statement expressions are not supported'); throw new Syntax(); }
            const e = parseExpr();
            expectP(')');
            return { k: 'Paren', e, line: t.line, col: t.col };
          }
      }
      if (t.k === 'eof') err(t, 'expected expression before end of input');
      else err(t, 'expected expression before ' + tokDesc(t));
      throw new Syntax();
    }

    // ---------- statements ----------
    function parseStaticAssert() {
      next(); expectP('(');
      const c = parseAssign(); let msg = null;
      if (accept(',')) { msg = cur(); next(); }
      expectP(')'); expectP(';');
      return { k: 'StaticAssert', c, msg: msg && msg.bytes ? String.fromCharCode.apply(null, msg.bytes) : '', line: lastTok.line };
    }

    function looksLikeUnknownType() {
      // `Foo bar;` / `Foo *bar;` where Foo is not a known type
      const t = cur();
      if (t.k !== 'id' || KEYWORDS.has(t.v) || isTypedef(t.v)) return false;
      const a = peek(1), b = peek(2);
      if (a.k === 'id' && !KEYWORDS.has(a.v) && b.k === 'punc' && (b.v === ';' || b.v === '=' || b.v === ',' || b.v === '[')) return true;
      if (a.k === 'punc' && a.v === '*' && b.k === 'id' && !KEYWORDS.has(b.v)) {
        const c = peek(3);
        if (c.k === 'punc' && (c.v === ';' || c.v === '=' || c.v === ',' || c.v === '[')) return true;
      }
      return false;
    }

    function parseBlock() {
      const lb = expectP('{');
      pushScope();
      const items = [];
      enter();
      try {
        while (!isP('}') && cur().k !== 'eof') {
          const before = p;
          try {
            items.push(parseBlockItem());
          } catch (e) {
            if (!(e instanceof Syntax)) throw e;
            recoverStmt();
            if (p === before && cur().k !== 'eof' && !isP('}')) next();
          }
        }
        if (!isP('}')) { errExpected("'}'"); err(lb, "to match this '{'", 'note'); }
        else next();
      } finally { leave(); popScope(); }
      return { k: 'Block', items, line: lb.line, col: lb.col, endLine: lastTok.line };
    }

    function recoverStmt() {
      let d = 0;
      while (cur().k !== 'eof') {
        if (isP(';') && d === 0) { next(); return; }
        if (isP('{')) d++;
        if (isP('}')) { if (d === 0) return; d--; if (d === 0) { next(); return; } }
        next();
      }
    }

    function parseBlockItem() {
      const t = cur();
      if (t.k === 'id' && t.v === '_Static_assert') return parseStaticAssert();
      if (isTypeStart(t) && !(t.k === 'id' && !KEYWORDS.has(t.v) && peek(1).k === 'punc' && peek(1).v === ':')) {
        // a typedef name used as an expression start? (e.g. shadowed). Treat as declaration.
        return parseDeclaration(false);
      }
      if (looksLikeUnknownType()) {
        err(t, "unknown type name '" + t.v + "'");
        throw new Syntax();
      }
      return parseStatement();
    }

    function parseStatement() {
      enter();
      try {
        const t = cur();
        if (t.k === 'punc') {
          if (t.v === '{') return parseBlock();
          if (t.v === ';') { next(); return { k: 'Empty', line: t.line, col: t.col }; }
        }
        if (t.k === 'id') {
          switch (t.v) {
            case 'if': {
              next(); expectP('('); const c = parseExpr(); expectP(')');
              const a = parseStatement();
              let b = null;
              if (isId('else')) { next(); b = parseStatement(); }
              return { k: 'If', c, a, b, line: t.line, col: t.col, endLine: lastTok.line };
            }
            case 'while': {
              next(); expectP('('); const c = parseExpr(); expectP(')');
              const body = parseStatement();
              return { k: 'While', c, body, line: t.line, col: t.col, endLine: lastTok.line };
            }
            case 'do': {
              next(); const body = parseStatement();
              if (!isId('while')) { errExpected("'while'"); throw new Syntax(); }
              next(); expectP('('); const c = parseExpr(); expectP(')'); expectP(';');
              return { k: 'DoWhile', c, body, line: t.line, col: t.col, endLine: lastTok.line };
            }
            case 'for': {
              next(); expectP('(');
              pushScope();
              try {
                let init = null;
                if (isP(';')) next();
                else if (isTypeStart(cur())) init = parseDeclaration(false);
                else { init = { k: 'ExprStmt', e: parseExpr(), line: cur().line }; expectP(';'); }
                let c = null, step = null;
                if (!isP(';')) c = parseExpr();
                expectP(';');
                if (!isP(')')) step = parseExpr();
                expectP(')');
                const body = parseStatement();
                return { k: 'For', init, c, step, body, line: t.line, col: t.col, endLine: lastTok.line };
              } finally { popScope(); }
            }
            case 'switch': {
              next(); expectP('('); const e = parseExpr(); expectP(')');
              const body = parseStatement();
              return { k: 'Switch', e, body, line: t.line, col: t.col, endLine: lastTok.line };
            }
            case 'case': {
              next(); const v = parseCond();
              let hi = null;
              if (isP('...')) { next(); hi = parseCond(); }
              expectP(':');
              return { k: 'Case', v, hi, line: t.line, col: t.col };
            }
            case 'default': { next(); expectP(':'); return { k: 'Default', line: t.line, col: t.col }; }
            case 'break': { next(); expectP(';'); return { k: 'Break', line: t.line, col: t.col }; }
            case 'continue': { next(); expectP(';'); return { k: 'Continue', line: t.line, col: t.col }; }
            case 'return': {
              next();
              let e = null;
              if (!isP(';')) e = parseExpr();
              expectP(';');
              return { k: 'Return', e, line: t.line, col: t.col };
            }
            case 'goto': {
              next(); const l = cur();
              if (l.k !== 'id') { errExpected('identifier'); throw new Syntax(); }
              next(); expectP(';');
              return { k: 'Goto', label: l.v, line: t.line, col: t.col };
            }
            case 'else': { err(t, "'else' without a previous 'if'"); next(); throw new Syntax(); }
          }
          if (!KEYWORDS.has(t.v) && peek(1).k === 'punc' && peek(1).v === ':' && !(peek(2).k === 'punc' && peek(2).v === ':')) {
            next(); next();
            const s = isP('}') ? { k: 'Empty', line: t.line } : parseStatement();
            return { k: 'Label', name: t.v, s, line: t.line, col: t.col };
          }
        }
        const e = parseExpr();
        expectP(';');
        return { k: 'ExprStmt', e, line: t.line, col: t.col };
      } finally { leave(); }
    }

    // ---------- declarations ----------
    function parseDeclaration(topLevel) {
      const startTok = cur();
      const spec = parseSpecifiers(true);
      if (!spec.base) {
        const implicitFn = cur().k === 'id' && !KEYWORDS.has(cur().v) && peek(1).k === 'punc' && peek(1).v === '(';
        if (spec.storage || spec.inline || spec.quals.const || spec.quals.volatile || implicitFn) {
          spec.base = { t: 'arith', kind: null, implicitInt: true, signed: false, unsigned: false, short: 0, long: 0, line: startTok.line, col: startTok.col };
          if (implicitFn) err(cur(), "return type defaults to 'int'", 'warning');
        } else { errExpected('declaration specifiers'); throw new Syntax(); }
      }
      if (isP(';')) { next(); return { k: 'Decl', spec, items: [], line: startTok.line, col: startTok.col, endLine: lastTok.line, sys: !!startTok.sys }; }
      const items = [];
      for (;;) {
        const decl = parseDeclarator(false);
        const isFn = decl.suffix.length && decl.suffix[0].k === 'fn' && !decl.inner;
        if (topLevel && isFn && isP('{')) {
          // function definition
          if (spec.storage === 'typedef') { err(cur(), 'function definition declared \'typedef\''); }
          declareName(decl.name, false);
          pushScope();
          const fn = decl.suffix[0];
          for (const prm of fn.params) if (prm.decl.name) declareName(prm.decl.name, false);
          const body = parseBlock();
          popScope();
          return { k: 'FuncDef', spec, decl, body, line: startTok.line, col: startTok.col, endLine: body.endLine, nameTok: decl.nameTok, sys: !!startTok.sys };
        }
        if (isFn && !topLevel && isP('{')) { err(cur(), 'nested functions are not supported'); throw new Syntax(); }
        { let dn = decl; while (dn && !dn.name && dn.inner) dn = dn.inner; if (dn && dn.name) declareName(dn.name, spec.storage === 'typedef'); }
        let init = null;
        if (accept('=')) init = parseInitializer();
        items.push({ decl, init, line: decl.line });
        if (accept(',')) continue;
        break;
      }
      if (!isP(';')) {
        errExpected("';'");
        throw new Syntax();
      }
      next();
      return { k: 'Decl', spec, items, line: startTok.line, col: startTok.col, endLine: lastTok.line, sys: !!startTok.sys };
    }

    function parseTranslationUnit() {
      const items = [];
      while (cur().k !== 'eof') {
        const before = p;
        try {
          const t = cur();
          if (isP(';')) { next(); continue; }
          if (t.k === 'id' && t.v === '_Static_assert') { items.push(parseStaticAssert()); continue; }
          if (!isTypeStart(t) && !(t.k === 'id' && !KEYWORDS.has(t.v))) {
            if (t.k === 'punc' && t.v === '}') err(t, "expected declaration or statement at end of input");
            else err(t, 'expected declaration specifiers before ' + tokDesc(t));
            throw new Syntax();
          }
          if (looksLikeUnknownType()) { err(t, "unknown type name '" + t.v + "'"); throw new Syntax(); }
          if (t.k === 'id' && !KEYWORDS.has(t.v) && !isTypedef(t.v)) {
            // implicit-int style `foo(...) {` -> let the specifier parser handle as implicit int
            if (peek(1).k === 'punc' && peek(1).v === '(') {
              items.push(parseDeclaration(true)); continue;
            }
            err(t, "unknown type name '" + t.v + "'"); throw new Syntax();
          }
          items.push(parseDeclaration(true));
        } catch (e) {
          if (!(e instanceof Syntax)) throw e;
          // recover at top level: skip to ';' at depth 0 or the end of a {...} block
          let d = 0;
          while (cur().k !== 'eof') {
            if (isP('{')) d++;
            else if (isP('}')) { d--; if (d <= 0) { next(); break; } }
            else if (isP(';') && d <= 0) { next(); break; }
            next();
          }
          if (p === before) next();
        }
      }
      return { k: 'TU', items };
    }

    let ast = { k: 'TU', items: [] };
    try {
      ast = parseTranslationUnit();
    } catch (e) {
      if (!(e instanceof Abort)) throw e;
    }
    return { ast, errors };
  }

  CC.parse = parse;
  CC.KEYWORDS = KEYWORDS;
})(typeof globalThis !== 'undefined' ? globalThis : self);
