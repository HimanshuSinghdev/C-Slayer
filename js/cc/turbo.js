/* C-Slayer · Turbo
 * Translates the stack bytecode into JavaScript source (one JS function per C function) so the browser's own
 * optimizing JIT can run it. It is the same machine, not a different one:
 *   - the same linear memory, poison map (red zones, freed blocks) and bounds checks, inlined at every access,
 *   - the same 64-bit integer representation (numbers when safe, BigInt beyond), the same builtins,
 *   - the generated code only ever contains numbers and names produced here; program text never reaches it.
 * Anything this translator does not understand makes it refuse (Turbo.build throws Unsupported) and the
 * ordinary VM runs the program instead, so Turbo can only ever be a speed-up, never a different answer.
 * Local scalars whose address is never taken live in JS variables instead of memory.
 */
(function (g) {
  'use strict';
  const CC = g.CC = g.CC || {};
  const OP = CC.OP, MEM = CC.MEM, ARGS = CC.OPARGS, H = CC.VMH;
  class Unsupported extends Error { }
  class TurboTimeout extends Error { }
  class TurboFallback extends Error { }
  class TurboNeedInput extends Error { }
  const un = (m) => { throw new Unsupported(m); };

  // builtins that may wait for interactive input: programs using them run on the VM unless stdin is preloaded
  const INPUT_BUILTINS = new Set(['scanf', 'fscanf', 'getchar', 'getc', 'fgetc', 'fgets', 'fread', 'getline', 'gets', 'getdelim', 'read', 'scanf_s', 'vscanf', 'vfscanf', 'fgetws', 'getwchar', 'sleep', 'usleep']);

  function usesInput(prog) {
    for (const b of prog.builtins) if (b && INPUT_BUILTINS.has(b.name)) return true;
    return false;
  }

  const ILEN = (op) => op === OP.JCLL ? 9 : op === OP.JCLC ? 8 : op === OP.ADDLC ? 9 : op === OP.JCMP ? 3 : 1 + ARGS[op];
  const KSIZE = [1, 1, 2, 2, 4, 4, 8, 8, 4, 8, 8];
  const CMPN = ['==', '!=', '<', '>', '<=', '>='];

  function lit(v) {
    if (typeof v === 'bigint') return v < 0n ? '(' + v + 'n)' : v + 'n';
    if (typeof v !== 'number') return null;
    if (v !== v) return 'NaN';
    if (v === Infinity) return 'Infinity';
    if (v === -Infinity) return '(-Infinity)';
    if (Object.is(v, -0)) return '(-0)';
    return v < 0 ? '(' + v + ')' : String(v);
  }

  // ---------- 64-bit helpers: identical to the VM's cases ----------
  function makeLF(vm) {
    const { nI, nU, big, wrapL, wrapUL, SAFE, I64_MIN } = H;
    const DZ = (pc, fn, fp) => { vm.pc = pc; vm.curFn = fn; vm.fp = fp; vm.fail('sigfpe', 'Floating point exception: integer division by zero'); };
    return {
      DZ,
      ADD_L(a, b) { if (typeof a === 'number' && typeof b === 'number') { const v = a + b; if (v <= SAFE && v >= -SAFE) return v; } return wrapL(big(a) + big(b)); },
      SUB_L(a, b) { if (typeof a === 'number' && typeof b === 'number') { const v = a - b; if (v <= SAFE && v >= -SAFE) return v; } return wrapL(big(a) - big(b)); },
      MUL_L(a, b) { if (typeof a === 'number' && typeof b === 'number') { const v = a * b; if (v <= SAFE && v >= -SAFE) return v + 0; } return wrapL(big(a) * big(b)); },
      DIV_L(a, b, pc, fn, fp) {
        if (typeof a === 'number' && typeof b === 'number') { if (b === 0) DZ(pc, fn, fp); return (a - a % b) / b + 0; }
        const bb = big(b), aa = big(a); if (bb === 0n || (bb === -1n && aa === I64_MIN)) DZ(pc, fn, fp); return nI(aa / bb);
      },
      MOD_L(a, b, pc, fn, fp) {
        if (typeof a === 'number' && typeof b === 'number') { if (b === 0) DZ(pc, fn, fp); return a % b + 0; }
        const bb = big(b), aa = big(a); if (bb === 0n || (bb === -1n && aa === I64_MIN)) DZ(pc, fn, fp); return nI(aa % bb);
      },
      AND_L(a, b) { return (typeof a === 'number' && typeof b === 'number' && (a | 0) === a && (b | 0) === b) ? a & b : nI(big(a) & big(b)); },
      OR_L(a, b) { return (typeof a === 'number' && typeof b === 'number' && (a | 0) === a && (b | 0) === b) ? a | b : nI(big(a) | big(b)); },
      XOR_L(a, b) { return (typeof a === 'number' && typeof b === 'number' && (a | 0) === a && (b | 0) === b) ? a ^ b : nI(big(a) ^ big(b)); },
      SHL_L(a, b) { const sh = Number(b) & 63; if (typeof a === 'number') { const v = a * Math.pow(2, sh); if (v <= SAFE && v >= -SAFE) return v; } return wrapL(big(a) << BigInt(sh)); },
      SHR_L(a, b) { const sh = Number(b) & 63; return typeof a === 'number' ? Math.floor(a / Math.pow(2, sh)) : nI(a >> BigInt(sh)); },
      ADD_UL(a, b) { if (typeof a === 'number' && typeof b === 'number') { const v = a + b; if (v <= SAFE) return v; } return wrapUL(big(a) + big(b)); },
      SUB_UL(a, b) { if (typeof a === 'number' && typeof b === 'number') { const v = a - b; if (v >= 0) return v; } return wrapUL(big(a) - big(b)); },
      MUL_UL(a, b) { if (typeof a === 'number' && typeof b === 'number') { const v = a * b; if (v <= SAFE) return v; } return wrapUL(big(a) * big(b)); },
      DIV_UL(a, b, pc, fn, fp) {
        if (typeof a === 'number' && typeof b === 'number') { if (b === 0) DZ(pc, fn, fp); return (a - a % b) / b; }
        const bb = big(b); if (bb === 0n) DZ(pc, fn, fp); return nU(big(a) / bb);
      },
      MOD_UL(a, b, pc, fn, fp) {
        if (typeof a === 'number' && typeof b === 'number') { if (b === 0) DZ(pc, fn, fp); return a % b; }
        const bb = big(b); if (bb === 0n) DZ(pc, fn, fp); return nU(big(a) % bb);
      },
      AND_UL(a, b) { return (typeof a === 'number' && typeof b === 'number' && a <= 0x7fffffff && b <= 0x7fffffff) ? a & b : nU(big(a) & big(b)); },
      OR_UL(a, b) { return (typeof a === 'number' && typeof b === 'number' && a <= 0x7fffffff && b <= 0x7fffffff) ? a | b : nU(big(a) | big(b)); },
      XOR_UL(a, b) { return (typeof a === 'number' && typeof b === 'number' && a <= 0x7fffffff && b <= 0x7fffffff) ? a ^ b : nU(big(a) ^ big(b)); },
      SHL_UL(a, b) { const sh = Number(b) & 63; if (typeof a === 'number') { const v = a * Math.pow(2, sh); if (v <= SAFE) return v; } return wrapUL(big(a) << BigInt(sh)); },
      SHR_UL(a, b) { const sh = Number(b) & 63; return typeof a === 'number' ? Math.floor(a / Math.pow(2, sh)) : nU(a >> BigInt(sh)); },
      NEG(c, a) { return c === 2 ? (typeof a === 'number' ? -a + 0 : wrapL(-a)) : (a == 0 ? 0 : wrapUL(-big(a))); },
      BNOT(c, a) { return c === 2 ? (typeof a === 'number' ? -a - 1 : nI(~a)) : wrapUL(~big(a)); }
    };
  }

  // ---------- decoding and analysis ----------
  function decode(code, start, end) {
    const ins = [], at = new Map();
    for (let pc = start; pc < end;) {
      const op = code[pc];
      if (ARGS[op] === undefined) un('unknown opcode ' + op);
      const len = ILEN(op);
      at.set(pc, ins.length); ins.push({ pc, op, len, o: pc + 1 });
      pc += len;
    }
    return { ins, at };
  }

  function switchTable(consts, k) {
    const t = consts[k];
    if (!t || !(t.map instanceof Map)) un('bad switch table');
    return t;
  }

  /** [needs, net] stack effect; targets = jump destinations; kind: 0 plain, 1 terminal (no fallthrough) */
  function effect(code, consts, I) {
    const op = I.op, o = I.o;
    const r = { need: 0, net: 0, term: false, targets: null };
    if (op >= OP.ADD_I && op <= OP.GE_F) { r.need = 2; r.net = -1; return r; }
    switch (op) {
      case OP.ICONST: case OP.KCONST: case OP.LEAL: case OP.LLOAD: r.net = 1; return r;
      case OP.POP: r.need = 1; r.net = -1; return r;
      case OP.DUP: r.need = 1; r.net = 1; return r;
      case OP.DUPX1: r.need = 2; r.net = 1; return r;
      case OP.SWAP: r.need = 2; return r;
      case OP.LSTORE: case OP.LOAD: r.need = 1; return r;
      case OP.LSTOREP: r.need = 1; r.net = -1; return r;
      case OP.STORE: r.need = 2; r.net = -1; return r;
      case OP.STOREP: r.need = 2; r.net = -2; return r;
      case OP.NEG: case OP.BNOT: case OP.LNOT: case OP.TOBOOL: case OP.CONV: case OP.NARROW: r.need = 1; return r;
      case OP.JMP: r.targets = [code[o]]; r.term = true; return r;
      case OP.JZ: case OP.JNZ: r.need = 1; r.net = -1; r.targets = [code[o]]; return r;
      case OP.SWITCH: { const t = switchTable(consts, code[o]); r.need = 1; r.net = -1; r.targets = [...t.map.values(), t.def]; r.term = true; return r; }
      case OP.CALL: r.need = code[o + 1]; r.net = 1 - code[o + 1]; return r;
      case OP.CALLB: r.need = code[o + 1]; r.net = 1 - code[o + 1]; return r;
      case OP.CALLI: r.need = code[o] + 1; r.net = -code[o]; return r;
      case OP.ENTER: case OP.LINE: return r;
      case OP.RET: r.need = 1; r.net = -1; r.term = true; return r;
      case OP.HALT: r.need = 1; r.net = -1; r.term = true; return r;
      case OP.MEMCPY: r.need = 2; r.net = -1; return r;
      case OP.MEMZERO: r.need = 1; r.net = -1; return r;
      case OP.ALLOCA: r.need = 1; return r;
      case OP.JCLL: case OP.JCLC: r.targets = [code[o + 3]]; return r;
      case OP.ADDLC: return r;
      case OP.JCMP: r.need = 2; r.net = -2; r.targets = [code[o + 1]]; return r;
      case OP.LOADBF: r.need = 1; return r;
      case OP.STOREBF: r.need = 2; r.net = code[o + 1] ? -1 : -2; return r;
    }
    un('no effect for op ' + op);
  }

  /** depth analysis: returns {nparams, depth[]} (absolute depths, -1 = unreachable) */
  function analyze(code, consts, D) {
    const { ins, at } = D, n = ins.length;
    const rel = new Array(n).fill(null), eff = ins.map(I => effect(code, consts, I));
    let min = 0;
    const work = [0]; rel[0] = 0;
    const setDepth = (idx, d) => {
      if (idx === undefined) un('jump into the middle of an instruction');
      if (rel[idx] === null) { rel[idx] = d; work.push(idx); } else if (rel[idx] !== d) un('inconsistent stack depth at join');
    };
    while (work.length) {
      let idx = work.pop();
      for (;;) {
        const d = rel[idx], e = eff[idx], I = ins[idx];
        if (d - e.need < min) min = d - e.need;
        const d2 = d + e.net;
        if (e.targets) for (const t of e.targets) setDepth(at.get(t), d2);
        if (e.term) break;
        if (idx + 1 >= n) break;
        if (rel[idx + 1] !== null) { if (rel[idx + 1] !== d2) un('inconsistent stack depth'); break; }
        rel[idx + 1] = d2; idx++;
      }
    }
    const nparams = -min;
    let maxd = nparams;
    const depth = rel.map(d => { if (d === null) return -1; if (d + nparams > maxd) maxd = d + nparams; return d + nparams; });
    return { nparams, depth, eff, maxd: maxd + 2 };
  }

  function localAccesses(code, ins, slots, redzones) {
    // which frame slots can live in JS variables?
    const find = (off) => { for (const s of slots) if (off >= s.off && off < s.off + s.size) return s; return null; };
    const info = new Map(), esc = new Set(), bad = new Set();
    let any = true;
    const acc = (off, k, I) => {
      const s = find(off); if (!s) { any = false; return; }
      let a = info.get(s); if (!a) info.set(s, a = new Set());
      a.add(off + ':' + k);
      if (off !== s.off || KSIZE[k] > s.size) bad.add(s);
    };
    for (const I of ins) {
      const o = I.o;
      switch (I.op) {
        case OP.LEAL: { const s = find(code[o]); if (!s) any = false; else esc.add(s); break; }
        case OP.LLOAD: case OP.LSTORE: case OP.LSTOREP: acc(code[o + 1], code[o], I); break;
        case OP.JCLL: acc(code[o + 1], 4, I); acc(code[o + 2], 4, I); break;
        case OP.JCLC: acc(code[o + 1], 4, I); break;
        case OP.ADDLC: acc(code[o], 4, I); break;
      }
    }
    const promoted = new Map();
    if (any) for (const [s, a] of info) if (!esc.has(s) && !bad.has(s) && a.size === 1) { const k = +[...a][0].split(':')[1]; promoted.set(s.off, k); }
    return promoted;
  }

  /** value of a 0xCC-filled slot of each kind: what an uninitialised local reads as */
  function garbage(k) {
    const b = new ArrayBuffer(8), u = new Uint8Array(b), dv = new DataView(b); u.fill(0xCC);
    switch (k) {
      case 0: return dv.getInt8(0); case 1: return u[0]; case 2: return dv.getInt16(0, true); case 3: return dv.getUint16(0, true);
      case 4: return dv.getInt32(0, true); case 5: return dv.getUint32(0, true);
      case 6: return H.ld64(dv, 0, true); case 7: return H.ld64(dv, 0, false);
      case 8: return dv.getFloat32(0, true); case 9: return dv.getFloat64(0, true);
      default: return dv.getUint32(0, true);
    }
  }

  const NARROW = ['(%a << 24) >> 24', '%a & 255', '(%a << 16) >> 16', '%a & 65535'];
  const STORE_NORM = ['(%a << 24) >> 24', '%a & 255', '(%a << 16) >> 16', '%a & 65535', '%a | 0', '%a >>> 0', '%a', '%a', 'Math.fround(%a)', '%a', '%a >>> 0'];
  const ILOAD = [
    (a) => `dv.getInt8(${a})`, (a) => `u8[${a}]`, (a) => `dv.getInt16(${a}, true)`, (a) => `dv.getUint16(${a}, true)`,
    (a) => `dv.getInt32(${a}, true)`, (a) => `dv.getUint32(${a}, true)`, (a) => `ld64(dv, ${a}, true)`, (a) => `ld64(dv, ${a}, false)`,
    (a) => `dv.getFloat32(${a}, true)`, (a) => `dv.getFloat64(${a}, true)`, (a) => `dv.getUint32(${a}, true)`
  ];
  const ISTORE = [
    (a, v) => `u8[${a}] = ${v};`, (a, v) => `u8[${a}] = ${v};`, (a, v) => `dv.setInt16(${a}, ${v}, true);`, (a, v) => `dv.setInt16(${a}, ${v}, true);`,
    (a, v) => `dv.setInt32(${a}, ${v}, true);`, (a, v) => `dv.setInt32(${a}, ${v}, true);`, (a, v) => `st64(dv, ${a}, ${v});`, (a, v) => `st64(dv, ${a}, ${v});`,
    (a, v) => `dv.setFloat32(${a}, ${v}, true);`, (a, v) => `dv.setFloat64(${a}, ${v}, true);`, (a, v) => `dv.setUint32(${a}, ${v}, true); dv.setUint32(${a} + 4, 0, true);`
  ];

  const INLINE_BIN = {};
  (function () {
    const t = (n, f) => { INLINE_BIN[OP[n]] = f; };
    t('ADD_I', (a, b) => `(${a} + ${b}) | 0`); t('SUB_I', (a, b) => `(${a} - ${b}) | 0`); t('MUL_I', (a, b) => `Math.imul(${a}, ${b})`);
    t('AND_I', (a, b) => `${a} & ${b}`); t('OR_I', (a, b) => `${a} | ${b}`); t('XOR_I', (a, b) => `${a} ^ ${b}`);
    t('SHL_I', (a, b) => `${a} << ${b}`); t('SHR_I', (a, b) => `${a} >> ${b}`);
    t('ADD_U', (a, b) => `(${a} + ${b}) >>> 0`); t('SUB_U', (a, b) => `(${a} - ${b}) >>> 0`); t('MUL_U', (a, b) => `Math.imul(${a}, ${b}) >>> 0`);
    t('AND_U', (a, b) => `(${a} & ${b}) >>> 0`); t('OR_U', (a, b) => `(${a} | ${b}) >>> 0`); t('XOR_U', (a, b) => `(${a} ^ ${b}) >>> 0`);
    t('SHL_U', (a, b) => `(${a} << ${b}) >>> 0`); t('SHR_U', (a, b) => `${a} >>> ${b}`);
    t('ADD_F', (a, b) => `Math.fround(${a} + ${b})`); t('SUB_F', (a, b) => `Math.fround(${a} - ${b})`);
    t('MUL_F', (a, b) => `Math.fround(${a} * ${b})`); t('DIV_F', (a, b) => `Math.fround(${a} / ${b})`);
    t('ADD_D', (a, b) => `${a} + ${b}`); t('SUB_D', (a, b) => `${a} - ${b}`); t('MUL_D', (a, b) => `${a} * ${b}`); t('DIV_D', (a, b) => `${a} / ${b}`);
    const cmp = (nm, sym) => { for (const c of ['I', 'U', 'F']) t(nm + '_' + c, (a, b) => `${a} ${sym}= ${b} ? 1 : 0`.replace(/([=!<>]+)= /, '$1 ')); };
    // comparisons are written out below to keep operators exact
    const C3 = { EQ: '===', NE: '!==', LT: '<', GT: '>', LE: '<=', GE: '>=' };
    for (const nm of Object.keys(C3)) {
      for (const c of ['I', 'U', 'F']) t(nm + '_' + c, (a, b) => `${a} ${C3[nm]} ${b} ? 1 : 0`);
      t(nm + '_L', (a, b) => `${a} ${nm === 'EQ' ? '==' : nm === 'NE' ? '!=' : C3[nm]} ${b} ? 1 : 0`);
    }
  })();
  const LBIN = new Map();
  for (const nm of ['ADD', 'SUB', 'MUL', 'AND', 'OR', 'XOR', 'SHL', 'SHR']) for (const c of ['L', 'UL']) LBIN.set(OP[nm + '_' + c], nm + '_' + c);
  const LDIV = new Map();
  for (const nm of ['DIV', 'MOD']) for (const c of ['L', 'UL']) LDIV.set(OP[nm + '_' + c], nm + '_' + c);

  function isSimple(x) { return /^[A-Za-z_$][\w$]*$/.test(x) || /^\(?-?[\d.eE+-]+n?\)?$/.test(x) || x === 'NaN' || x === 'Infinity' || x === '(-Infinity)' || x === '(-0)'; }

  /** Rebuild structured control flow from the jumps: forward jumps become `break` out of labelled blocks, backward jumps
   *  become `continue` of labelled loops. Returns null when the jumps do not nest (the caller then uses a dispatch loop). */
  function planStructure(ins, A, D, code) {
    const blocks = new Map(), loops = new Map();
    for (let i = 0; i < ins.length; i++) {
      if (A.depth[i] < 0) continue;
      const tg = A.eff[i].targets; if (!tg) continue;
      for (const t of tg) {
        const j = D.at.get(t); if (j === undefined) return null;
        if (j > i) { let b = blocks.get(j); if (!b) blocks.set(j, b = { kind: 'B', s: i, e: j, lab: j }); b.s = Math.min(b.s, i); }
        else { let l = loops.get(j); if (!l) loops.set(j, l = { kind: 'L', s: j, e: i + 1, lab: j }); l.e = Math.max(l.e, i + 1); }
      }
    }
    const items = [...blocks.values(), ...loops.values()];
    for (let iter = 0, changed = true; changed; iter++) {
      if (iter > 60) return null;
      changed = false;
      for (const I of items) for (const J of items) {
        if (I === J || !(I.s < J.s && J.s < I.e && I.e < J.e)) continue;
        if (J.kind === 'B') { J.s = I.s; changed = true; }
        else if (I.kind === 'L') { I.e = J.e; changed = true; }
        else return null;
      }
    }
    items.sort((a, b) => a.s - b.s || b.e - a.e || (a.kind === 'B' ? -1 : 1));
    return { items, targets: new Set([...blocks.keys(), ...loops.keys()]) };
  }

  // ---------- code generation for one function ----------
  function genFunction(ctx, fi, name, start, end, rec, info) {
    const { code, consts, vm, used } = ctx;
    const D = info.D, A = info.A, n = A.nparams, ins = D.ins;
    const promoted = rec ? localAccesses(code, ins, rec.slots || [], rec.redzones || []) : new Map();
    const FN = fi, fs = rec ? rec.frameSize : 0;
    const redz = rec ? (rec.redzones || []) : [];
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
    const FP = needFrame ? 'fp' : '0';
    const LO = MEM.LOW, MS = vm.size, ROE = MEM.RO_BASE + MEM.RO_SIZE;
    const out = [];
    const params = []; for (let i = 0; i < n; i++) params.push('s' + i);
    out.push(`function ${name}(${params.join(', ')}) {`);
    out.push('  if (--B < 0) TK();');
    if (A.maxd > n) { const sv = []; for (let p = n; p < A.maxd; p++) sv.push('s' + p); out.push('  let ' + sv.join(', ') + ';'); }
    if (promoted.size) { const decl = []; for (const [off, k] of promoted) { decl.push(`v${off} = ${lit(garbage(k))}`); } out.push('  let ' + decl.join(', ') + ';'); }
    if (needFrame) {
      out.push(`  const osp = SP, fp = osp - ${fs};`);
      out.push(`  if (fp < SL) SOV(${FN});`);
      out.push(`  SP = fp; u8.fill(0xCC, fp, fp + ${fs});`);
      for (const r of redz) out.push(`  P.fill(3, fp + ${r.off}, fp + ${r.off + r.len});`);
    }
    // leaders
    const labels = new Set([0]);
    for (let i = 0; i < ins.length; i++) {
      if (A.depth[i] < 0) continue;
      const e = A.eff[i];
      if (e.targets) for (const t of e.targets) labels.add(D.at.get(t));
    }
    const plan = labels.size > 1 ? planStructure(ins, A, D, code) : null;
    const multi = labels.size > 1 && !plan;
    let curIdx = 0, nextItem = 0; const openStack = [];
    let tmp = 0;
    const T = () => 't' + (tmp++);
    let st = [], body = [], live = true;
    const emit = (s) => body.push(s);
    const enterBlock = (idx) => { st = []; for (let p = 0; p < A.depth[idx]; p++) st.push('s' + p); };
    const spill = () => {
      // make the stack canonical (entry p lives in variable s<p>) before a jump or label
      let need = false;
      for (let p = 0; p < st.length; p++) if (st[p] !== 's' + p) need = true;
      if (!need) return;
      const tmps = [];
      for (let p = 0; p < st.length; p++) if (st[p] !== 's' + p) { const c = T(); emit(`const ${c} = ${st[p]};`); tmps[p] = c; }
      for (let p = 0; p < st.length; p++) if (tmps[p] !== undefined) { emit(`s${p} = ${tmps[p]};`); st[p] = 's' + p; }
    };
    const push = (expr) => { if (isSimple(expr)) { st.push(expr); } else { const t = T(); emit(`const ${t} = ${expr};`); st.push(t); } };
    const pushT = (expr) => { const t = T(); emit(`const ${t} = ${expr};`); st.push(t); };
    let curLabel = -1, looped = false;
    const jump = (target, back) => {
      const tk = back ? 'if (--B < 0) TK(); ' : '';
      if (plan) { const ti = D.at.get(target); return ti <= curIdx ? `${tk}continue L${ti};` : `break B${ti};`; }
      if (target === curLabel) { looped = true; return `${tk}continue LB${target};`; }
      return `${tk}pc = ${target}; continue D;`;
    };
    const closeBlock = (blockStart) => { if (!plan && looped && blockStart >= 0) { body.splice(blockStart, 0, `LB${curLabel}: for (;;) {`); body.push('break; }'); } looped = false; };
    let blockStart = -1;
    const isBack = (I, t) => t <= I.pc;
    const needD = multi;
    const uses = (nm) => { used.add(nm); return nm; };
    const PE = (I) => I.pc + I.len;
    const ctxArgs = (I) => `${PE(I)}, ${FN}, ${FP}`;
    const rdChk = (a, N, I) => `if (${a} < ${LO} || ${a} + ${N} > ${MS} || (P[${a}] | P[${a} + ${N - 1}])) RD(${a}, ${N}, ${ctxArgs(I)});`;
    const wrChk = (a, N, I) => `if (${a} < ${ROE} || ${a} + ${N} > ${MS} || (P[${a}] | P[${a} + ${N - 1}])) WR(${a}, ${N}, ${ctxArgs(I)});`;
    const lvar = (off) => 'v' + off;
    const lmem = (off) => `(fp + ${off})`;
    const uncond = new Set();

    if (plan) enterBlock(0);
    for (let idx = 0; idx < ins.length; idx++) {
      const I = ins[idx], op = I.op, o = I.o;
      const reach = A.depth[idx] >= 0;
      curIdx = idx;
      if (plan) {
        const isT = plan.targets.has(idx);
        if (isT && live && reach) spill();
        let moved = false;
        while (openStack.length && openStack[openStack.length - 1].e <= idx) { const it = openStack.pop(); emit(it.kind === 'L' ? 'break; }' : '}'); moved = true; }
        while (nextItem < plan.items.length && plan.items[nextItem].s === idx) { const it = plan.items[nextItem++]; openStack.push(it); emit(it.kind === 'L' ? `L${it.lab}: for (;;) {` : `B${it.lab}: {`); moved = true; }
        if (isT && reach) { live = true; enterBlock(idx); }
        else if (!reach || !live) continue;
      } else
      if (labels.has(idx)) {
        if (live) spill();
        if (body.length || idx > 0) { /* close previous block */ }
        closeBlock(blockStart); emit(`}`); emit(`case ${I.pc}: {`); curLabel = I.pc; blockStart = body.length;
        live = reach; if (reach) enterBlock(idx);
      } else if (!reach) { continue; } else if (!live) { continue; }
      if (!reach) continue;
      switch (op) {
        case OP.ENTER: case OP.LINE: break;
        case OP.ICONST: push(lit(code[o])); break;
        case OP.KCONST: { const v = consts[code[o]]; const l = lit(v); if (l !== null) push(l); else pushT(`K[${code[o]}]`); break; }
        case OP.POP: st.pop(); break;
        case OP.DUP: st.push(st[st.length - 1]); break;
        case OP.DUPX1: { const a = st[st.length - 1], b = st[st.length - 2]; st[st.length - 2] = a; st[st.length - 1] = b; st.push(a); break; }
        case OP.SWAP: { const k = st.length; const a = st[k - 1]; st[k - 1] = st[k - 2]; st[k - 2] = a; break; }
        case OP.LEAL: pushT(`fp + ${code[o]}`); break;
        case OP.LLOAD: {
          const k = code[o], off = code[o + 1];
          if (promoted.has(off)) pushT(lvar(off)); else pushT(ILOAD[k](lmem(off)));
          break;
        }
        case OP.LSTORE: case OP.LSTOREP: {
          const k = code[o], off = code[o + 1], v = st.pop();
          if (promoted.has(off)) emit(`${lvar(off)} = ${STORE_NORM[k].replace(/%a/g, v)};`);
          else emit(ISTORE[k](lmem(off), v));
          if (op === OP.LSTORE) st.push(v);
          break;
        }
        case OP.LOAD: {
          const k = code[o], a = st.pop();
          emit(rdChk(a, KSIZE[k], I)); pushT(ILOAD[k](a));
          break;
        }
        case OP.STORE: case OP.STOREP: {
          const k = code[o], v = st.pop(), a = st.pop();
          emit(wrChk(a, KSIZE[k], I)); emit(ISTORE[k](a, v));
          if (op === OP.STORE) st.push(v);
          break;
        }
        case OP.NEG: {
          const c = code[o], a = st.pop();
          if (c === 0) push(`(-${a}) | 0`); else if (c === 1) push(`(-${a}) >>> 0`);
          else if (c === 4) push(`Math.fround(-${a})`); else if (c >= 5) push(`-${a}`);
          else push(`${uses('NEGL')}(${c}, ${a})`);
          break;
        }
        case OP.BNOT: {
          const c = code[o], a = st.pop();
          if (c === 0) push(`~${a}`); else if (c === 1) push(`(~${a}) >>> 0`); else push(`${uses('BNOTL')}(${c}, ${a})`);
          break;
        }
        case OP.LNOT: { const a = st.pop(); push(`${a} == 0 ? 1 : 0`); break; }
        case OP.TOBOOL: { const a = st.pop(); push(`${a} != 0 ? 1 : 0`); break; }
        case OP.NARROW: { const a = st.pop(); push(NARROW[code[o]].replace(/%a/g, a)); break; }
        case OP.CONV: {
          const ft = code[o], from = ft >> 3, to = ft & 7, a = st.pop();
          if (to === 5 && from <= 1) push(a);
          else if (to === 5 && from >= 4) push(a);
          else if (to === 2 && from <= 1) push(a);
          else if (to === 4 && from <= 1) push(`Math.fround(${a})`);
          else if (to === 4 && from >= 4) push(`Math.fround(${a})`);
          else if (to === 0 && from === 1) push(`${a} | 0`);
          else if (to === 1 && from === 0) push(`${a} >>> 0`);
          else if (to === 0 && from >= 4) push(`f2i(${a})`);
          else if (to === 0 && (from === 2 || from === 3)) push(`typeof ${a} === 'number' ? ${a} | 0 : conv(${a}, ${ft})`);
          else if (to === 1 && (from === 2 || from === 3)) push(`typeof ${a} === 'number' ? ${a} >>> 0 : conv(${a}, ${ft})`);
          else if (to === from) push(a);
          else push(`conv(${a}, ${ft})`);
          break;
        }
        case OP.JMP: { const t = code[o]; spill(); emit(jump(t, isBack(I, t))); live = false; break; }
        case OP.JZ: case OP.JNZ: {
          const t = code[o], c = st.pop(); spill();
          emit(`if (${c} ${op === OP.JZ ? '===' : '!=='} 0) { ${jump(t, isBack(I, t))} }`);
          break;
        }
        case OP.SWITCH: {
          const tb = switchTable(consts, code[o]), v = st.pop(); spill();
          const vv = T(); emit(`let ${vv} = ${v}; if (typeof ${vv} === 'bigint') ${vv} = nI(${vv});`);
          const byT = new Map();
          for (const [key, tg] of tb.map) { if (typeof key !== 'number') un('switch key'); if (!byT.has(tg)) byT.set(tg, []); byT.get(tg).push(key); }
          emit(`switch (${vv}) {`);
          for (const [tg, keys] of byT) emit(keys.map(k => `case ${lit(k)}:`).join(' ') + ' ' + jump(tg, tg <= I.pc));
          emit(`default: ${jump(tb.def, tb.def <= I.pc)} }`);
          live = false; break;
        }
        case OP.CALL: {
          const callee = code[o], argc = code[o + 1];
          const tgt = ctx.info.get(callee);
          if (!tgt || tgt.A.nparams !== argc) un('call arity mismatch');
          const args = st.splice(st.length - argc, argc);
          pushT(`f${callee}(${args.join(', ')})`);
          break;
        }
        case OP.CALLI: {
          const argc = code[o], fa = st.pop(), args = st.splice(st.length - argc, argc);
          const f = T(); emit(`const ${f} = CI(${fa}, ${ctxArgs(I)});`);
          pushT(`${f}(${args.join(', ')})`);
          break;
        }
        case OP.CALLB: {
          const bi = code[o], argc = code[o + 1], args = st.splice(st.length - argc, argc);
          pushT(`CB(${bi}, [${args.join(', ')}], ${ctxArgs(I)}, SP)`);
          break;
        }
        case OP.RET: {
          const v = st.pop();
          if (st.length) un('RET with a dirty stack');
          if (needFrame) { if (redz.length) emit(`P.fill(0, fp, fp + ${fs});`); emit(`SP = osp;`); }
          emit(`return ${v};`); live = false; break;
        }
        case OP.HALT: { const v = st.pop(); emit(`return ${v};`); live = false; break; }
        case OP.MEMCPY: { const n_ = code[o], src = st.pop(), dst = st[st.length - 1]; if (n_ > 0) emit(`MC(${dst}, ${src}, ${n_}, ${ctxArgs(I)});`); break; }
        case OP.MEMZERO: { const n_ = code[o], a = st.pop(); if (n_ > 0) emit(`MZ(${a}, ${n_}, ${ctxArgs(I)});`); break; }
        case OP.ALLOCA: { const unit = code[o], a = st.pop(); emit(`SP = AL(${a}, ${unit}, SP, ${ctxArgs(I)});`); pushT('SP'); break; }
        case OP.LOADBF: { const a = st.pop(); pushT(`BL(${a}, ${code[o]}, ${ctxArgs(I)})`); break; }
        case OP.STOREBF: { const v = st.pop(), a = st.pop(); const t = T(); emit(`const ${t} = BS(${a}, ${v}, ${code[o]}, ${ctxArgs(I)});`); if (code[o + 1]) st.push(t); break; }
        case OP.JCLL: case OP.JCLC: case OP.ADDLC: {
          const rd = (off) => promoted.has(off) ? lvar(off) : `dv.getInt32(${lmem(off)}, true)`;
          if (op === OP.ADDLC) {
            const off = code[o], d = code[o + 1];
            if (promoted.has(off)) emit(`${lvar(off)} = (${lvar(off)} + ${d}) | 0;`); else emit(`dv.setInt32(${lmem(off)}, (dv.getInt32(${lmem(off)}, true) + ${d}) | 0, true);`);
            break;
          }
          const kind = code[o], x = rd(code[o + 1]), y = op === OP.JCLL ? rd(code[o + 2]) : lit(code[o + 2]), t = code[o + 3];
          spill();
          emit(`if (!(${x} ${CMPN[kind]} ${y})) { ${jump(t, isBack(I, t))} }`);
          break;
        }
        case OP.JCMP: {
          const kind = code[o], t = code[o + 1], b = st.pop(), a = st.pop(); spill();
          const sym = kind === 0 ? '==' : kind === 1 ? '!=' : CMPN[kind];
          emit(`if (!(${a} ${sym} ${b})) { ${jump(t, isBack(I, t))} }`);
          break;
        }
        default: {
          if (INLINE_BIN[op]) {
            const b = st.pop(), a = st.pop();
            if (op === OP.DIV_I || op === OP.MOD_I || op === OP.DIV_U || op === OP.MOD_U) un('unreachable');
            push(INLINE_BIN[op](a, b));
          } else if (op === OP.DIV_I || op === OP.MOD_I) {
            const b = st.pop(), a = st.pop();
            emit(`if (${b} === 0 || (${b} === -1 && ${a} === -2147483648)) DZ(${ctxArgs(I)});`);
            pushT(`(${a} ${op === OP.DIV_I ? '/' : '%'} ${b}) | 0`);
          } else if (op === OP.DIV_U || op === OP.MOD_U) {
            const b = st.pop(), a = st.pop();
            emit(`if (${b} === 0) DZ(${ctxArgs(I)});`);
            pushT(op === OP.DIV_U ? `Math.floor(${a} / ${b}) >>> 0` : `(${a} % ${b}) >>> 0`);
          } else if (LBIN.has(op)) {
            const b = st.pop(), a = st.pop(); pushT(`${uses(LBIN.get(op))}(${a}, ${b})`);
          } else if (LDIV.has(op)) {
            const b = st.pop(), a = st.pop(); pushT(`${uses(LDIV.get(op))}(${a}, ${b}, ${ctxArgs(I)})`);
          } else un('op ' + op + ' not supported');
        }
      }
    }
    if (plan) while (openStack.length) { const it = openStack.pop(); emit(it.kind === 'L' ? 'break; }' : '}'); }
    if (live) emit('throw new Error("control reached the end of a function");');
    closeBlock(blockStart);
    // assemble: first "}" in body belongs to the (empty) block opened before case 0, so open it properly
    const text = [];
    if (multi) {
      text.push('  let pc = ' + ins[0].pc + ';');
      text.push('  D: for (;;) { switch (pc) { case ' + ins[0].pc + ': {');
      // body starts with the synthetic "}" "case X: {" for label 0; drop it
      const b = body.slice(); b.splice(0, 2);
      for (const l of b) text.push('    ' + l);
      text.push('  } default: throw new Error("bad pc"); } }');
    } else {
      const b = body.slice(); if (!plan) b.splice(0, 2);
      for (const l of b) text.push('    ' + l);
    }
    // unlabelled-single-block: body begins inside no case, so strip the closing "}" the final label would add
    return out.join('\n') + '\n' + text.join('\n') + '\n}';
  }

  /** Build the translated program for a VM. Throws Unsupported if anything is outside what Turbo understands. */
  function build(vm, hooks) {
    const prog = vm.prog, code = prog.code, consts = prog.consts, funcs = prog.funcs;
    // function extents
    const entries = [];
    funcs.forEach((f, i) => { if (f && typeof f.entry === 'number') entries.push({ i, pc: f.entry }); });
    entries.sort((a, b) => a.pc - b.pc);
    for (let k = 1; k < entries.length; k++) if (entries[k].pc === entries[k - 1].pc) un('shared entry');
    const info = new Map();
    for (let k = 0; k < entries.length; k++) {
      const end = k + 1 < entries.length ? entries[k + 1].pc : prog.startPc;
      const D = decode(code, entries[k].pc, end);
      info.set(entries[k].i, { D, A: analyze(code, consts, D), start: entries[k].pc, end });
    }
    const stubEnd = prog.haltPc + 1;
    const SD = decode(code, prog.startPc, stubEnd);
    const stubInfo = { D: SD, A: analyze(code, consts, SD) };
    if (stubInfo.A.nparams !== 0) un('stub params');
    const ctx = { code, consts, vm, info, used: new Set() };
    const parts = [];
    for (const e of entries) {
      const inf = info.get(e.i);
      parts.push(genFunction(ctx, e.i, 'f' + e.i, inf.start, inf.end, funcs[e.i], inf));
    }
    parts.push(genFunction(ctx, -1, 'fstart', prog.startPc, stubEnd, null, stubInfo));

    const LF = makeLF(vm);
    const sizeStack = vm.stackLimit;
    const header = [
      '"use strict";',
      'const { vm, dv, u8, P, K, conv, ld64, st64, nI, f2i, LF, TKH, RDH, WRH } = R;',
      `let SP = ${vm.stackTop}, B = 20000;`,
      `const SL = ${sizeStack};`,
      'const TK = () => { B = 20000; TKH(); };',
      'const RD = (a, n, pc, fn, fp) => { vm.pc = pc; vm.curFn = fn; vm.fp = fp; vm.chk(a, n, false); };',
      'const WR = (a, n, pc, fn, fp) => { vm.pc = pc; vm.curFn = fn; vm.fp = fp; vm.chk(a, n, true); };',
      'const DZ = (pc, fn, fp) => LF.DZ(pc, fn, fp);',
      'const SOV = (fn) => { vm.curFn = fn; vm.fail("stack-overflow", "Stack overflow: the program used too much stack (infinite recursion or a huge local array?)"); };',
      'const MC = (d, s, n, pc, fn, fp) => { vm.pc = pc; vm.curFn = fn; vm.fp = fp; vm.chkRange(s, n, false); vm.chkRange(d, n, true); u8.copyWithin(d, s, s + n); };',
      'const MZ = (a, n, pc, fn, fp) => { vm.pc = pc; vm.curFn = fn; vm.fp = fp; vm.chkRange(a, n, true); u8.fill(0, a, a + n); };',
      'const BL = (a, pk, pc, fn, fp) => { vm.pc = pc; vm.curFn = fn; vm.fp = fp; return vm.bfLoad(a, pk); };',
      'const BS = (a, v, pk, pc, fn, fp) => { vm.pc = pc; vm.curFn = fn; vm.fp = fp; return vm.bfStore(a, v, pk); };',
      'const AL = (a, unit, sp, pc, fn, fp) => { vm.pc = pc; vm.curFn = fn; vm.fp = fp; let n = typeof a === "bigint" ? Number(a) : a; n = n * unit;',
      `  if (!(n >= 0) || n > ${vm.stackBytes}) vm.fail("stack-overflow", "Stack overflow: variable-length array is too large (" + n + " bytes)");`,
      '  n = (n + 15) & ~15; sp -= n; if (sp < SL) vm.fail("stack-overflow", "Stack overflow: variable-length array is too large");',
      '  u8.fill(0xCC, sp, sp + n); return sp; };',
      `const FT = new Array(${funcs.length});`,
      `const CI = (a, pc, fn, fp) => { const fi = ((a - ${MEM.FUNC_BASE}) / ${MEM.FUNC_STRIDE}) | 0; const f = FT[fi];`,
      `  if (a < ${MEM.FUNC_BASE} || (a - ${MEM.FUNC_BASE}) % ${MEM.FUNC_STRIDE} !== 0 || !f) { vm.pc = pc; vm.curFn = fn; vm.fp = fp; vm.fail("segv", "Segmentation fault: calling through an invalid function pointer (" + (a === 0 ? "NULL" : "0x" + (a >>> 0).toString(16)) + ")"); }`,
      '  return f; };',
      'const BI = vm.builtins;',
      'const CB = (bi, args, pc, fn, fp, sp) => { vm.pc = pc; vm.curFn = fn; vm.fp = fp; vm.sp = sp; let r; while ((r = BI[bi].fn(vm, args)) === R.WAIT) { if (R.NEEDIN) throw new R.NeedInput(); vm.feedInput("", true); } return r === undefined ? 0 : r; };',
    ];
    for (const nm of ctx.used) {
      if (nm === 'NEGL') header.push('const NEGL = LF.NEG;'); else if (nm === 'BNOTL') header.push('const BNOTL = LF.BNOT;'); else header.push(`const ${nm} = LF.${nm};`);
    }
    const footer = [];
    for (const e of entries) footer.push(`FT[${e.i}] = f${e.i};`);
    footer.push('return { FT, start: fstart, resetSP() { SP = ' + vm.stackTop + '; } };');
    const src = header.join('\n') + '\n' + parts.join('\n') + '\n' + footer.join('\n');
    const R = { vm, dv: vm.dv, u8: vm.u8, P: vm.poison, K: consts, conv: H.conv, ld64: H.ld64, st64: H.st64, nI: H.nI, f2i: H.f2i, LF, WAIT: H.WAIT, TKH: hooks.tick, NEEDIN: !!hooks.needInput, NeedInput: TurboNeedInput };
    let mod;
    try { mod = new Function('R', src)(R); }
    catch (e) { if (e instanceof Unsupported) throw e; throw new Unsupported('generated code rejected: ' + e.message); }
    mod.src = src;
    return mod;
  }

  /** Run a built program to completion (stdin must be complete or the program must not read any). */
  function run(vm, mod) {
    const { ExitSignal, RunError } = H;
    const finish = (code) => { vm.done = true; vm.exitCode = code; return 'done'; };
    const handlers = (exitCode) => {
      mod.resetSP();
      while (vm.atexitQ.length) {
        const fa = vm.atexitQ.pop(), fi = ((fa - MEM.FUNC_BASE) / MEM.FUNC_STRIDE) | 0, f = mod.FT[fi];
        if (f) f();
      }
      return exitCode;
    };
    try {
      let v;
      try {
        v = mod.start();
        v = typeof v === 'bigint' ? Number(BigInt.asIntN(32, v)) : v | 0;
        return finish(handlers(v));
      } catch (e) {
        if (e instanceof ExitSignal) {
          try { handlers(); return finish(e.code); }
          catch (e2) { if (e2 instanceof ExitSignal) return finish(e2.code); throw e2; }
        }
        throw e;
      }
    } catch (e) {
      if (e instanceof RunError) { vm.error = e; vm.done = true; return 'error'; }
      if (e instanceof TurboTimeout) return 'timeout';
      if (e instanceof TurboNeedInput) return 'wait';
      if (e instanceof RangeError && /call stack|Maximum/i.test(e.message)) return 'overflow';
      const w = vm.where();
      vm.error = Object.assign(new RunError('internal', 'Internal error: ' + (e && e.message ? e.message : e)), w);
      vm.done = true; return 'error';
    }
  }

  CC.Turbo = { build, run, usesInput, Unsupported, TurboTimeout, TurboNeedInput };
})(typeof globalThis !== 'undefined' ? globalThis : self);
