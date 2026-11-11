/* C-Slayer · WebAssembly tier.
 * Translates the same bytecode the VM and Turbo run into a WebAssembly module (own binary emitter, no toolchain).
 *   - 64-bit integers are native i64, so hashes, modular arithmetic and long long loops run at machine speed.
 *   - Program memory and its poison map share one WebAssembly.Memory; every load and store keeps the VM's checks inline,
 *     so out-of-bounds, use-after-free, uninitialised and read-only violations are caught exactly as before.
 *   - Anything the translator is not certain about throws Unsupported and the run silently falls back to Turbo.
 * Value classes come from the bytecode itself (I U L UL F D); a union-find pass labels every operand-stack value.
 */
(function (g) {
  'use strict';
  const CC = g.CC = g.CC || {};
  const OP = CC.OP, MEM = CC.MEM, H = CC.VMH, TP = CC.Turbo.parts;
  class Unsupported extends Error { }
  const un = (m) => { throw new Unsupported(m); };

  // ---------------- binary emitter ----------------
  const uleb = (n) => { const o = []; n = Math.floor(n); do { let b = n % 128; n = Math.floor(n / 128); if (n) b |= 128; o.push(b); } while (n); return o; };
  const sleb = (n) => { const o = []; n = BigInt(n); for (;;) { const b = Number(n & 127n); n >>= 7n; if ((n === 0n && !(b & 64)) || (n === -1n && (b & 64))) { o.push(b); return o; } o.push(b | 128); } };
  const f32b = (v) => { const b = new Uint8Array(4); new DataView(b.buffer).setFloat32(0, v, true); return [...b]; };
  const f64b = (v) => { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v, true); return [...b]; };
  const str = (s) => { const b = [...new TextEncoder().encode(s)]; return [...uleb(b.length), ...b]; };
  const vec = (items) => [...uleb(items.length), ...items.flat()];
  const section = (id, bytes) => [id, ...uleb(bytes.length), ...bytes];
  const VT = { i32: 0x7f, i64: 0x7e, f32: 0x7d, f64: 0x7c };

  // ---------------- value classes ----------------
  const CLS = ['I', 'U', 'L', 'UL', 'F', 'D'];
  const TYOF = { I: 'i32', U: 'i32', X: 'i32', L: 'i64', UL: 'i64', F: 'f32', D: 'f64' };
  const KCLS = ['I', 'I', 'I', 'I', 'I', 'U', 'L', 'UL', 'F', 'D', 'U'];       // class of a value loaded with memory kind k
  const KTY = KCLS.map(c => TYOF[c]);
  const KSIZE = TP.KSIZE;
  // names of ops with an explicit class
  const OPCLS = {};
  for (const nm of ['ADD', 'SUB', 'MUL', 'DIV', 'MOD', 'AND', 'OR', 'XOR', 'SHL', 'SHR']) for (const c of ['I', 'U', 'L', 'UL']) { const o = OP[nm + '_' + c]; if (o !== undefined) OPCLS[o] = { nm, c }; }
  for (const nm of ['ADD', 'SUB', 'MUL', 'DIV']) for (const c of ['F', 'D']) { const o = OP[nm + '_' + c]; if (o !== undefined) OPCLS[o] = { nm, c }; }
  const CMPNAME = ['EQ', 'NE', 'LT', 'GT', 'LE', 'GE'];
  const CMPOPS = {};
  for (const nm of CMPNAME) for (const c of ['I', 'U', 'L', 'F']) CMPOPS[OP[nm + '_' + c]] = { k: CMPNAME.indexOf(nm), c };

  // ---------------- class inference (union-find over every value) ----------------
  // 'X' = a 32-bit integer seen both as signed and unsigned (pointer + int). Fine for add/sub/store, not for compares or conversions.
  const merge = (la, lb) => {
    if (!la) return lb || null; if (!lb || la === lb) return la;
    const i32 = (c) => c === 'I' || c === 'U' || c === 'X';
    if (i32(la) && i32(lb)) return 'X';
    return un('class conflict ' + la + '/' + lb);
  };
  class Vars {
    constructor() { this.par = []; this.lab = []; this.cst = []; this.req = []; }
    mk(label, cst) { const i = this.par.length; this.par.push(i); this.lab.push(label || null); this.cst.push(cst || null); this.req.push(false); return i; }
    find(a) { while (this.par[a] !== a) { this.par[a] = this.par[this.par[a]]; a = this.par[a]; } return a; }
    unify(a, b) {
      a = this.find(a); b = this.find(b); if (a === b) return;
      const la = this.lab[a], lb = this.lab[b], m = merge(la, lb);
      this.par[b] = a; this.lab[a] = m;
      if (!this.cst[a]) this.cst[a] = this.cst[b]; else if (this.cst[b] && this.cst[b].v !== undefined) this.cst[a].list = (this.cst[a].list || []).concat(this.cst[b].list || [], [this.cst[b]]);
      this.req[a] = this.req[a] || this.req[b];
    }
    label(a, l) { a = this.find(a); this.lab[a] = merge(this.lab[a], l); }
    need(a) { this.req[this.find(a)] = true; }
    /** final class: explicit label, else a default for constants; null if unknown */
    cls(a) {
      a = this.find(a); if (this.lab[a]) return this.lab[a];
      const c = this.cst[a]; if (!c) return null;
      const all = [c].concat(c.list || []);
      for (const k of all) {
        if (typeof k.v === 'bigint') return (k.v >= (1n << 63n)) ? 'UL' : 'L';
      }
      for (const k of all) if (typeof k.v === 'number' && (!Number.isInteger(k.v) || !Number.isSafeInteger(k.v))) return 'D';
      for (const k of all) if (typeof k.v === 'number' && (k.v > 2147483647 || k.v < -2147483648) && k.v <= 4294967295 && k.v >= 0) return 'U';
      for (const k of all) if (typeof k.v === 'number' && Math.abs(k.v) > 4294967295) return 'L';
      return 'I';
    }
    ty(a) { const c = this.cls(a); return c ? TYOF[c] : 'i32'; }
  }

  /** per-function bytecode facts shared by inference and emission */
  function prepare(prog) {
    const code = prog.code, consts = prog.consts, funcs = prog.funcs;
    const entries = [];
    funcs.forEach((f, i) => { if (f && typeof f.entry === 'number') entries.push({ i, pc: f.entry }); });
    entries.sort((a, b) => a.pc - b.pc);
    for (let k = 1; k < entries.length; k++) if (entries[k].pc === entries[k - 1].pc) un('shared entry');
    const fns = [];
    for (let k = 0; k < entries.length; k++) {
      const start = entries[k].pc, end = k + 1 < entries.length ? entries[k + 1].pc : prog.startPc;
      const D = TP.decode(code, start, end);
      fns.push({ id: entries[k].i, name: 'f' + entries[k].i, D, A: TP.analyze(code, consts, D), rec: funcs[entries[k].i], start, end });
    }
    const SD = TP.decode(code, prog.startPc, prog.haltPc + 1);
    const stub = { id: -1, name: 'fstart', D: SD, A: TP.analyze(code, consts, SD), rec: null, start: prog.startPc, end: prog.haltPc + 1 };
    if (stub.A.nparams !== 0) un('stub params');
    fns.push(stub);
    const byId = new Map(fns.map(f => [f.id, f]));
    return { code, consts, funcs, fns, byId, stub };
  }

  const BANNED = new Set(['qsort', 'bsearch', 'atexit', 'signal', 'setjmp', 'longjmp', 'on_exit']);

  /** pass 1: simulate the operand stack with value ids, unify classes, record each instruction's operands */
  function infer(prog, P) {
    const cos = [], pairs = [], pp = [];
    const want = (r, key, v, c) => { cos.push({ r, key, v, c }); };
    const V = new Vars(), { code, consts } = P;
    for (const b of prog.builtins || []) if (b && BANNED.has(b.name)) un('builtin ' + b.name);
    for (const f of P.fns) {
      f.params = []; for (let i = 0; i < f.A.nparams; i++) f.params.push(V.mk());
      f.ret = V.mk();
    }
    const sites = [];
    for (const f of P.fns) {
      const { D, A } = f, ins = D.ins, n = ins.length;
      const rec = f.irec = new Array(n).fill(null), entry = new Array(n).fill(null);
      f.promoted = f.rec ? TP.localAccesses(code, ins, f.rec.slots || [], f.rec.redzones || []) : new Map();
      const work = [];
      const reach = (idx, stack) => {
        if (idx === undefined) un('bad jump');
        if (entry[idx] === null) { entry[idx] = stack.slice(); work.push(idx); }
        else { if (entry[idx].length !== stack.length) un('stack mismatch'); for (let i = 0; i < stack.length; i++) { try { V.unify(entry[idx][i], stack[i]); } catch (err) { err.message += ' @join pc=' + ins[idx].pc + ' fn=' + f.name + ' slot=' + i; throw err; } } }
      };
      reach(0, f.params);
      while (work.length) {
        let idx = work.pop();
        let st = entry[idx].slice();
        for (;;) {
          const I = ins[idx], op = I.op, o = I.o, r = rec[idx] = { st: st.slice(), op };
          const pop = () => st.pop(), push = (v) => { st.push(v); return v; };
          let term = false;
          try {
          if (OPCLS[op]) {
            const { nm, c } = OPCLS[op], b = pop(), a = pop(), res = V.mk(c);
            if (c === 'L' || c === 'UL') want(r, 'a', a, c); else V.label(a, c);
            if (nm === 'SHL' || nm === 'SHR') { /* count may be any integer */ V.need(b); } else if (c === 'L' || c === 'UL') want(r, 'b', b, c); else V.label(b, c);
            r.a = a; r.b = b; r.res = push(res);
          } else if (CMPOPS[op]) {
            const { c } = CMPOPS[op], b = pop(), a = pop(), res = V.mk('I');
            if (c === 'I' || c === 'U') { V.label(a, c); V.label(b, c); } else pairs.push({ r, a, b });
            r.a = a; r.b = b; r.res = push(res);
          } else switch (op) {
            case OP.ENTER: case OP.LINE: break;
            case OP.ICONST: r.res = push(V.mk(null, { v: code[o] })); break;
            case OP.KCONST: { const v = consts[code[o]]; if (typeof v !== 'number' && typeof v !== 'bigint') un('constant kind'); r.res = push(V.mk(null, { v })); break; }
            case OP.POP: pop(); break;
            case OP.DUP: r.a = st[st.length - 1]; r.res = push(r.a); break;
            case OP.DUPX1: { const a = st[st.length - 1], b = st[st.length - 2]; r.a = a; r.b = b; st[st.length - 2] = a; st[st.length - 1] = b; push(a); break; }
            case OP.SWAP: { const k = st.length; r.a = st[k - 1]; r.b = st[k - 2]; st[k - 1] = r.b; st[k - 2] = r.a; break; }
            case OP.LEAL: r.res = push(V.mk('U')); break;
            case OP.LLOAD: { const k = code[o]; r.res = push(V.mk(KCLS[k])); break; }
            case OP.LSTORE: case OP.LSTOREP: { const k = code[o], v = pop(); if (op === OP.LSTOREP && (KCLS[k] === 'L' || KCLS[k] === 'UL')) want(r, 'a', v, KCLS[k]); else V.label(v, KCLS[k]); r.a = v; if (op === OP.LSTORE) r.res = push(v); break; }
            case OP.LOAD: { const k = code[o], a = pop(); V.label(a, 'U'); r.a = a; r.res = push(V.mk(KCLS[k])); break; }
            case OP.STORE: case OP.STOREP: { const k = code[o], v = pop(), a = pop(); V.label(a, 'U'); if (op === OP.STOREP && (KCLS[k] === 'L' || KCLS[k] === 'UL')) want(r, 'b', v, KCLS[k]); else V.label(v, KCLS[k]); r.a = a; r.b = v; if (op === OP.STORE) r.res = push(v); break; }
            case OP.NEG: case OP.BNOT: { const c = CLS[code[o]], a = pop(); if (c === 'L' || c === 'UL') want(r, 'a', a, c); else V.label(a, c); r.a = a; r.res = push(V.mk(c)); break; }
            case OP.LNOT: case OP.TOBOOL: { const a = pop(); V.need(a); r.a = a; r.res = push(V.mk('I')); break; }
            case OP.NARROW: { const a = pop(); r.a = a; r.res = push(V.mk('I')); break; }
            case OP.CONV: { const ft = code[o], a = pop(); if (CLS[ft >> 3] === CLS[ft & 7]) { r.a = a; r.res = push(V.mk()); V.unify(r.res, a); break; } if (CLS[ft >> 3] === 'L' || CLS[ft >> 3] === 'UL') want(r, 'a', a, CLS[ft >> 3]); else V.label(a, CLS[ft >> 3]); r.a = a; r.res = push(V.mk(CLS[ft & 7])); break; }
            case OP.JMP: reach(D.at.get(code[o]), st); term = true; break;
            case OP.JZ: case OP.JNZ: { const a = pop(); V.need(a); r.a = a; reach(D.at.get(code[o]), st); break; }
            case OP.SWITCH: { const a = pop(); V.label(a, 'I'); r.a = a; const t = TP.switchTable(consts, code[o]); for (const tg of [...t.map.values(), t.def]) reach(D.at.get(tg), st); term = true; break; }
            case OP.CALL: {
              const callee = code[o], argc = code[o + 1], tgt = P.byId.get(callee);
              if (!tgt || tgt.A.nparams !== argc) un('call arity');
              const args = st.splice(st.length - argc, argc); args.forEach((a, i) => pp.push({ r, key: 'g' + i, a, p: tgt.params[i] }));
              r.args = args; r.callee = tgt; r.res = push(V.mk()); V.unify(r.res, tgt.ret); break;
            }
            case OP.CALLI: un('indirect call');
            case OP.CALLB: {
              const bi = code[o], argc = code[o + 1], args = st.splice(st.length - argc, argc);
              r.args = args; r.bi = bi; r.res = push(V.mk(prog.builtins[bi] && prog.builtins[bi].ret || undefined)); r.site = sites.length; r.pcAfter = I.pc + I.len; r.fn = f.id; sites.push(r); break;
            }
            case OP.RET: case OP.HALT: { const a = pop(); pp.push({ r, key: 'r', a, p: f.ret }); r.a = a; term = true; break; }
            case OP.MEMCPY: { const s = pop(), d = st[st.length - 1]; V.label(s, 'U'); V.label(d, 'U'); r.a = s; r.b = d; break; }
            case OP.MEMZERO: { const a = pop(); V.label(a, 'U'); r.a = a; break; }
            case OP.ALLOCA: { const a = pop(); V.need(a); r.a = a; r.res = push(V.mk('U')); break; }
            case OP.JCLL: case OP.JCLC: case OP.ADDLC: if (op !== OP.ADDLC) reach(D.at.get(code[o + 3]), st); break;
            case OP.JCMP: { const b = pop(), a = pop(); pairs.push({ r, a, b }); r.a = a; r.b = b; reach(D.at.get(code[o + 1]), st); break; }
            default: un('op ' + CC.OPNAMES[op]);
          }
          } catch (err) { if (err instanceof Unsupported) err.message += ' @' + CC.OPNAMES[op]; throw err; }
          r.after = st.slice();
          if (term || idx + 1 >= n) break;
          idx++;
          if (entry[idx] !== null) { reach(idx, st); break; }
          entry[idx] = st.slice();
        }
      }
      f.entry = entry;
    }
    // implicit int -> long coercions (the VM lets a 32-bit value flow into a 64-bit slot; here it becomes an explicit extend)
    for (const q of cos) {
      const root = V.find(q.v), lab = V.lab[root];
      if (!lab) { V.label(q.v, q.c); continue; }
      if (lab === q.c) continue;
      if ((lab === 'I' || lab === 'U') && (q.c === 'L' || q.c === 'UL')) { q.r['co' + q.key] = lab === 'U' ? 0xad : 0xac; continue; }
      un('class conflict ' + lab + '/' + q.c);
    }
    for (const q of pp) {
      const la = V.lab[V.find(q.a)], lb = V.lab[V.find(q.p)];
      if ((la === 'I' || la === 'U') && (lb === 'L' || lb === 'UL')) q.r['co' + q.key] = la === 'U' ? 0xad : 0xac; else { try { V.unify(q.a, q.p); } catch (err) { err.message += ' @pp:' + CC.OPNAMES[q.r.op] + '.' + q.key; throw err; } }
    }
    for (const q of pairs) {
      const la = V.lab[V.find(q.a)], lb = V.lab[V.find(q.b)], nar = (l) => l === 'I' || l === 'U', wid = (l) => l === 'L' || l === 'UL';
      if (nar(la) && wid(lb)) { q.r.coa = la === 'U' ? 0xad : 0xac; q.r.cmpv = q.b; }
      else if (wid(la) && nar(lb)) { q.r.cob = lb === 'U' ? 0xad : 0xac; q.r.cmpv = q.a; }
      else { try { V.unify(q.a, q.b); } catch (err) { err.message += ' @pair:' + CC.OPNAMES[q.r.op]; throw err; } }
      V.need(q.a); V.need(q.b);
    }
    // every value that needs a signed/unsigned/float decision must have one
    for (const f of P.fns) f.irec.forEach((r, i) => { if (r) for (const k of ['a', 'b']) if (r[k] !== undefined && V.req[V.find(r[k])]) { const c = V.cls(r[k]), nm = CC.OPNAMES[f.D.ins[i].op]; if (!c) un('unresolved class @' + nm); if (c === 'X') un('ambiguous signedness @' + nm); } });
    P.V = V; P.sites = sites;
    // Heuristic for the worker: call-heavy recursion with only 32-bit work runs a little faster as plain JS (V8 inlines it);
    // 64-bit integers and doubles are where WebAssembly wins big.
    let wide = false; const calls = new Map();
    for (const f of P.fns) { const out = new Set(); f.irec.forEach((r) => { if (!r) return; if (OPCLS[r.op] && /^(L|UL|D|F)$/.test(OPCLS[r.op].c)) wide = true; if (r.callee) out.add(r.callee.id); }); calls.set(f.id, out); }
    const seen = new Map(); let rec = false;
    const dfs = (id) => { seen.set(id, 1); for (const t of calls.get(id) || []) { if (seen.get(t) === 1) rec = true; else if (!seen.has(t)) dfs(t); } seen.set(id, 2); };
    for (const f of P.fns) if (!seen.has(f.id)) dfs(f.id);
    P.preferTurbo = rec && !wide;
    return P;
  }

  // ---------------- pass 2: emit ----------------
  const N = (x) => x;
  function emitProgram(P, vm, hooks) {
    const { V, code, consts } = P;
    const size = vm.size, POFF = size, LO = MEM.LOW, ROE = MEM.RO_BASE + MEM.RO_SIZE, SL = vm.stackLimit;
    // ---- imports ----
    const types = [], typeIdx = new Map();
    const typeOf = (params, results) => { const k = params.join(',') + '>' + results.join(','); let i = typeIdx.get(k); if (i === undefined) { i = types.length; types.push([0x60, ...vec(params.map(p => [VT[p]])), ...vec(results.map(p => [VT[p]]))]); typeIdx.set(k, i); } return i; };
    const imports = [];      // {name, params, results, js}
    const importIdx = new Map();
    const imp = (name, params, results, js) => { let i = importIdx.get(name); if (i === undefined) { i = imports.length; imports.push({ name, params, results, js }); importIdx.set(name, i); } return i; };
    const I32 = 'i32';
    const fnIndex = new Map();            // fn id -> wasm function index (assigned after imports are known)
    // fixed imports first so their indices are small and stable
    const impTK = imp('tk', [], [], null), impRD = imp('rd', [I32, I32, I32, I32, I32], [], null), impWR = imp('wr', [I32, I32, I32, I32, I32], [], null);
    const impDZ = imp('dz', [I32, I32, I32], [], null), impSOV = imp('sov', [I32], [], null);
    const impMC = imp('mc', [I32, I32, I32, I32, I32, I32], [], null), impMZ = imp('mz', [I32, I32, I32, I32, I32], [], null);
    const impAL = imp('al', [I32, I32, I32, I32, I32, I32], [I32], null);
    const bodies = [];
    const nFixedImports = () => imports.length;
    // we need import indices final before emitting calls: collect imports by a dry pass of site creation
    const siteImp = new Map();
    for (const s of P.sites) {
      const argTy = s.args.map(a => V.ty(a)), argCl = s.args.map(a => V.cls(a) || (V.ty(a) === 'i32' ? 'I' : V.ty(a) === 'i64' ? 'L' : V.ty(a) === 'f32' ? 'F' : 'D'));
      const rt = V.ty(s.res), rc = V.cls(s.res) || (rt === 'i32' ? 'I' : rt === 'i64' ? 'L' : rt === 'f32' ? 'F' : 'D');
      siteImp.set(s, { idx: imp('cb' + s.site, [...argTy, I32, I32], [rt], { bi: s.bi, argCl, rc, rt, pc: s.pcAfter, fn: s.fn }), argTy, rt });
    }
    const convImp = new Map();
    const nImports = () => imports.length;
    // function indices: imports first, then functions in order
    // (conversion imports are created lazily during emission; to keep indices stable we pre-scan conversions)
    for (const f of P.fns) for (const r of f.irec) {
      if (!r) continue;
    }
    // pre-scan conversions that need a JS helper
    const needsHelper = (from, to) => {
      if (from === to) return false;
      const fi = CLS.indexOf(from), ti = CLS.indexOf(to);
      if ((from === 'F' || from === 'D') && to !== 'F' && to !== 'D') return !(to === 'I');   // only F/D->I is inlined
      return false;
    };
    for (const f of P.fns) { const ins = f.D.ins; for (let i = 0; i < ins.length; i++) { const r = f.irec[i]; if (!r || ins[i].op !== OP.CONV) continue; const ft = code[ins[i].o]; const from = CLS[ft >> 3], to = CLS[ft & 7]; if (needsHelper(from, to)) { const k = from + '>' + to; if (!convImp.has(k)) convImp.set(k, imp('cv' + k, [TYOF[from]], [TYOF[to]], { from, to, ft })); } } }
    const baseFn = imports.length;
    P.fns.forEach((f, i) => fnIndex.set(f.id, baseFn + i));

    // ---- functions ----
    const funcBodies = [], funcTypes = [];
    for (const f of P.fns) {
      const { D, A, irec } = f, ins = D.ins, n = A.nparams, FN = f.id, promoted = f.promoted;
      const rec = f.rec, fs = rec ? rec.frameSize : 0, redz = rec ? (rec.redzones || []) : [];
      let needFrame = redz.length > 0;
      for (const I of ins) {
        const o = I.o;
        switch (I.op) {
          case OP.LEAL: case OP.ALLOCA: needFrame = true; break;
          case OP.LLOAD: case OP.LSTORE: case OP.LSTOREP: if (!promoted.has(code[o + 1])) needFrame = true; break;
          case OP.JCLL: if (!promoted.has(code[o + 1]) || !promoted.has(code[o + 2])) needFrame = true; break;
          case OP.JCLC: if (!promoted.has(code[o + 1])) needFrame = true; break;
          case OP.ADDLC: if (!promoted.has(code[o])) needFrame = true; break;
        }
      }
      if (needFrame && !rec) un('frame in stub');
      const ptys = f.params.map(p => V.ty(p)), rty = V.ty(f.ret);
      funcTypes.push(typeOf(ptys, [rty]));
      const locals = [];                      // types of non-param locals
      const slotMap = new Map(), varMap = new Map();
      const newLocal = (ty) => { locals.push(ty); return n + locals.length - 1; };
      const slot = (p, ty) => { if (p < n && ptys[p] === ty) return p; const k = p + ':' + ty; let i = slotMap.get(k); if (i === undefined) { i = newLocal(ty); slotMap.set(k, i); } return i; };
      const pvar = (off) => { let i = varMap.get(off); if (i === undefined) { i = newLocal(KTY[promoted.get(off)]); varMap.set(off, i); } return i; };
      const tmps = new Map(); const tmp = (ty) => { let i = tmps.get(ty); if (i === undefined) { i = newLocal(ty); tmps.set(ty, i); } return i; };
      const lfp = needFrame ? newLocal('i32') : -1, losp = needFrame ? newLocal('i32') : -1;
      const b = [];                           // body bytes
      const e = (...xs) => { for (const x of xs) { if (Array.isArray(x)) for (const y of x) b.push(y); else b.push(x); } };
      const i32c = (v) => e(0x41, sleb(v | 0));
      const lget = (i) => e(0x20, uleb(i)), lset = (i) => e(0x21, uleb(i)), ltee = (i) => e(0x22, uleb(i));
      const call = (i) => e(0x10, uleb(i));
      const memarg = (off) => e(0, uleb(off));
      const FPV = needFrame ? lfp : -1;
      const ctx = (I) => { i32c(I.pc + I.len); i32c(FN); if (needFrame) lget(lfp); else i32c(0); };
      // value helpers: operand p (stack depth index) of variable v
      const sget = (p, v, rr, key) => { lget(slot(p, V.ty(v))); if (rr && rr['co' + key]) e(rr['co' + key]); };
      const sset = (p, v) => lset(slot(p, V.ty(v)));
      const constOf = (v) => { const c = V.cst[V.find(v)]; return c; };
      const emitConst = (val, ty) => {
        if (ty === 'i32') { if (typeof val === 'bigint') un('i64 constant as i32'); if (!Number.isInteger(val)) un('fractional constant as int'); i32c(Number(BigInt.asIntN(32, BigInt(val)))); }
        else if (ty === 'i64') { if (typeof val === 'number' && !Number.isInteger(val)) un('fractional constant as long'); e(0x42, sleb(BigInt.asIntN(64, BigInt(val)))); }
        else if (ty === 'f32') e(0x43, f32b(Number(val))); else e(0x44, f64b(Number(val)));
      };
      // ---- structure ----
      const labels = new Set([0]);
      for (let i = 0; i < ins.length; i++) { if (A.depth[i] < 0) continue; const e2 = A.eff[i]; if (e2.targets) for (const t of e2.targets) labels.add(D.at.get(t)); }
      const plan = labels.size > 1 ? TP.planStructure(ins, A, D, code) : null;
      if (labels.size > 1 && !plan) un('jumps do not nest');
      const openStack = []; let nextItem = 0, live = true;
      const brDepth = (target, back) => {
        const ti = D.at.get(target);
        for (let k = openStack.length - 1; k >= 0; k--) { const it = openStack[k]; if (it.lab === ti && it.kind === (back ? 'L' : 'B')) return openStack.length - 1 - k; }
        un('no enclosing label');
      };
      let curIdx = 0;
      const jump = (target, I, inIf) => { const back = D.at.get(target) <= curIdx; if (back) tick(); e(0x0c, uleb(brDepth(target, back) + (inIf ? 1 : 0))); };
      const tick = () => { e(0x23, uleb(1), 0x41, sleb(1), 0x6b, 0x24, uleb(1), 0x23, uleb(1), 0x41, sleb(0), 0x48, 0x04, 0x40); call(impTK); e(0x0b); };
      // ---- prologue ----
      tick();
      if (needFrame) {
        e(0x23, uleb(0)); lset(losp);                           // osp = SP
        lget(losp); i32c(fs); e(0x6b); lset(lfp);               // fp = osp - fs
        lget(lfp); i32c(SL); e(0x49, 0x04, 0x40); i32c(FN); call(impSOV); e(0x00, 0x0b);   // fp < SL -> stack overflow
        lget(lfp); e(0x24, uleb(0));                            // SP = fp
        if (fs > 0) { lget(lfp); i32c(0xCC); i32c(fs); e(0xfc, 0x0b, 0x00); }
        for (const r of redz) { lget(lfp); i32c(POFF + r.off); e(0x6a); i32c(3); i32c(r.len); e(0xfc, 0x0b, 0x00); }
      }
      for (const [off, k] of promoted) { // uninitialised locals read as the 0xCC pattern
        const ty = KTY[k], gv = TP.garbage(k);
        if (ty === 'i32') i32c(gv); else if (ty === 'i64') e(0x42, sleb(BigInt.asIntN(64, BigInt(gv)))); else if (ty === 'f32') e(0x43, f32b(gv)); else e(0x44, f64b(gv));
        lset(pvar(off));
      }
      // ---- memory access helpers ----
      const chk = (addrLocal, Nb, write, I) => {
        const lo = write ? ROE : LO;
        lget(addrLocal); i32c(lo); e(0x6b); i32c(size - Nb - lo); e(0x4b, 0x04, 0x40); lget(addrLocal); i32c(Nb); ctx(I); call(write ? impWR : impRD); e(0x00, 0x0b);
        lget(addrLocal); e(0x2d); memarg(POFF);
        if (Nb > 1) { lget(addrLocal); e(0x2d); memarg(POFF + Nb - 1); e(0x72); }
        e(0x04, 0x40); lget(addrLocal); i32c(Nb); ctx(I); call(write ? impWR : impRD); e(0x00, 0x0b);
      };
      const LOADOP = [[0x2c], [0x2d], [0x2e], [0x2f], [0x28], [0x28], [0x29], [0x29], [0x2a], [0x2b], [0x28]];
      const STOREOP = [[0x3a], [0x3a], [0x3b], [0x3b], [0x36], [0x36], [0x37], [0x37], [0x38], [0x39], [0x36]];
      const loadAt = (k, off) => { e(LOADOP[k]); memarg(off); };
      const storeAt = (k, off) => { e(STOREOP[k]); memarg(off); };   // stack: addr, value
      const storeNorm = (k) => { // what an in-register local holds after a store of kind k
        switch (k) { case 0: e(0xc0); break; case 1: i32c(255); e(0x71); break; case 2: e(0xc1); break; case 3: i32c(65535); e(0x71); break; default: break; }
      };
      // ---- instructions ----
      const SH = { I: [0x74, 0x75, 0x75], U: [0x74, 0x76, 0x76] };
      for (let idx = 0; idx < ins.length; idx++) {
        curIdx = idx;
        const I = ins[idx], op = I.op, o = I.o, r = irec[idx], reach = A.depth[idx] >= 0 && r !== null;
        if (plan) {
          const isT = plan.targets.has(idx);
          while (openStack.length && openStack[openStack.length - 1].e <= idx) { openStack.pop(); e(0x0b); }
          while (nextItem < plan.items.length && plan.items[nextItem].s === idx) { const it = plan.items[nextItem++]; openStack.push(it); e(it.kind === 'L' ? 0x03 : 0x02, 0x40); }
          if (isT && reach) live = true; else if (!reach || !live) continue;
        } else if (!reach) continue;
        if (!reach) continue;
        const d = A.depth[idx];                // stack depth before this instruction
        const T = (v) => V.ty(v), C = (v) => V.cls(v);
        const cmpEmit = (kind, v) => {          // stack: a b -> i32 (1 if a OP b)
          const c = C(v), t = T(v);
          if (t === 'i32') { const u = c === 'U'; const tab = [0x46, 0x47, u ? 0x49 : 0x48, u ? 0x4b : 0x4a, u ? 0x4d : 0x4c, u ? 0x4f : 0x4e]; e(tab[kind]); }
          else if (t === 'i64') { const u = c === 'UL'; const tab = [0x51, 0x52, u ? 0x54 : 0x53, u ? 0x56 : 0x55, u ? 0x58 : 0x57, u ? 0x5a : 0x59]; e(tab[kind]); }
          else if (t === 'f32') e([0x5b, 0x5c, 0x5d, 0x5e, 0x5f, 0x60][kind]); else e([0x61, 0x62, 0x63, 0x64, 0x65, 0x66][kind]);
        };
        if (OPCLS[op]) {
          const { nm, c } = OPCLS[op], x = d - 2, y = d - 1, t = TYOF[c];
          if ((nm === 'DIV' || nm === 'MOD') && (c === 'I' || c === 'U' || c === 'L' || c === 'UL')) {
            const w = t === 'i64', sg = c === 'I' || c === 'L';
            // a constant divisor other than 0 and -1 can never trap
            const kc = V.cst[V.find(r.b)], kv = kc && !(kc.list && kc.list.length) && kc.v !== undefined ? Number(kc.v) : null;
            if (kv !== null && kv !== 0 && kv !== -1 && Math.abs(kv) < 2 ** 31) {
              sget(x, r.a, r, 'a'); sget(y, r.b, r, 'b');
              e(w ? (nm === 'DIV' ? (sg ? 0x7f : 0x80) : (sg ? 0x81 : 0x82)) : (nm === 'DIV' ? (sg ? 0x6d : 0x6e) : (sg ? 0x6f : 0x70)));
              sset(x, r.res); continue;
            }
            // trap like the VM: division by zero (and INT_MIN / -1 for signed)
            sget(y, r.b, r, 'b'); e(w ? 0x50 : 0x45);
            if (sg) { sget(y, r.b, r, 'b'); if (w) e(0x42, sleb(-1n), 0x51); else { i32c(-1); e(0x46); } sget(x, r.a, r, 'a'); if (w) e(0x42, sleb(-(1n << 63n)), 0x51); else { i32c(-2147483648); e(0x46); } e(0x71, 0x72); }
            e(0x04, 0x40); i32c(I.pc + I.len); i32c(FN); if (needFrame) lget(lfp); else i32c(0); call(impDZ); e(0x00, 0x0b);
            sget(x, r.a, r, 'a'); sget(y, r.b, r, 'b');
            e(w ? (nm === 'DIV' ? (sg ? 0x7f : 0x80) : (sg ? 0x81 : 0x82)) : (nm === 'DIV' ? (sg ? 0x6d : 0x6e) : (sg ? 0x6f : 0x70)));
            sset(x, r.res); continue;
          }
          sget(x, r.a, r, 'a'); sget(y, r.b, r, 'b');
          if (nm === 'SHL' || nm === 'SHR') {
            // the count may be any integer class; the machine instruction takes the operand's own width
            if (T(r.b) !== t) { if (t === 'i64') e(C(r.b) === 'U' ? 0xad : 0xac); else e(0xa7); }
            if (t === 'i64') e(nm === 'SHL' ? 0x86 : (c === 'L' ? 0x87 : 0x88)); else e(nm === 'SHL' ? 0x74 : (c === 'I' ? 0x75 : 0x76));
          } else if (t === 'i32') e({ ADD: 0x6a, SUB: 0x6b, MUL: 0x6c, AND: 0x71, OR: 0x72, XOR: 0x73 }[nm]);
          else if (t === 'i64') e({ ADD: 0x7c, SUB: 0x7d, MUL: 0x7e, AND: 0x83, OR: 0x84, XOR: 0x85 }[nm]);
          else if (t === 'f32') e({ ADD: 0x92, SUB: 0x93, MUL: 0x94, DIV: 0x95 }[nm]); else e({ ADD: 0xa0, SUB: 0xa1, MUL: 0xa2, DIV: 0xa3 }[nm]);
          sset(x, r.res); continue;
        }
        if (CMPOPS[op]) {
          const { k } = CMPOPS[op], x = d - 2, y = d - 1;
          sget(x, r.a, r, 'a'); sget(y, r.b, r, 'b'); cmpEmit(k, r.cmpv === undefined ? r.a : r.cmpv); sset(x, r.res); continue;
        }
        switch (op) {
          case OP.ENTER: case OP.LINE: break;
          case OP.ICONST: case OP.KCONST: { const v = op === OP.ICONST ? code[o] : consts[code[o]]; emitConst(v, T(r.res)); sset(d, r.res); break; }
          case OP.POP: break;
          case OP.DUP: sget(d - 1, r.a); sset(d, r.a); break;
          case OP.DUPX1: // [.. b a] -> [.. a b a]
            sget(d - 1, r.a); sset(d, r.a); sget(d - 2, r.b); sset(d - 1, r.b); sget(d, r.a); sset(d - 2, r.a); break;
          case OP.SWAP: { // [.. b a] -> [.. a b]
            sget(d - 1, r.a); lset(tmp(T(r.a))); sget(d - 2, r.b); sset(d - 1, r.b); lget(tmp(T(r.a))); sset(d - 2, r.a); break; }
          case OP.LEAL: lget(lfp); i32c(code[o]); e(0x6a); sset(d, r.res); break;
          case OP.LLOAD: {
            const k = code[o], off = code[o + 1];
            if (promoted.has(off)) lget(pvar(off)); else { lget(lfp); loadAt(k, off); }
            sset(d, r.res); break;
          }
          case OP.LSTORE: case OP.LSTOREP: {
            const k = code[o], off = code[o + 1];
            if (promoted.has(off)) { sget(d - 1, r.a, r, 'a'); storeNorm(k); lset(pvar(off)); }
            else { lget(lfp); sget(d - 1, r.a, r, 'a'); storeAt(k, off); if (k === 10) { lget(lfp); i32c(0); storeAt(4, off + 4); } }
            if (op === OP.LSTORE) { /* the raw value stays on the stack where it was */ }
            break;
          }
          case OP.LOAD: {
            const k = code[o], a = slot(d - 1, 'i32'); chk(a, KSIZE[k], false, I);
            lget(a); loadAt(k, 0); sset(d - 1, r.res); break;
          }
          case OP.STORE: case OP.STOREP: {
            const k = code[o], a = slot(d - 2, 'i32'); chk(a, KSIZE[k], true, I);
            lget(a); sget(d - 1, r.b, r, 'b'); storeAt(k, 0); if (k === 10) { lget(a); i32c(0); storeAt(4, 4); }
            if (op === OP.STORE) { sget(d - 1, r.b); sset(d - 2, r.res); }
            break;
          }
          case OP.NEG: {
            const c = CLS[code[o]], t = TYOF[c], x = d - 1;
            if (t === 'i32') { i32c(0); sget(x, r.a, r, 'a'); e(0x6b); } else if (t === 'i64') { e(0x42, sleb(0n)); sget(x, r.a, r, 'a'); e(0x7d); } else { sget(x, r.a); e(t === 'f32' ? 0x8c : 0x9a); }
            sset(x, r.res); break;
          }
          case OP.BNOT: {
            const t = TYOF[CLS[code[o]]], x = d - 1;
            sget(x, r.a, r, 'a'); if (t === 'i32') { i32c(-1); e(0x73); } else if (t === 'i64') e(0x42, sleb(-1n), 0x85); else un('bnot float');
            sset(x, r.res); break;
          }
          case OP.LNOT: case OP.TOBOOL: {
            const t = T(r.a), x = d - 1; sget(x, r.a);
            if (op === OP.LNOT) { if (t === 'i32') e(0x45); else if (t === 'i64') e(0x50); else if (t === 'f32') { e(0x43, f32b(0), 0x5b); } else e(0x44, f64b(0), 0x61); }
            else { if (t === 'i32') { i32c(0); e(0x47); } else if (t === 'i64') { e(0x42, sleb(0n), 0x52); } else if (t === 'f32') { e(0x43, f32b(0), 0x5c); } else e(0x44, f64b(0), 0x62); }
            sset(x, r.res); break;
          }
          case OP.NARROW: {
            const x = d - 1; if (T(r.a) !== 'i32') un('narrow of non-int'); sget(x, r.a);
            const k = code[o]; if (k === 0) e(0xc0); else if (k === 1) { i32c(255); e(0x71); } else if (k === 2) e(0xc1); else { i32c(65535); e(0x71); }
            sset(x, r.res); break;
          }
          case OP.CONV: {
            const ft = code[o], from = CLS[ft >> 3], to = CLS[ft & 7], x = d - 1, tf = TYOF[from], tt = TYOF[to];
            sget(x, r.a, r, 'a');
            if (from === to || (tf === tt && tf !== 'f32' && tf !== 'f64')) { /* same machine bits */ }
            else if (tf === 'i32' && tt === 'i64') e(from === 'I' ? 0xac : 0xad);
            else if (tf === 'i64' && tt === 'i32') e(0xa7);
            else if (tf === 'i32' && tt === 'f32') e(from === 'I' ? 0xb2 : 0xb3);
            else if (tf === 'i32' && tt === 'f64') e(from === 'I' ? 0xb7 : 0xb8);
            else if (tf === 'i64' && tt === 'f32') e(from === 'L' ? 0xb4 : 0xb5);
            else if (tf === 'i64' && tt === 'f64') e(from === 'L' ? 0xb9 : 0xba);
            else if (tf === 'f32' && tt === 'f64') e(0xbb);
            else if (tf === 'f64' && tt === 'f32') e(0xb6);
            else if (to === 'I' && (tf === 'f32' || tf === 'f64')) {
              // x86 cvttsd2si: NaN or out of range gives INT_MIN
              if (tf === 'f32') e(0xbb);
              const tf64 = tmp('f64'); ltee(tf64);
              e(0xfc, 0x02); i32c(-2147483648);                       // trunc_sat, INT_MIN
              lget(tf64); e(0x44, f64b(-2147483648), 0x66);           // v >= -2^31
              lget(tf64); e(0x44, f64b(2147483648), 0x63, 0x71, 0x1b); // v < 2^31, and, select(trunc, INT_MIN, inRange)
            }
            else { // rare float<->wide conversions go through the VM's own conversion routine
              const key = from + '>' + to, im = convImp.get(key); if (im === undefined) un('conv ' + key); call(im);
            }
            sset(x, r.res); break;
          }
          case OP.JMP: jump(code[o], I); live = false; break;
          case OP.JZ: case OP.JNZ: {
            const t = T(r.a); sget(d - 1, r.a);
            if (t === 'i64') e(0x50); else if (t === 'i32') e(0x45); else if (t === 'f32') e(0x43, f32b(0), 0x5b); else e(0x44, f64b(0), 0x61);   // value == 0
            if (op === OP.JNZ) e(0x45);
            e(0x04, 0x40); jump(code[o], I, true); e(0x0b); break;
          }
          case OP.SWITCH: {
            const tb = TP.switchTable(consts, code[o]); sget(d - 1, r.a);
            const keys = [...tb.map.keys()]; for (const k of keys) if (typeof k !== 'number') un('switch key');
            const lo = Math.min(...keys), hi = Math.max(...keys);
            if (keys.length && hi - lo < 4096) {
              const tv = tmp('i32'); lset(tv);
              const targets = []; for (let k = lo; k <= hi; k++) targets.push(tb.map.has(k) ? tb.map.get(k) : tb.def);
              // br_table inside the open blocks: each target is a (forward or backward) branch, so go through nested ifs of br
              lget(tv); i32c(lo); e(0x6b);
              const depthOf = (tg) => brDepth(tg, D.at.get(tg) <= idx);
              e(0x0e, uleb(targets.length), targets.map(tg => uleb(depthOf(tg))).flat(), uleb(depthOf(tb.def)));
            } else { const tv = tmp('i32'); lset(tv); for (const [k, tg] of tb.map) { lget(tv); i32c(k); e(0x46, 0x04, 0x40); jump(tg, I, true); e(0x0b); } jump(tb.def, I); }
            live = false; break;
          }
          case OP.CALL: {
            const callee = r.callee; r.args.forEach((a, i) => sget(d - r.args.length + i, a, r, 'g' + i)); call(fnIndex.get(callee.id)); sset(d - r.args.length, r.res); break;
          }
          case OP.CALLB: {
            const si = siteImp.get(r); r.args.forEach((a, i) => sget(d - r.args.length + i, a));
            if (needFrame) lget(lfp); else i32c(0); e(0x23, uleb(0)); call(importIdx.get('cb' + r.site)); sset(d - r.args.length, r.res); break;
          }
          case OP.RET: {
            if (needFrame) { if (redz.length) { lget(lfp); i32c(POFF); e(0x6a); i32c(0); i32c(fs); e(0xfc, 0x0b, 0x00); } lget(losp); e(0x24, uleb(0)); }
            sget(d - 1, r.a, r, 'r'); e(0x0f); live = false; break;
          }
          case OP.HALT: sget(d - 1, r.a, r, 'r'); e(0x0f); live = false; break;
          case OP.MEMCPY: { const n_ = code[o]; if (n_ > 0) { sget(d - 2, r.b); sget(d - 1, r.a); i32c(n_); ctx(I); call(impMC); } break; }
          case OP.MEMZERO: { const n_ = code[o]; if (n_ > 0) { sget(d - 1, r.a); i32c(n_); ctx(I); call(impMZ); } break; }
          case OP.ALLOCA: { sget(d - 1, r.a); i32c(code[o]); e(0x23, uleb(0)); ctx(I); call(impAL); e(0x24, uleb(0)); e(0x23, uleb(0)); sset(d - 1, r.res); break; }
          case OP.ADDLC: {
            const off = code[o], dd = code[o + 1];
            if (promoted.has(off)) { lget(pvar(off)); i32c(dd); e(0x6a); lset(pvar(off)); }
            else { lget(lfp); lget(lfp); loadAt(4, off); i32c(dd); e(0x6a); storeAt(4, off); }
            break;
          }
          case OP.JCLL: case OP.JCLC: {
            const kind = code[o], rd = (off) => { if (promoted.has(off)) lget(pvar(off)); else { lget(lfp); loadAt(4, off); } };
            rd(code[o + 1]); if (op === OP.JCLL) rd(code[o + 2]); else i32c(code[o + 2]);
            // jump when the comparison is false
            const tab = [0x46, 0x47, 0x48, 0x4a, 0x4c, 0x4e]; e(tab[kind], 0x45, 0x04, 0x40); jump(code[o + 3], I, true); e(0x0b); break;
          }
          case OP.JCMP: {
            const kind = code[o]; sget(d - 2, r.a, r, 'a'); sget(d - 1, r.b, r, 'b'); cmpEmit(kind, r.cmpv === undefined ? r.a : r.cmpv); e(0x45, 0x04, 0x40); jump(code[o + 1], I, true); e(0x0b); break;
          }
          default: un('op ' + CC.OPNAMES[op]);
        }
      }
      if (plan) while (openStack.length) { openStack.pop(); e(0x0b); }
      e(0x00);                                 // control cannot reach the end of a function
      const hdr = locals.map(t => [...uleb(1), VT[t]]);
      const body = [...vec(hdr), ...b, 0x0b];
      funcBodies.push([...uleb(body.length), ...body]);
    }
    // ---- module ----
    const impBytes = [];
    for (const m of imports) impBytes.push([...str('e'), ...str(m.name), 0x00, ...uleb(typeOf(m.params, m.results))]);
    impBytes.push([...str('e'), ...str('mem'), 0x02, 0x00, ...uleb(1)]);
    impBytes.push([...str('e'), ...str('SP'), 0x03, VT.i32, 0x01]);
    impBytes.push([...str('e'), ...str('B'), 0x03, VT.i32, 0x01]);
    // global index space: SP = 0, B = 1 (imported globals come first)
    const startIdx = fnIndex.get(-1);
    const mod = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
      ...section(1, vec(types)), ...section(2, vec(impBytes)), ...section(3, vec(funcTypes.map(t => uleb(t)))),
      ...section(7, vec([[...str('start'), 0x00, ...uleb(startIdx)]])), ...section(10, vec(funcBodies))];
    return { bytes: new Uint8Array(mod), imports, fnIndex };
  }

  // ---------------- instantiate against a VM ----------------
  function instantiate(vm, built, P, hooks) {
    const { ExitSignal } = H;
    const Turbo = CC.Turbo;
    const SP = new WebAssembly.Global({ value: 'i32', mutable: true }, vm.stackTop), B = new WebAssembly.Global({ value: 'i32', mutable: true }, 20000);
    const ctxSet = (pc, fn, fp) => { vm.pc = pc; vm.curFn = fn; vm.fp = fp; };
    const BI = vm.builtins, I64 = (x) => BigInt.asIntN(64, typeof x === 'bigint' ? x : BigInt(Math.trunc(Number(x)) || 0));
    const env = {
      tk() { B.value = 20000; hooks.tick(); },
      rd(a, n, pc, fn, fp) { ctxSet(pc, fn, fp); vm.chk(a >>> 0, n, false); },
      wr(a, n, pc, fn, fp) { ctxSet(pc, fn, fp); vm.chk(a >>> 0, n, true); },
      dz(pc, fn, fp) { ctxSet(pc, fn, fp); vm.fail('sigfpe', 'Floating point exception: integer division by zero'); },
      sov(fn) { vm.curFn = fn; vm.fail('stack-overflow', 'Stack overflow: the program used too much stack (infinite recursion or a huge local array?)'); },
      mc(d, s, n, pc, fn, fp) { ctxSet(pc, fn, fp); vm.chkRange(s >>> 0, n, false); vm.chkRange(d >>> 0, n, true); vm.u8.copyWithin(d >>> 0, s >>> 0, (s >>> 0) + n); },
      mz(a, n, pc, fn, fp) { ctxSet(pc, fn, fp); vm.chkRange(a >>> 0, n, true); vm.u8.fill(0, a >>> 0, (a >>> 0) + n); },
      al(a, unit, sp, pc, fn, fp) {
        ctxSet(pc, fn, fp); let n = Number(a) * unit;
        if (!(n >= 0) || n > vm.stackBytes) vm.fail('stack-overflow', 'Stack overflow: variable-length array is too large (' + n + ' bytes)');
        n = (n + 15) & ~15; sp -= n; if (sp < vm.stackLimit) vm.fail('stack-overflow', 'Stack overflow: variable-length array is too large');
        vm.u8.fill(0xCC, sp, sp + n); return sp;
      }
    };
    for (const m of built.imports) {
      if (env[m.name]) continue;
      if (m.name.startsWith('cb')) {
        const { bi, argCl, rc, rt, pc, fn } = m.js;
        env[m.name] = (...xs) => {
          const sp = xs.pop() >>> 0, fp = xs.pop();
          const args = xs.map((x, i) => { const c = argCl[i]; return c === 'U' ? x >>> 0 : c === 'L' ? H.nI(x) : c === 'UL' ? H.nU(BigInt.asUintN(64, x)) : x; });
          vm.pc = pc; vm.curFn = fn; vm.fp = fp; vm.sp = sp;
          let res; while ((res = BI[bi].fn(vm, args)) === H.WAIT) { if (hooks.needInput) throw new Turbo.TurboNeedInput(); vm.feedInput('', true); }
          if (res === undefined) res = 0;
          return rt === 'i32' ? (typeof res === 'bigint' ? Number(BigInt.asIntN(32, res)) : res | 0) : rt === 'i64' ? I64(res) : rt === 'f32' ? Math.fround(Number(res)) : Number(res);
        };
      } else if (m.name.startsWith('cv')) {
        const { ft } = m.js, to = m.js.to;
        env[m.name] = (x) => { const v = H.conv(x, ft); return TYOF[to] === 'i64' ? I64(v) : TYOF[to] === 'i32' ? (v | 0) : Number(v); };
      }
    }
    const inst = new WebAssembly.Instance(built.module, { e: { ...env, mem: vm.wmem, SP, B } });
    const mod = { FT: [], start: () => inst.exports.start(), resetSP() { SP.value = vm.stackTop; } };
    return mod;
  }

  // ---------------- public ----------------
  /** static check: returns an analysis object or throws Unsupported (no VM needed) */
  function analyze(prog) { return infer(prog, prepare(prog)); }
  const cache = new WeakMap();
  function build(vm, P, hooks) {
    if (!vm.wmem) un('VM has no WebAssembly memory');
    const key = vm.size + ':' + vm.stackLimit;
    let c = cache.get(P); if (!c || c.key !== key) { c = { key }; cache.set(P, c); }
    if (!c.built) {
      const built = emitProgram(P, vm, hooks);
      try { built.module = new WebAssembly.Module(built.bytes); } catch (e) { throw new Unsupported('invalid module: ' + e.message); }
      c.built = built;
    }
    return instantiate(vm, c.built, P, hooks);
  }
  CC.Wasm = { analyze, build, Unsupported };
})(typeof globalThis !== 'undefined' ? globalThis : self);
