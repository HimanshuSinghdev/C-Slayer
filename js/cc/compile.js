/* C-Slayer · compiler driver.
 * source text -> diagnostics + a runnable program (bytecode, data, builtin table). Pure functions, no eval, no I/O.
 */
(function (g) {
  'use strict';
  const CC = g.CC = g.CC || {};
  const T = CC.T, OP = CC.OP, MEM = CC.MEM;

  class Abort extends Error {}
  const MAX_ERRORS = 60;

  function makeContext() {
    const C = {
      errors: [], seen: new Set(), quiet: false, sys: false, line: 1, curNode: null,
      scopes: [new Map()], tagScopes: [new Map()], structId: 0,
      code: [], lines: [], consts: [], constMap: new Map(), fixups: [], funcs: [],
      strings: new Map(), rodata: [], gdata: [], redzones: [],
      loops: [], switches: [], switchTables: [], fn: null, implicit: new Set(), mainSym: null
    };
    // ----- diagnostics -----
    C.report = function (node, msg, sev) {
      if (C.quiet || C.sys) return;
      const line = (node && node.line) || C.line || 0;
      const key = line + '|' + sev + '|' + msg;
      if (C.seen.has(key)) return;
      C.seen.add(key);
      C.errors.push({ line, col: (node && node.col) || 0, msg, sev });
      if (sev === 'error' && C.errors.filter(e => e.sev === 'error').length >= MAX_ERRORS) throw new Abort('too many errors');
    };
    C.error = (node, msg, sev) => C.report(node, msg, sev === 'warning' ? 'warning' : sev === 'note' ? 'note' : 'error');
    C.warn = (node, msg) => C.report(node, msg, 'warning');
    // ----- emission -----
    C.emit = function (op, a, b) {
      const pos = C.code.length;
      const n = CC.OPARGS[op];
      C.code.push(op); C.lines.push(Math.max(C.line, 1));
      if (n >= 1) { C.code.push(a | 0); C.lines.push(0); }
      if (n >= 2) { C.code.push(b | 0); C.lines.push(0); }
      return pos;
    };
    C.konst = function (v) {
      const key = typeof v + ':' + String(v) + (typeof v === 'number' && Object.is(v, -0) ? '-0' : '');
      let i = C.constMap.get(key);
      if (i === undefined) { i = C.consts.length; C.consts.push(v); C.constMap.set(key, i); }
      return i;
    };
    C.newLabel = () => ({ pos: -1, refs: [] });
    C.jump = function (op, label) {
      const pos = C.emit(op, 0);
      if (label.pos >= 0) C.code[pos + 1] = label.pos; else label.refs.push(pos + 1);
    };
    C.place = function (label) {
      label.pos = C.code.length;
      for (const r of label.refs) C.code[r] = label.pos;
      label.refs = [];
    };
    CC.installDecl(C); CC.installExpr(C); CC.installStmt(C); CC.installFmt(C);
    return C;
  }

  function frontEnd(src, file, extraTokens) {
    const L = CC.lex(src, file);
    let toks = L.tokens;
    if (extraTokens && extraTokens.length) toks = extraTokens.concat(toks);
    const P = CC.preprocess(toks, { headers: CC.libc.headers, file });
    const R = CC.parse(P.tokens);
    return { lex: L, pp: P, ast: R.ast, errors: [].concat(L.errors, P.errors, R.errors), tokens: L.tokens };
  }

  function identSet(tokens) { const s = new Set(); for (const t of tokens) if (t.k === 'id') s.add(t.v); return s; }

  function compileOnce(src, opts, implicitHeaders) {
    const C = makeContext();
    let extra = null;
    if (implicitHeaders && implicitHeaders.length) {
      const L = CC.lex(implicitHeaders.map(h => '#include <' + h + '>').join('\n') + '\n', '<implicit>');
      extra = L.tokens.slice(0, -1);
      for (const t of extra) t.sys = true;
    }
    const fe = frontEnd(src, opts.file || 'main.c', extra);
    // front-end diagnostics
    for (const e of fe.errors) {
      if (e.sev === 'note') { C.errors.push(e); continue; }
      C.errors.push({ line: e.line, col: e.col, msg: e.msg, sev: e.sev || 'error' });
    }
    const hadSyntaxErrors = C.errors.some(e => e.sev === 'error');
    const result = { C, fe, ok: false };
    if (hadSyntaxErrors) return result;

    // library functions written in C (qsort, bsearch, ...): compiled only when the program mentions them
    const ids = identSet(fe.tokens);
    const preludeASTs = [];
    for (const chunk of CC.preludeChunks) {
      if (chunk.names.some(n => ids.has(n))) {
        const pf = frontEnd(chunk.src, '<libc>', null);
        for (const t of pf.tokens) t.sys = true;
        if (pf.errors.length) { C.errors.push({ line: 0, col: 0, msg: 'internal error in libc prelude: ' + pf.errors[0].msg, sev: 'error' }); continue; }
        preludeASTs.push(pf.ast);
      }
    }
    const compileTU = (ast, isSys) => {
      for (const item of ast.items) {
        C.sys = isSys || !!item.sys;
        C.line = item.line || C.line;
        try {
          if (item.k === 'Decl') C.genGlobalDecl(item);
          else if (item.k === 'FuncDef') C.genFunction(item);
          else if (item.k === 'StaticAssert') C.genStmt(item);
        } catch (e) {
          if (e instanceof Abort) throw e;
          C.sys = false; C.fn = null;
          C.errors.push({ line: item.line || 0, col: 0, msg: (e instanceof RangeError ? 'expression is too long or too deeply nested to compile' : 'internal compiler error: ' + (e && e.message ? e.message : e)), sev: 'error' });
          if (opts.debug) console.error(e);
        }
      }
    };
    try {
      for (const a of preludeASTs) compileTU(a, true);
      compileTU(fe.ast, false);
      C.sys = false;
      link(C, opts);
    } catch (e) {
      if (!(e instanceof Abort)) throw e;
    }
    result.ok = !C.errors.some(e => e.sev === 'error');
    if (result.ok) result.program = assemble(C);
    return result;
  }

  function link(C, opts) {
    const libc = CC.libc;
    const builtinIdx = new Map(); C.builtinList = [];
    const useBuiltin = (name) => {
      let i = builtinIdx.get(name);
      if (i === undefined) { i = C.builtinList.length; C.builtinList.push(libc.table.get(name)); builtinIdx.set(name, i); }
      return i;
    };
    const reported = new Set();
    for (const f of C.fixups) {
      const s = f.sym;
      if (s.defined) continue;
      if (libc.table.has(s.name)) {
        C.code[f.pc] = OP.CALLB; C.code[f.pc + 1] = useBuiltin(s.name); C.code[f.pc + 2] = f.argc;
        s.builtin = true;
        continue;
      }
      if (reported.has(s.name)) continue;
      reported.add(s.name);
      C.line = f.line;
      if (s.name === 'gets') C.error({ line: f.line }, "the 'gets' function is dangerous and was removed from the C standard because it cannot be used safely; use fgets() instead");
      else C.error({ line: f.line }, "undefined reference to '" + s.name + "' (the function is declared or called but never defined)");
    }
    for (const [name, s] of C.scopes[0]) {
      if (s.kind === 'func' && s.referenced && !s.defined && !s.builtin && !reported.has(name)) {
        if (libc.table.has(name)) { C.error({ line: s.refLine || s.line }, "taking the address of library function '" + name + "' is not supported"); }
        else { C.error({ line: s.refLine || s.line }, "undefined reference to '" + name + "'"); }
        reported.add(name);
      }
    }
    if (!C.mainSym) C.error({ line: 1 }, "undefined reference to 'main' (every C program needs a main function)");
  }


  /** Fuses hot instruction sequences in place (same length, padding is never executed):
   *    LLOAD a; LLOAD b; CMP; JZ t   -> JCLL cmp,a,b,t      LLOAD a; ICONST c; CMP; JZ t -> JCLC cmp,a,c,t
   *    LLOAD a; ICONST c; ADD|SUB; LSTOREP a -> ADDLC a,+-c
   *  Only int32 locals; skipped if any jump lands inside the fused region. */
  function peephole(C) {
    const code = C.code, n = code.length, ARGS = CC.OPARGS;
    const targets = new Set();
    for (const f of C.funcs) if (f && typeof f.entry === 'number') targets.add(f.entry);
    for (const k of C.consts) if (k && typeof k === 'object' && k.map instanceof Map) { for (const v of k.map.values()) targets.add(v); targets.add(k.def); }
    const starts = [];
    for (let pc = 0; pc < n;) {
      const op = code[pc]; starts.push(pc);
      if (op === OP.JMP || op === OP.JZ || op === OP.JNZ) targets.add(code[pc + 1]);
      if (ARGS[op] === undefined) return;        // unknown op: leave the program alone
      pc += 1 + ARGS[op];
    }
    const CMPS = [[OP.EQ_I, 0], [OP.NE_I, 1], [OP.LT_I, 2], [OP.GT_I, 3], [OP.LE_I, 4], [OP.GE_I, 5]];
    const cmpKind = (op) => { for (const c of CMPS) if (c[0] === op) return c[1]; return -1; };
    const free = (from, to) => { for (let p = from + 1; p < to; p++) if (targets.has(p)) return false; return true; };
    for (const pc of starts) {
      if (code[pc] === OP.LLOAD && code[pc + 1] === 4) {
        const a = code[pc + 2];
        // LLOAD a; LLOAD b; CMP; JZ
        if (code[pc + 3] === OP.LLOAD && code[pc + 4] === 4) {
          const k = cmpKind(code[pc + 6]);
          if (k >= 0 && code[pc + 7] === OP.JZ && free(pc, pc + 9)) {
            code[pc] = OP.JCLL; code[pc + 1] = k; code[pc + 2] = a; code[pc + 3] = code[pc + 5]; code[pc + 4] = code[pc + 8];
            continue;
          }
        }
        if (code[pc + 3] === OP.ICONST) {
          const c = code[pc + 4], k = cmpKind(code[pc + 5]);
          if (k >= 0 && code[pc + 6] === OP.JZ && free(pc, pc + 8)) {
            code[pc] = OP.JCLC; code[pc + 1] = k; code[pc + 2] = a; code[pc + 3] = c; code[pc + 4] = code[pc + 7];
            continue;
          }
          if ((code[pc + 5] === OP.ADD_I || code[pc + 5] === OP.SUB_I) && code[pc + 6] === OP.LSTOREP && code[pc + 7] === 4 && code[pc + 8] === a && free(pc, pc + 9)) {
            code[pc] = OP.ADDLC; code[pc + 1] = a; code[pc + 2] = code[pc + 5] === OP.ADD_I ? c : (-c | 0);
            continue;
          }
        }
      }
    }
  }

  function assemble(C) {
    // argv / envp live in read-only memory
    const progName = C.internString([97, 46, 111, 117, 116]);
    while (C.rodata.length % 8) C.rodata.push(0);
    const argvOff = C.rodata.length;
    const w8 = (v) => { for (let i = 0; i < 8; i++) C.rodata.push(Number((BigInt(v) >> BigInt(8 * i)) & 255n)); };
    w8(progName); w8(0);
    const envOff = C.rodata.length; w8(0);
    const argvAddr = MEM.RO_BASE + argvOff, envAddr = MEM.RO_BASE + envOff;
    // FILE objects behind stdin / stdout / stderr
    const std = ['stdin', 'stdout', 'stderr'];
    std.forEach((nm, fd) => {
      const s = C.scopes[0].get(nm);
      if (s && s.kind === 'var') {
        const a = C.allocGlobal(16, 8);
        C.gwrite(a, 4, BigInt(fd));
        C.gwrite(s.addr, 8, BigInt(a));
      }
    });
    C.line = 1;
    const startPc = C.code.length;
    const m = C.mainSym;
    const np = m.type.unspecified ? 0 : m.type.params.length;
    const args = [() => C.emit(OP.ICONST, 1), () => C.emit(OP.ICONST, argvAddr), () => C.emit(OP.ICONST, envAddr)];
    for (let i = 0; i < Math.min(np, 3); i++) args[i]();
    C.emit(OP.CALL, m.idx, Math.min(np, 3));
    C.emit(OP.HALT);
    const symAddr = new Map();
    for (const [name, s] of C.scopes[0]) if (s.kind === 'var') symAddr.set(name, s.addr);
    const gdata = Uint8Array.from(C.gdata);
    if (!C.noOpt) peephole(C);
    return {
      code: Int32Array.from(C.code), lines: Int32Array.from(C.lines), consts: C.consts,
      funcs: C.funcs, builtins: C.builtinList, rodata: Uint8Array.from(C.rodata), gdata,
      globalSize: gdata.length, globalRedzones: C.redzones, symAddr, startPc,
      mainIdx: m.idx
    };
  }

  /** Compile C source. Returns {ok, errors:[{line,col,msg,sev}], program?, ast, tokens, comments, funcs, source} */
  CC.compile = function (src, opts) {
    opts = opts || {};
    src = String(src);
    if (src.length > 400000) return { ok: false, errors: [{ line: 1, col: 1, msg: 'source file is too large (limit: 400,000 characters)', sev: 'error' }], source: src };
    let r = compileOnce(src, opts, null);
    let diags = r.C.errors.slice();
    // gcc-style "implicit declaration" warnings, then fix up the program as if the header had been included
    const implicitKnown = [...r.C.implicit].filter(n => CC.libc.headerOf(n) && CC.libc.isBuiltin(n));
    if (implicitKnown.length) {
      const hdrs = [...new Set(implicitKnown.map(n => CC.libc.headerOf(n)))];
      const implicitWarn = diags.filter(d => d.sev === 'warning' && /implicit declaration of function/.test(d.msg) && implicitKnown.some(n => d.msg.indexOf("'" + n + "'") >= 0));
      r = compileOnce(src, opts, hdrs);
      const keep = r.C.errors.filter(d => !(d.sev === 'warning' && /implicit declaration of function/.test(d.msg)));
      diags = implicitWarn.concat(keep);
    }
    const errors = diags.sort((a, b) => (a.line - b.line) || (a.col - b.col));
    const ok = r.ok && !errors.some(e => e.sev === 'error');
    return {
      ok, errors, program: ok ? r.program : null, source: src,
      ast: r.fe.ast, tokens: r.fe.tokens, comments: r.fe.lex.comments || [],
      funcs: r.C.funcs, implicit: [...r.C.implicit]
    };
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
