/* C-Slayer · compiler: declarations, types, constants, initializers.
 * Installs methods on the shared compiler context C (see compile.js).
 */
(function (g) {
  'use strict';
  const CC = g.CC = g.CC || {};
  const T = CC.T;
  const OP = CC.OP;
  const MEM = CC.MEM;

  CC.installDecl = function (C) {
    const alignUp = (n, a) => (n + a - 1) & ~(a - 1);
    C.alignUp = alignUp;

    // ---------- scopes ----------
    C.pushScope = () => { C.scopes.push(new Map()); C.tagScopes.push(new Map()); };
    C.popScope = () => { C.scopes.pop(); C.tagScopes.pop(); };
    C.lookup = (name) => {
      for (let i = C.scopes.length - 1; i >= 0; i--) { const s = C.scopes[i].get(name); if (s) return s; }
      return null;
    };
    C.lookupTag = (name) => {
      for (let i = C.tagScopes.length - 1; i >= 0; i--) { const s = C.tagScopes[i].get(name); if (s) return s; }
      return null;
    };
    C.declareSym = (name, sym) => {
      C.scopes[C.scopes.length - 1].set(name, sym);
      // debugger info: every local / parameter, with the code range in which it is visible
      if (C.debug && C.fn && !C.sys && sym.kind === 'var' && sym.storage === 'local' && !String(name).startsWith('__')) {
        sym.dbg = { fn: C.fn.sym.idx, name, type: sym.type, off: sym.off, indirect: !!sym.indirect, isParam: !!sym.isParam, startPc: C.code.length, endPc: 1e9, line: sym.line || C.line };
        C.dbgVars.push(sym.dbg);
      }
      return sym;
    };

    // ---------- type construction ----------
    const ARITH = (b) => {
      const k = b.kind;
      if (k === 'void') return T.void;
      if (k === '_Bool') return T.bool;
      if (k === 'float') return T.float;
      if (k === 'double') return b.long ? T.ldouble : T.double;
      if (k === 'char') return b.unsigned ? T.uchar : b.signed ? T.schar : T.char;
      if (b.short) return b.unsigned ? T.ushort : T.short;
      if (b.long >= 2) return b.unsigned ? T.ullong : T.llong;
      if (b.long === 1) return b.unsigned ? T.ulong : T.long;
      return b.unsigned ? T.uint : T.int;
    };

    function layoutStruct(node, st) {
      let off = 0, maxAlign = 1, size = 0;
      const fields = [];
      for (const f of node.fields) {
        const base = C.baseType(f.spec);
        if (f.anon) {
          // anonymous struct / union member: its fields are reachable directly
          if (base.k !== 'struct') { C.error(f, 'declaration does not declare anything', 'warning'); continue; }
          const al = base.align || 1;
          off = st.isUnion ? 0 : alignUp(off, al);
          fields.push({ name: null, type: base, off, anon: true });
          if (st.isUnion) size = Math.max(size, base.size); else off += base.size;
          maxAlign = Math.max(maxAlign, al);
          continue;
        }
        for (const d of f.decls) {
          if (d.bits) { C.error(f, 'bit-fields are not supported by C-Slayer yet'); continue; }
          const r = C.applyDeclarator(base, d.decl, { field: true });
          if (!r.name) continue;
          let t = r.type;
          if (t.k === 'func') { C.error(f, "field '" + r.name + "' declared as a function"); continue; }
          if (t.k === 'struct' && !t.complete) { C.error(f, "field '" + r.name + "' has incomplete type"); continue; }
          if (t.k === 'array' && t.n === null && !t.vla) { /* flexible array member: allowed last */ t = Object.assign({}, t, { n: 0 }); }
          if (t.vla) { C.error(f, "field '" + r.name + "' has variable size"); continue; }
          if (fields.some(x => x.name === r.name)) { C.error(f, "duplicate member '" + r.name + "'"); continue; }
          const al = T.alignOf(t), sz = T.sizeOf(t);
          const o = st.isUnion ? 0 : alignUp(off, al);
          fields.push({ name: r.name, type: t, off: o });
          if (st.isUnion) size = Math.max(size, sz); else off = o + sz;
          maxAlign = Math.max(maxAlign, al);
        }
      }
      st.fields = fields; st.align = maxAlign;
      st.size = alignUp(st.isUnion ? size : off, maxAlign);
      st.complete = true;
    }

    function structFromSpec(node, isUnionKw) {
      const isUnion = node.t === 'union';
      let st = null;
      if (node.tag) {
        if (node.fields) { const sc = C.tagScopes[C.tagScopes.length - 1]; st = sc.get(node.tag); if (st && st.k !== 'struct') st = null; }
        else st = C.lookupTag(node.tag);
        if (st && st.k === 'struct' && st.isUnion !== isUnion) { C.error(node, "'" + node.tag + "' defined as wrong kind of tag"); st = null; }
      }
      if (!st || (node.fields && st.complete && C.tagScopes[C.tagScopes.length - 1].get(node.tag) === st)) {
        if (st && st.complete && node.fields) C.error(node, "redefinition of '" + (isUnion ? 'union ' : 'struct ') + node.tag + "'");
        else {
          st = { k: 'struct', tag: node.tag, isUnion, fields: [], size: 0, align: 1, complete: false, id: ++C.structId };
          if (node.tag) C.tagScopes[C.tagScopes.length - 1].set(node.tag, st);
        }
      }
      if (node.fields && !st.complete) layoutStruct(node, st);
      return st;
    }

    function enumFromSpec(node) {
      let et = node.tag ? C.lookupTag(node.tag) : null;
      if (!et || et.k !== 'enum') { et = { k: 'enum', tag: node.tag }; if (node.tag) C.tagScopes[C.tagScopes.length - 1].set(node.tag, et); }
      if (node.items) {
        let next = 0n;
        for (const it of node.items) {
          if (it.value) { const v = C.constInt(it.value); if (v === null) { C.error(it, "enumerator value for '" + it.name + "' is not an integer constant"); } else next = v; }
          C.declareSym(it.name, { kind: 'enum', name: it.name, value: next, type: T.int, line: it.line });
          next += 1n;
        }
      }
      return T.int;
    }

    /** declaration specifiers -> base type */
    C.baseType = function (spec) {
      const b = spec.base;
      let t;
      if (!b) t = T.int;
      else if (b.t === 'arith') t = ARITH(b);
      else if (b.t === 'typedef') {
        const s = C.lookup(b.name);
        if (!s || s.kind !== 'typedef') { C.error(b, "unknown type name '" + b.name + "'"); t = T.int; }
        else t = s.type;
      } else if (b.t === 'struct' || b.t === 'union') t = structFromSpec(b);
      else if (b.t === 'enum') t = enumFromSpec(b);
      else t = T.int;
      if (spec.quals && spec.quals.const) t = T.qual(t, true);
      return t;
    };

    /** apply a declarator to a base type -> {name, type, nameTok} */
    C.applyDeclarator = function (base, d, opts) {
      opts = opts || {};
      let t = base;
      for (const q of d.ptrs) t = T.ptr(t, q.const);
      // suffixes, innermost (rightmost) applied first
      for (let i = d.suffix.length - 1; i >= 0; i--) {
        const s = d.suffix[i];
        if (s.k === 'arr') {
          if (t.k === 'func') { C.error(s, 'declaration of an array of functions'); t = T.int; }
          let n = null, vla = false;
          if (s.size) {
            const v = C.constInt(s.size);
            if (v === null) vla = true;
            else if (v < 0n) { C.error(s, "size of array '" + (d.name || '') + "' is negative"); n = 1; }
            else if (v > 0x7fffffffn) { C.error(s, "size of array '" + (d.name || '') + "' is too large"); n = 1; }
            else n = Number(v);
          }
          if (t.k === 'struct' && !t.complete) C.error(s, "array type has incomplete element type 'struct " + (t.tag || '') + "'");
          if (vla) t = { k: 'array', of: t, n: null, vla: true, lenExpr: s.size, lenSlot: null };
          else t = T.array(t, n);
        } else if (s.k === 'fn') {
          if (t.k === 'array') { C.error(s, 'declaration of a function returning an array'); t = T.int; }
          if (t.k === 'func') { C.error(s, 'declaration of a function returning a function'); t = T.int; }
          const params = [], pinfo = [];
          for (const p of s.params) {
            const pb = C.baseType(p.spec);
            const r = C.applyDeclarator(pb, p.decl, { param: true });
            let pt = r.type;
            if (pt.k === 'array') pt = T.ptr(pt.of);          // array parameters decay
            else if (pt.k === 'func') pt = T.ptr(pt);
            if (pt.k === 'void') { if (s.params.length === 1 && !r.name) continue; C.error(p, "parameter has incomplete type 'void'"); pt = T.int; }
            params.push(pt); pinfo.push({ name: r.name, type: pt, line: p.line, nameTok: r.nameTok });
          }
          t = T.func(t, params, s.variadic, s.unspecified);
          t.pinfo = pinfo;
        }
      }
      if (d.inner) return C.applyDeclarator(t, d.inner, opts);
      return { name: d.name, type: t, nameTok: d.nameTok };
    };

    C.typeOfName = function (tn) {
      const base = C.baseType(tn.spec);
      return C.applyDeclarator(base, tn.decl, { abstract: true }).type;
    };

    // ---------- constant evaluation ----------
    const MASK = (t) => (v) => T.isInt(t) ? T.wrap(v, t) : v;
    /** integer constant expression -> BigInt (null if not constant). Type-aware: wraps like C would. */
    C.constInt = function (e) { const r = C.constVal(e); return r && r.k === 'int' ? r.v : (r && r.k === 'float' ? null : null); };
    /** returns {k:'int', v:BigInt, t:type} | {k:'float', v:number, t} | null */
    C.constVal = function (e) {
      switch (e.k) {
        case 'Num': {
          if (e.kind === 'float') return { k: 'float', v: e.value, t: e.f ? T.float : T.double };
          const v = e.value; let t;
          const fits = (ty) => v <= (ty.signed ? (1n << BigInt(ty.size * 8 - 1)) - 1n : (1n << BigInt(ty.size * 8)) - 1n);
          const dec = e.base === 10;
          const cands = e.l >= 1 ? (e.u ? [T.ulong] : (dec ? [T.long] : [T.long, T.ulong])) : (e.u ? [T.uint, T.ulong] : (dec ? [T.int, T.long] : [T.int, T.uint, T.long, T.ulong]));
          if (e.l >= 2) { cands.length = 0; cands.push(e.u ? T.ullong : T.llong); if (!e.u && !dec) cands.push(T.ullong); }
          t = cands.find(fits) || cands[cands.length - 1];
          return { k: 'int', v: T.wrap(v, t), t };
        }
        case 'Chr': return { k: 'int', v: BigInt(e.value), t: T.int };
        case 'Paren': return C.constVal(e.e);
        case 'Id': {
          const s = C.lookup(e.name);
          if (s && s.kind === 'enum') return { k: 'int', v: s.value, t: T.int };
          return null;
        }
        case 'SizeofT': { const t = C.typeOfName(e.tn); if (t.vla) return null; return { k: 'int', v: BigInt(T.sizeOf(t)), t: T.ulong }; }
        case 'SizeofE': {
          const t = C.staticTypeOf(e.e); if (!t || t.vla) return null;
          return { k: 'int', v: BigInt(T.sizeOf(t)), t: T.ulong };
        }
        case 'AlignofT': { const t = C.typeOfName(e.tn); return { k: 'int', v: BigInt(T.alignOf(t)), t: T.ulong }; }
        case 'Cast': {
          const t = C.typeOfName(e.tn);
          const r = C.constVal(e.e); if (!r) return null;
          if (T.isInt(t)) {
            if (t.isBool) return { k: 'int', v: (r.v ? 1n : 0n) && (r.k === 'float' ? (r.v !== 0 ? 1n : 0n) : (r.v !== 0n ? 1n : 0n)), t };
            if (r.k === 'float') { if (!isFinite(r.v)) return null; return { k: 'int', v: T.wrap(BigInt(Math.trunc(r.v)), t), t }; }
            return { k: 'int', v: T.wrap(r.v, t), t };
          }
          if (T.isFloat(t)) { const v = r.k === 'int' ? Number(r.v) : r.v; return { k: 'float', v: t.size === 4 ? Math.fround(v) : v, t }; }
          if (T.isPtr(t) && r.k === 'int') return { k: 'int', v: r.v, t };
          return null;
        }
        case 'Un': {
          if (e.op === '&' || e.op === '*' || e.op === '++' || e.op === '--') return null;
          const r = C.constVal(e.e); if (!r) return null;
          if (e.op === '!') return { k: 'int', v: (r.k === 'int' ? r.v === 0n : r.v === 0) ? 1n : 0n, t: T.int };
          if (r.k === 'float') { if (e.op === '-') return { k: 'float', v: -r.v, t: r.t }; if (e.op === '+') return r; return null; }
          const pt = T.promote(r.t);
          let v = r.v;
          if (e.op === '-') v = -v; else if (e.op === '~') v = ~v;
          return { k: 'int', v: T.wrap(v, pt), t: pt };
        }
        case 'Bin': {
          const a = C.constVal(e.l); if (!a) return null;
          const b = C.constVal(e.r); if (!b) return null;
          const op = e.op;
          if (a.k === 'float' || b.k === 'float') {
            const x = a.k === 'float' ? a.v : Number(a.v), y = b.k === 'float' ? b.v : Number(b.v);
            const rt = T.usual(a.t, b.t);
            const fr = (v) => ({ k: 'float', v: rt.size === 4 ? Math.fround(v) : v, t: rt });
            switch (op) {
              case '+': return fr(x + y); case '-': return fr(x - y); case '*': return fr(x * y); case '/': return fr(x / y);
              case '<': return { k: 'int', v: x < y ? 1n : 0n, t: T.int }; case '>': return { k: 'int', v: x > y ? 1n : 0n, t: T.int };
              case '<=': return { k: 'int', v: x <= y ? 1n : 0n, t: T.int }; case '>=': return { k: 'int', v: x >= y ? 1n : 0n, t: T.int };
              case '==': return { k: 'int', v: x === y ? 1n : 0n, t: T.int }; case '!=': return { k: 'int', v: x !== y ? 1n : 0n, t: T.int };
            }
            return null;
          }
          if (op === '<<' || op === '>>') {
            const lt = T.promote(a.t); const sh = b.v;
            if (sh < 0n || sh >= BigInt(lt.size * 8)) return null;
            return { k: 'int', v: T.wrap(op === '<<' ? a.v << sh : a.v >> sh, lt), t: lt };
          }
          const rt = T.usual(a.t, b.t);
          const x = T.wrap(a.v, rt), y = T.wrap(b.v, rt);
          let v;
          switch (op) {
            case '+': v = x + y; break; case '-': v = x - y; break; case '*': v = x * y; break;
            case '/': if (y === 0n) return null; v = x / y; break;
            case '%': if (y === 0n) return null; v = x % y; break;
            case '&': v = x & y; break; case '|': v = x | y; break; case '^': v = x ^ y; break;
            case '<': return { k: 'int', v: x < y ? 1n : 0n, t: T.int }; case '>': return { k: 'int', v: x > y ? 1n : 0n, t: T.int };
            case '<=': return { k: 'int', v: x <= y ? 1n : 0n, t: T.int }; case '>=': return { k: 'int', v: x >= y ? 1n : 0n, t: T.int };
            case '==': return { k: 'int', v: x === y ? 1n : 0n, t: T.int }; case '!=': return { k: 'int', v: x !== y ? 1n : 0n, t: T.int };
            default: return null;
          }
          return { k: 'int', v: T.wrap(v, rt), t: rt };
        }
        case 'Logic': {
          const a = C.constVal(e.l); if (!a) return null;
          const av = a.k === 'float' ? a.v !== 0 : a.v !== 0n;
          if (e.op === '&&' && !av) return { k: 'int', v: 0n, t: T.int };
          if (e.op === '||' && av) return { k: 'int', v: 1n, t: T.int };
          const b = C.constVal(e.r); if (!b) return null;
          const bv = b.k === 'float' ? b.v !== 0 : b.v !== 0n;
          return { k: 'int', v: bv ? 1n : 0n, t: T.int };
        }
        case 'Cond': {
          const c = C.constVal(e.c); if (!c) return null;
          const cv = c.k === 'float' ? c.v !== 0 : c.v !== 0n;
          return C.constVal(cv ? e.a : e.b);
        }
      }
      return null;
    };

    // ---------- string literals / globals ----------
    C.internString = function (bytes) {
      const key = bytes.join(',');
      let a = C.strings.get(key);
      if (a !== undefined) return a;
      if (C.rodata.length + bytes.length + 1 > MEM.RO_SIZE) { C.error(C.curNode || { line: C.line }, 'too many / too large string literals'); return MEM.RO_BASE; }
      a = MEM.RO_BASE + C.rodata.length;
      for (const b of bytes) C.rodata.push(b & 255);
      C.rodata.push(0);
      C.strings.set(key, a);
      return a;
    };
    C.globalBase = MEM.RO_BASE + MEM.RO_SIZE;
    C.allocGlobal = function (size, align, arrInfo) {
      if (!(size >= 0) || C.gdata.length + size + 64 > 32 * 1024 * 1024) { C.error({ line: C.line }, 'program data is too large (limit 32 MB of global arrays)'); return C.globalBase; }
      let off = alignUp(C.gdata.length, Math.max(align, 1));
      if (arrInfo) {
        off = alignUp(off + 16, 16);
        C.pad(off);
        C.gdata.length = off + size;
        const base = C.globalBase;
        C.redzones.push({ addr: base + off - 16, len: 16, side: 'before', name: arrInfo.name, arrSize: size });
        C.redzones.push({ addr: base + off + size, len: 16, side: 'after', name: arrInfo.name, arrSize: size });
        C.gdata.length = off + size + 16;
        C.fillZero(off, C.gdata.length);
        if (C.gdata.length > 32 * 1024 * 1024) { C.error({ line: C.line }, 'program data is too large (limit 32 MB of global arrays)'); C.gdata.length = 1024; }
        return base + off;
      }
      C.pad(off);
      C.gdata.length = off + size;
      C.fillZero(off, off + size);
      if (C.gdata.length > 32 * 1024 * 1024) { C.error({ line: C.line }, 'program data is too large (limit 32 MB of global arrays)'); C.gdata.length = 1024; }
      return C.globalBase + off;
    };
    C.pad = (n) => { for (let i = C.gdata.length; i < n; i++) C.gdata[i] = 0; };
    C.fillZero = (a, b) => { for (let i = a; i < b; i++) if (C.gdata[i] === undefined) C.gdata[i] = 0; };
    C.gwrite = function (addr, size, v /* BigInt */) {
      let o = addr - C.globalBase;
      let x = BigInt.asUintN(size * 8, v);
      for (let i = 0; i < size; i++) { C.gdata[o + i] = Number(x & 255n); x >>= 8n; }
    };
    C.gwriteF = function (addr, size, v) {
      const dv = new DataView(new ArrayBuffer(8));
      if (size === 4) dv.setFloat32(0, v, true); else dv.setFloat64(0, v, true);
      const o = addr - C.globalBase;
      for (let i = 0; i < size && i < 8; i++) C.gdata[o + i] = dv.getUint8(i);
    };

    // ---------- member lookup ----------
    C.findMember = function (st, name) {
      for (const f of st.fields) {
        if (f.name === name) return { type: f.type, off: f.off };
        if (f.anon) { const r = C.findMember(f.type, name); if (r) return { type: r.type, off: f.off + r.off }; }
      }
      return null;
    };

    // ---------- static (constant) initial values ----------
    /** evaluate a static initializer leaf -> {k:'int',v} | {k:'float',v} | {k:'addr',v:number} | null */
    C.evalStatic = function (e, want) {
      const cv = C.constVal(e);
      if (cv) return cv.k === 'int' ? { k: 'int', v: cv.v } : { k: 'float', v: cv.v };
      switch (e.k) {
        case 'Paren': return C.evalStatic(e.e, want);
        case 'Str': return { k: 'addr', v: C.internString(e.bytes) };
        case 'Cast': {
          const t = C.typeOfName(e.tn);
          const r = C.evalStatic(e.e, t);
          if (!r) return null;
          if (T.isPtr(t) || (T.isInt(t) && t.size === 8)) return r;
          if (r.k === 'addr') return null;
          return r;
        }
        case 'Id': {
          const s = C.lookup(e.name);
          if (!s) return null;
          if (s.kind === 'func') return { k: 'addr', v: C.funcAddr(s) };
          if (s.kind === 'var' && (s.storage === 'global' || s.storage === 'static') && s.type.k === 'array') return { k: 'addr', v: s.addr };
          return null;
        }
        case 'Un': {
          if (e.op !== '&') return null;
          const a = C.staticAddr(e.e); return a === null ? null : { k: 'addr', v: a };
        }
        case 'Bin': {
          if (e.op !== '+' && e.op !== '-') return null;
          const l = C.evalStatic(e.l), r = C.evalStatic(e.r);
          if (!l || !r) return null;
          if (l.k === 'addr' && r.k === 'int') {
            const lt = C.staticTypeOf(e.l); const es = lt && (lt.k === 'ptr' || lt.k === 'array') ? T.sizeOf(lt.k === 'ptr' ? lt.to : lt.of) : 1;
            return { k: 'addr', v: (l.v + (e.op === '+' ? 1 : -1) * Number(r.v) * es) >>> 0 };
          }
          if (r.k === 'addr' && l.k === 'int' && e.op === '+') {
            const rt = C.staticTypeOf(e.r); const es = rt && (rt.k === 'ptr' || rt.k === 'array') ? T.sizeOf(rt.k === 'ptr' ? rt.to : rt.of) : 1;
            return { k: 'addr', v: (r.v + Number(l.v) * es) >>> 0 };
          }
          return null;
        }
      }
      return null;
    };
    /** address of a static lvalue (global var, member, element) or null */
    C.staticAddr = function (e) {
      switch (e.k) {
        case 'Paren': return C.staticAddr(e.e);
        case 'Id': { const s = C.lookup(e.name); if (s && s.kind === 'var' && (s.storage === 'global' || s.storage === 'static')) return s.addr; if (s && s.kind === 'func') return C.funcAddr(s); return null; }
        case 'Mem': {
          if (e.arrow) return null;
          const a = C.staticAddr(e.e); if (a === null) return null;
          const bt = C.staticTypeOf(e.e); if (!bt || bt.k !== 'struct') return null;
          const m = C.findMember(bt, e.name); return m ? a + m.off : null;
        }
        case 'Index': {
          const bt = C.staticTypeOf(e.a); if (!bt || bt.k !== 'array') return null;
          const i = C.constInt(e.i); if (i === null) return null;
          const a = C.staticAddr(e.a); if (a === null) return null;
          return a + Number(i) * T.sizeOf(bt.of);
        }
        case 'Str': return C.internString(e.bytes);
      }
      return null;
    };
    /** type of simple expressions without generating code (used for sizeof and static initializers) */
    C.staticTypeOf = function (e) {
      const mark = C.code.length, lmark = C.lines.length, fmark = C.fixups.length;
      const q = C.quiet; C.quiet = true;
      let t = null;
      const savedFn = C.fn;
      try {
        if (!C.fn) C.fn = { name: '', frame: 0, maxFrame: 0, redzones: [], labels: new Map(), gotos: [], ret: T.void, probe: true, params: [] };
        t = C.exprType(e);
      } catch (x) { t = null; }
      C.fn = savedFn;
      C.quiet = q;
      C.code.length = mark; C.lines.length = lmark; C.fixups.length = fmark;
      return t;
    };

    /** Walk an initializer for `type`, calling leaf(type, byteOffset, expr, kind) for each scalar/struct-expr/string leaf.
     *  Handles braces, designators and brace elision. Returns the number of top-level elements for arrays of unknown size. */
    C.walkInit = function (type, init, leaf, errNode) {
      let maxIdx = 0;
      const isAgg = (t) => t.k === 'struct' || t.k === 'array';
      function strLeaf(t, e) { // char array initialised from a string literal
        return t.k === 'array' && T.isInt(t.of) && t.of.size === 1 && e && e.k === 'Str';
      }
      function unparen(e) { while (e && e.k === 'Paren') e = e.e; return e; }

      function fillFrom(t, off, items, cur, braced) {
        // t is an array or struct; consume items from cur.i
        if (t.k === 'array') {
          const lim = t.n === null ? Infinity : t.n;
          let idx = 0;
          while (cur.i < items.length && idx < lim) {
            const it = items[cur.i];
            if (it.designators.length) {
              if (!braced) break;
              const d = it.designators[0];
              if (d.index === undefined) { C.error(errNode, "field name not in record or union initializer"); cur.i++; continue; }
              const iv = C.constInt(d.index); if (iv === null) { C.error(errNode, 'nonconstant array index in initializer'); cur.i++; continue; }
              idx = Number(iv);
              if (idx < 0 || (t.n !== null && idx >= t.n)) { C.error(errNode, 'array index in initializer exceeds array bounds'); cur.i++; continue; }
              if (it.designators.length > 1) {
                const sub = { designators: it.designators.slice(1), e: it.e };
                one(t.of, off + idx * T.sizeOf(t.of), [sub], { i: 0 }, true, true);
                cur.i++; idx++; maxIdx = Math.max(maxIdx, idx); continue;
              }
            }
            one(t.of, off + idx * T.sizeOf(t.of), items, cur, false);
            idx++; maxIdx = Math.max(maxIdx, idx);
          }
          if (braced && cur.i < items.length && t.n !== null && idx >= lim) { C.error(errNode, 'excess elements in array initializer', 'warning'); cur.i = items.length; }
        } else {
          const fields = t.fields.filter(f => f.name !== null || f.anon);
          let fi = 0;
          while (cur.i < items.length && fi < (t.isUnion ? 1 : fields.length)) {
            const it = items[cur.i];
            if (it.designators.length) {
              if (!braced) break;
              const d = it.designators[0];
              if (d.field === undefined) { C.error(errNode, 'array index in non-array initializer'); cur.i++; continue; }
              const k = fields.findIndex(f => f.name === d.field);
              if (k < 0) { C.error(errNode, "unknown field '" + d.field + "' specified in initializer"); cur.i++; continue; }
              fi = k;
              if (it.designators.length > 1) {
                const sub = { designators: it.designators.slice(1), e: it.e };
                one(fields[fi].type, off + fields[fi].off, [sub], { i: 0 }, true, true);
                cur.i++; fi++; continue;
              }
            }
            const f = fields[fi];
            one(f.type, off + f.off, items, cur, false);
            fi++;
          }
          if (braced && cur.i < items.length) { C.error(errNode, 'excess elements in ' + (t.isUnion ? 'union' : 'struct') + ' initializer', 'warning'); cur.i = items.length; }
        }
      }
      // initialize one object of type t from items[cur.i] (consuming 1 item, or several via brace elision)
      function one(t, off, items, cur, braced, forceItem) {
        const it = items[cur.i];
        const e = it.e;
        if (e.k === 'InitList') {
          cur.i++;
          if (isAgg(t)) fillFrom(t, off, e.items, { i: 0 }, true);
          else { // scalar in braces
            if (e.items.length) leaf(t, off, e.items[0].e, 'scalar');
            if (e.items.length > 1) C.error(errNode, 'excess elements in scalar initializer', 'warning');
          }
          return;
        }
        if (strLeaf(t, unparen(e))) { cur.i++; leaf(t, off, unparen(e), 'str'); return; }
        if (isAgg(t)) {
          // struct value expression (e.g. = other) or brace elision
          if (t.k === 'struct' && !forceItem) {
            const et = C.staticTypeOf(e);
            if (et && et.k === 'struct' && C.sameType(et, t)) { cur.i++; leaf(t, off, e, 'struct'); return; }
          }
          fillFrom(t, off, items, cur, false);
          return;
        }
        cur.i++; leaf(t, off, e, 'scalar');
      }

      if (init.k === 'InitList') {
        if (isAgg(type)) fillFrom(type, 0, init.items, { i: 0 }, true);
        else if (init.items.length) leaf(type, 0, init.items[0].e, 'scalar');
        return maxIdx;
      }
      // not a list: string for char array, struct copy, scalar
      if (strLeaf(type, unparen(init))) { leaf(type, 0, unparen(init), 'str'); return type.n === null ? unparen(init).bytes.length + 1 : 0; }
      if (type.k === 'array') { C.error(errNode || init, 'invalid initializer for array'); return 0; }
      leaf(type, 0, init, type.k === 'struct' ? 'struct' : 'scalar');
      return 0;
    };

    /** resolve array type of unknown size from an initializer */
    C.completeArray = function (type, init) {
      if (type.k !== 'array' || type.n !== null || type.vla || !init) return type;
      let count;
      const u = (function strip(e) { while (e && e.k === 'Paren') e = e.e; return e; })(init);
      if (u && u.k === 'Str' && T.isInt(type.of) && type.of.size === 1) count = u.bytes.length + 1;
      else if (init.k === 'InitList') {
        const q = C.quiet; C.quiet = true;
        count = C.walkInit(type, init, () => {}, init);
        C.quiet = q;
      } else { return type; }
      return T.array(type.of, Math.max(count, 0));
    };

    C.sameType = (a, b) => T.same(T.unqual(a), T.unqual(b));
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
