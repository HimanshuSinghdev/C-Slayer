/* C-Slayer · type system (LP64 data model: int 4, long 8, pointer 8, char signed) */
(function (g) {
  'use strict';
  const CC = g.CC = g.CC || {};

  const T = {};
  const mkInt = (size, signed, name, extra) => Object.assign({ k: 'int', size, signed, name }, extra || {});
  T.void = { k: 'void', name: 'void' };
  T.char = mkInt(1, true, 'char', { isChar: true });
  T.schar = mkInt(1, true, 'signed char', { isChar: true });
  T.uchar = mkInt(1, false, 'unsigned char', { isChar: true });
  T.short = mkInt(2, true, 'short int');
  T.ushort = mkInt(2, false, 'short unsigned int');
  T.int = mkInt(4, true, 'int');
  T.uint = mkInt(4, false, 'unsigned int');
  T.long = mkInt(8, true, 'long int');
  T.ulong = mkInt(8, false, 'long unsigned int');
  T.llong = mkInt(8, true, 'long long int');
  T.ullong = mkInt(8, false, 'long long unsigned int');
  T.bool = mkInt(1, false, '_Bool', { isBool: true });
  T.float = { k: 'float', size: 4, name: 'float' };
  T.double = { k: 'float', size: 8, name: 'double' };
  T.ldouble = { k: 'float', size: 16, name: 'long double' };

  T.ptr = (to, c) => { const t = { k: 'ptr', size: 8, to }; if (c) t.c = true; return t; };
  T.array = (of, n) => ({ k: 'array', of, n });
  T.func = (ret, params, variadic, unspecified) => ({ k: 'func', ret, params: params || [], variadic: !!variadic, unspecified: !!unspecified });
  T.qual = (t, c) => { if (!c || t.c) return t; const q = Object.assign({}, t); q.c = true; return q; };
  T.unqual = (t) => { if (!t.c) return t; const q = Object.assign({}, t); delete q.c; return q; };
  T.vla = (of, lenSlot) => ({ k: 'array', of, n: null, vla: true, lenSlot });

  const isInt = t => t.k === 'int';
  const isFloat = t => t.k === 'float';
  const isArith = t => t.k === 'int' || t.k === 'float';
  const isPtr = t => t.k === 'ptr';
  const isScalar = t => t.k === 'int' || t.k === 'float' || t.k === 'ptr';
  const isAgg = t => t.k === 'struct';
  T.isInt = isInt; T.isFloat = isFloat; T.isArith = isArith; T.isPtr = isPtr; T.isScalar = isScalar; T.isAgg = isAgg;

  function sizeOf(t) {
    switch (t.k) {
      case 'int': case 'float': case 'ptr': return t.size;
      case 'array': return t.n === null ? 0 : t.n * sizeOf(t.of);
      case 'struct': return t.size;
      case 'void': return 1;
      case 'func': return 1;
    }
    return 0;
  }
  function alignOf(t) {
    switch (t.k) {
      case 'int': case 'ptr': return t.size;
      case 'float': return Math.min(t.size, 16);
      case 'array': return alignOf(t.of);
      case 'struct': return t.align || 1;
    }
    return 1;
  }
  T.sizeOf = sizeOf; T.alignOf = alignOf;

  /** arithmetic class used by the VM: I U L UL F D P */
  function cls(t) {
    switch (t.k) {
      case 'int':
        if (t.size <= 4) return (t.size === 4 && !t.signed) ? 'U' : 'I';
        return t.signed ? 'L' : 'UL';
      case 'float': return t.size === 4 ? 'F' : 'D';
      case 'ptr': case 'array': case 'func': return 'P';
    }
    return null;
  }
  T.cls = cls;

  // memory access kinds (VM)
  const K = { I8: 0, U8: 1, I16: 2, U16: 3, I32: 4, U32: 5, I64: 6, U64: 7, F32: 8, F64: 9, PTR: 10 };
  T.K = K;
  function kindOf(t) {
    switch (t.k) {
      case 'int':
        if (t.size === 1) return t.signed ? K.I8 : K.U8;
        if (t.size === 2) return t.signed ? K.I16 : K.U16;
        if (t.size === 4) return t.signed ? K.I32 : K.U32;
        return t.signed ? K.I64 : K.U64;
      case 'float': return t.size === 4 ? K.F32 : K.F64;
      case 'ptr': return K.PTR;
    }
    return -1;
  }
  T.kindOf = kindOf;

  function typeName(t) {
    if (!t) return '?';
    const q = t.c ? 'const ' : '';
    switch (t.k) {
      case 'void': return q + 'void';
      case 'int': case 'float': return q + (t.name || '?');
      case 'ptr': {
        const inner = t.to;
        if (inner.k === 'func') return typeName(inner.ret) + ' (*)(' + paramList(inner) + ')';
        if (inner.k === 'array') return typeName(inner.of) + ' (*)[' + (inner.n === null ? '' : inner.n) + ']';
        return typeName(inner) + (/\*$/.test(typeName(inner)) ? '*' : ' *') + (t.c ? ' const' : '');
      }
      case 'array': {
        let dims = '', e = t;
        while (e.k === 'array') { dims += '[' + (e.n === null ? '' : e.n) + ']'; e = e.of; }
        return typeName(e) + dims;
      }
      case 'struct': return q + (t.isUnion ? 'union ' : 'struct ') + (t.tag || '<anonymous>');
      case 'func': return typeName(t.ret) + ' (' + paramList(t) + ')';
    }
    return '?';
  }
  function paramList(f) {
    if (f.unspecified) return '';
    if (!f.params.length) return f.variadic ? '...' : 'void';
    return f.params.map(typeName).join(', ') + (f.variadic ? ', ...' : '');
  }
  T.name = typeName;

  /** types equal ignoring top-level qualifiers */
  function same(a, b) {
    if (a === b) return true;
    if (a.k !== b.k) return false;
    switch (a.k) {
      case 'void': return true;
      case 'int': return a.size === b.size && a.signed === b.signed && !!a.isBool === !!b.isBool;
      case 'float': return a.size === b.size;
      case 'ptr': return same(a.to, b.to) && !!a.to.c === !!b.to.c;
      case 'array': return same(a.of, b.of) && a.n === b.n;
      case 'struct': return a === b || (a.id !== undefined && a.id === b.id);
      case 'func': {
        if (!same(a.ret, b.ret)) return false;
        if (a.unspecified || b.unspecified) return true;
        if (a.params.length !== b.params.length || a.variadic !== b.variadic) return false;
        for (let i = 0; i < a.params.length; i++) if (!same(a.params[i], b.params[i])) return false;
        return true;
      }
    }
    return false;
  }
  T.same = same;
  /** compatible ignoring const at every level (for pointer compatibility) */
  function sameNoQual(a, b) {
    if (a.k !== b.k) return false;
    switch (a.k) {
      case 'ptr': return sameNoQual(a.to, b.to);
      case 'array': return sameNoQual(a.of, b.of) && (a.n === b.n || a.n === null || b.n === null);
      case 'func': return true;
    }
    return same(a, b);
  }
  T.sameNoQual = sameNoQual;

  /** integer promotion */
  T.promote = function (t) {
    if (t.k === 'int' && t.size < 4) return T.int;
    if (t.k === 'int' && t.isBool) return T.int;
    return t;
  };
  /** usual arithmetic conversions */
  T.usual = function (a, b) {
    a = T.promote(a); b = T.promote(b);
    if (a.k === 'float' || b.k === 'float') {
      const sa = a.k === 'float' ? a.size : 0, sb = b.k === 'float' ? b.size : 0;
      const m = Math.max(sa, sb);
      return m === 16 ? T.ldouble : m === 8 ? T.double : T.float;
    }
    if (a.size > b.size) return a;
    if (b.size > a.size) return b;
    if (a.signed === b.signed) return a;
    return a.signed ? b : a; // unsigned wins at equal rank
  };
  T.integerOf = function (size, signed) {
    if (size <= 4) return signed ? T.int : T.uint;
    return signed ? T.long : T.ulong;
  };

  /** wrap a BigInt to an integer type's range */
  T.wrap = function (v, t) {
    const bits = t.size * 8;
    return t.signed ? BigInt.asIntN(bits, v) : BigInt.asUintN(bits, v);
  };

  CC.T = T;
})(typeof globalThis !== 'undefined' ? globalThis : self);
