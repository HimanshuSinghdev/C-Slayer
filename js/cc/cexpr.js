/* C-Slayer · compiler: expressions.
 * Convention: C.expr(e) emits code leaving exactly ONE value on the operand stack and returns the expression's
 * (un-decayed) type. Scalars are pushed by value; arrays, structs and functions are pushed as their address.
 */
(function (g) {
  'use strict';
  const CC = g.CC = g.CC || {};
  const T = CC.T, OP = CC.OP, MEM = CC.MEM;
  const normL = (b) => (b >= -9007199254740991n && b <= 9007199254740991n) ? Number(b) : b;

  CC.installExpr = function (C) {
    const cn = (t) => { const c = T.cls(t); return c === 'I' ? 0 : c === 'U' || c === 'P' ? 1 : c === 'L' ? 2 : c === 'UL' ? 3 : c === 'F' ? 4 : 5; };
    C.cn = cn;
    const e1 = (op, a, b) => C.emit(op, a, b);
    const typeStr = (t) => T.name(t);
    const stripParen = (e) => { while (e.k === 'Paren') e = e.e; return e; };
    C.stripParen = stripParen;
    const decay = (t) => t.k === 'array' ? T.ptr(t.of) : t.k === 'func' ? T.ptr(t) : t;
    C.decay = decay;
    const isIntegral = (t) => t.k === 'int';
    const isScalar = (t) => t.k === 'int' || t.k === 'float' || t.k === 'ptr';

    // ---------- constants ----------
    C.pushConst = function (t, v /* BigInt | number */) {
      const c = cn(t);
      if (c === 0) { e1(OP.ICONST, Number(BigInt.asIntN(32, BigInt(v)))); return; }
      if (c === 1) { const n = Number(BigInt.asUintN(32, BigInt(v))); if (n < 0x7fffffff) e1(OP.ICONST, n); else e1(OP.KCONST, C.konst(n)); return; }
      if (c === 2) { e1(OP.KCONST, C.konst(normL(BigInt.asIntN(64, BigInt(v))))); return; }
      if (c === 3) { e1(OP.KCONST, C.konst(normL(BigInt.asUintN(64, BigInt(v))))); return; }
      e1(OP.KCONST, C.konst(c === 4 ? Math.fround(Number(v)) : Number(v)));
    };
    C.pushInt = function (n) { e1(OP.ICONST, n | 0); };

    // ---------- conversions ----------
    const narrowKind = (t) => t.size === 1 ? (t.signed ? 0 : 1) : (t.signed ? 2 : 3);
    C.convert = function (from, to) {
      from = decay(from);
      if (!isScalar(from) || !isScalar(to)) return;
      if (to.isBool) { if (!from.isBool) e1(OP.TOBOOL, cn(from)); return; }
      const fc = cn(from), tc = cn(to);
      if (fc !== tc && !((fc === 0 || fc === 1) && tc === 2) && !(fc === 1 && tc === 3)) e1(OP.CONV, fc * 8 + tc);   // int/uint -> long (and uint -> ulong) keep the same value
      if (to.k === 'int' && to.size < 4) {
        let skip = false;
        if (from.k === 'int' && !from.isBool) {
          if (from.size === to.size && from.signed === to.signed) skip = true;
          else if (from.size < to.size && (from.signed ? to.signed : true)) skip = true;
        } else if (from.k === 'int' && from.isBool) skip = true;
        if (!skip) e1(OP.NARROW, narrowKind(to));
      }
    };
    /** convert an integer of any class on top of the stack to class I (for indexes / shift counts) */
    C.toIndex = function (t) { const c = cn(t); if (c !== 0) e1(OP.CONV, c * 8 + 0); };
    C.loadKind = (t) => T.kindOf(t);
    const bfPack = (t) => (T.kindOf(t) & 15) | (t.bf.shift << 4) | ((t.bf.bits - 1) << 10);
    C.emitLoad = function (t) { if (t.bf) { e1(OP.LOADBF, bfPack(t)); return; } if (isScalar(t)) e1(OP.LOAD, T.kindOf(t)); };
    C.emitStore = function (t, keep) { if (t.bf) { e1(OP.STOREBF, bfPack(t), keep ? 1 : 0); return; } e1(keep ? OP.STORE : OP.STOREP, T.kindOf(t)); };
    /** type of a loaded bit-field value (integer promotion of the bit-field) */
    C.bfValueType = function (t) {
      if (!t.bf) return t;
      const bits = t.bf.bits;
      if (bits < 32) return T.int;
      const b = Object.assign({}, t); delete b.bf; return b;
    };
    C.truthy = function (t) { // value on stack -> something JZ/JNZ can test
      t = decay(t);
      const c = cn(t);
      if (c >= 2) e1(OP.TOBOOL, c);
    };
    C.isBoolExpr = function (e) {
      e = stripParen(e);
      if (e.k === 'Logic') return true;
      if (e.k === 'Un' && e.op === '!') return true;
      if (e.k === 'Bin' && ['==', '!=', '<', '>', '<=', '>='].includes(e.op)) return true;
      return false;
    };
    /** evaluate e as a condition, leaving a value that JZ/JNZ can test directly */
    C.cond = function (e) {
      const t = C.rv(e);
      if (t.k === 'struct' || t.k === 'void') { C.error(e, 'used ' + (t.k === 'void' ? 'void' : 'struct') + ' type value where scalar is required'); return; }
      C.truthy(t);
    };
    /** like cond but normalised to 0/1 */
    C.condBool = function (e) {
      const t = C.rv(e);
      if (t.k === 'struct' || t.k === 'void') { C.error(e, 'used ' + (t.k === 'void' ? 'void' : 'struct') + ' type value where scalar is required'); return; }
      if (!C.isBoolExpr(e)) e1(OP.TOBOOL, cn(t));
    };

    C.sizeCode = function (t) { // pushes sizeof(t) as size_t (UL); handles variable-length arrays
      if (t.k === 'array' && t.vla) {
        C.materializeVLA(t);
        e1(OP.LLOAD, 7, t.lenSlot);
        C.sizeCode(t.of);
        e1(OP.MUL_UL);
        return;
      }
      C.pushConst(T.ulong, BigInt(T.sizeOf(t)));
    };
    C.hasVLA = (t) => t.k === 'array' && (t.vla || C.hasVLA(t.of));
    C.materializeVLA = function (t) {
      if (t.k !== 'array') return;
      if (t.vla && t.lenSlot === null) {
        const q = C.quiet;
        const lt = C.rv(t.lenExpr);
        if (!T.isInt(lt)) C.error(t.lenExpr, 'size of array has non-integer type');
        C.convert(lt, T.ulong);
        t.lenSlot = C.allocFrame(8, 8);
        e1(OP.LSTOREP, 7, t.lenSlot);
      }
      C.materializeVLA(t.of);
    };
    /** push element size as an int (for pointer arithmetic) */
    C.elemSizeInt = function (t) {
      if (C.hasVLA(t)) { C.sizeCode(t); e1(OP.CONV, 3 * 8 + 0); }
      else C.pushInt(T.sizeOf(t));
    };
    C.scaleIndex = function (elem) { // index (class I) on top -> byte offset
      if (C.hasVLA(elem)) { C.elemSizeInt(elem); e1(OP.MUL_I); return; }
      const sz = T.sizeOf(elem);
      if (sz === 1) return;
      C.pushInt(sz); e1(OP.MUL_I);
    };

    // ---------- assignment compatibility ----------
    C.isNullConst = function (e) {
      const s = stripParen(e);
      const v = C.constVal(s);
      if (v && v.k === 'int' && v.v === 0n) return true;
      if (s.k === 'Cast') { const t = C.typeOfName(s.tn); if (t.k === 'ptr' && t.to.k === 'void') return C.isNullConst(s.e); }
      return false;
    };
    const phrase = (what, to, from, tail) => {
      switch (what.kind) {
        case 'arg': return 'passing argument ' + what.n + " of '" + what.fname + "' " + tail;
        case 'init': return "initialization of '" + typeStr(to) + "' from '" + typeStr(from) + "' " + tail;
        case 'return': return "returning '" + typeStr(from) + "' from a function with return type '" + typeStr(to) + "' " + tail;
        default: return "assignment to '" + typeStr(to) + "' from '" + typeStr(from) + "' " + tail;
      }
    };
    const incompat = (what, to, from) => {
      switch (what.kind) {
        case 'arg': return 'incompatible type for argument ' + what.n + " of '" + what.fname + "'";
        case 'init': return "incompatible types when initializing type '" + typeStr(to) + "' using type '" + typeStr(from) + "'";
        case 'return': return "incompatible types when returning type '" + typeStr(from) + "' but '" + typeStr(to) + "' was expected";
        default: return "incompatible types when assigning to type '" + typeStr(to) + "' from type '" + typeStr(from) + "'";
      }
    };
    C.checkAssign = function (to, from, e, what) {
      what = what || { kind: 'assign' };
      from = decay(from);
      if (from.k === 'void') { C.error(e, 'void value not ignored as it ought to be'); return false; }
      if (to.k === 'struct' || from.k === 'struct') {
        if (to.k === 'struct' && from.k === 'struct' && C.sameType(to, from)) return true;
        C.error(e, incompat(what, to, from)); return false;
      }
      if ((to.k === 'int' || to.k === 'float') && (from.k === 'int' || from.k === 'float')) return true;
      if (to.k === 'ptr') {
        if (from.k === 'int') {
          if (C.isNullConst(e)) return true;
          C.warn(e, phrase(what, to, from, 'makes pointer from integer without a cast') + ' [-Wint-conversion]'); return true;
        }
        if (from.k === 'float') { C.error(e, incompat(what, to, from)); return false; }
        if (from.k === 'ptr') {
          const a = to.to, b = from.to;
          if (a.k === 'void' || b.k === 'void') {
            if (b.c && !a.c && b.k !== 'void' || (b.c && !a.c && a.k === 'void')) C.warn(e, (what.kind === 'arg' ? 'passing argument ' + what.n + " of '" + what.fname + "' discards 'const' qualifier from pointer target type" : (what.kind === 'init' ? 'initialization' : what.kind === 'return' ? 'return' : 'assignment') + " discards 'const' qualifier from pointer target type") + ' [-Wdiscarded-qualifiers]');
            return true;
          }
          if (!T.sameNoQual(a, b)) {
            if (a.k === 'func' || b.k === 'func') { if (a.k === b.k) return true; }
            const sameInt = a.k === 'int' && b.k === 'int' && a.size === b.size && !a.isChar && !b.isChar; // int* vs unsigned* : sign only
            const msg = what.kind === 'arg' ? 'passing argument ' + what.n + " of '" + what.fname + "' from incompatible pointer type" : what.kind === 'init' ? "initialization of '" + typeStr(to) + "' from incompatible pointer type '" + typeStr(from) + "'" : what.kind === 'return' ? "returning '" + typeStr(from) + "' from a function with incompatible return type '" + typeStr(to) + "'" : "assignment to '" + typeStr(to) + "' from incompatible pointer type '" + typeStr(from) + "'";
            C.warn(e, msg + ' [-Wincompatible-pointer-types]');
            return true;
          }
          if (b.c && !a.c) C.warn(e, (what.kind === 'arg' ? 'passing argument ' + what.n + " of '" + what.fname + "' discards 'const' qualifier from pointer target type" : (what.kind === 'init' ? 'initialization' : what.kind === 'return' ? 'return' : 'assignment') + " discards 'const' qualifier from pointer target type") + ' [-Wdiscarded-qualifiers]');
          return true;
        }
      }
      if (to.k === 'int' && from.k === 'ptr') {
        if (to.isBool) return true;
        C.warn(e, phrase(what, to, from, 'makes integer from pointer without a cast') + ' [-Wint-conversion]'); return true;
      }
      if (to.k === 'float' && from.k === 'ptr') { C.error(e, incompat(what, to, from)); return false; }
      return true;
    };
    /** evaluate e, check it can be assigned to `to`, and convert */
    C.rvTo = function (e, to, what) {
      const t = C.rv(e);
      if (!C.checkAssign(to, t, e, what)) return false;
      if (to.k === 'struct') return true;
      C.convert(t, to);
      return true;
    };

    // ---------- lvalues ----------
    C.isLvalue = function (e) {
      e = stripParen(e);
      return e.k === 'Id' || e.k === 'Index' || e.k === 'Mem' || (e.k === 'Un' && e.op === '*') || e.k === 'CompoundLit' || e.k === 'Str';
    };
    /** push the address of lvalue e; returns the object's type */
    C.lv = function (e) {
      switch (e.k) {
        case 'Paren': return C.lv(e.e);
        case 'Id': {
          const s = C.lookup(e.name);
          if (!s) { C.error(e, "'" + e.name + "' undeclared (first use in this function)"); C.pushInt(0); return T.int; }
          if (s.kind === 'var') { C.pushVarAddr(s); return s.type; }
          if (s.kind === 'func') { C.pushInt(C.funcAddr(s)); C.useFunc(s, e); return s.type; }
          C.error(e, "lvalue required here"); C.pushInt(0); return T.int;
        }
        case 'Un': {
          if (e.op !== '*') break;
          const t = C.rv(e.e);
          if (t.k !== 'ptr') { C.error(e, 'invalid type argument of unary \'*\' (have \'' + typeStr(t) + "')"); return T.int; }
          if (t.to.k === 'void') { C.error(e, "dereferencing 'void *' pointer"); return T.int; }
          return t.to;
        }
        case 'Index': return C.genIndexAddr(e);
        case 'Mem': return C.genMemAddr(e);
        case 'Str': { C.pushInt(C.internString(e.bytes)); return T.array(T.char, e.bytes.length + 1); }
        case 'CompoundLit': return C.genCompoundLit(e);
      }
      C.error(e, 'lvalue required as ' + 'operand');
      C.pushInt(0); return T.int;
    };
    C.pushVarAddr = function (s) {
      if (s.storage === 'local') {
        if (s.indirect) e1(OP.LLOAD, 10, s.off);
        else e1(OP.LEAL, s.off);
      } else { C.pushInt(s.addr); }
    };
    C.funcAddr = (s) => MEM.FUNC_BASE + s.idx * MEM.FUNC_STRIDE;
    C.useFunc = function (s, node) { if (!s.refLine) s.refLine = node.line; s.referenced = true; };

    C.genIndexAddr = function (e) {
      const bt = C.rv(e.a);
      let it;
      if (bt.k !== 'ptr') {
        // maybe int[ptr] form
        const mark = C.code.length;
        // evaluate the index expression type first via re-generation
        C.error(e, 'subscripted value is neither array nor pointer nor vector'); C.pushInt(0); C.rv(e.i); e1(OP.POP); return T.int;
      }
      // static bounds check on arrays
      const aT = C.staticTypeOf(e.a);
      it = C.rv(e.i);
      if (!isIntegral(it)) { C.error(e, 'array subscript is not an integer'); }
      const ci = C.constInt(e.i);
      if (ci !== null && aT && aT.k === 'array' && aT.n !== null && !aT.vla) {
        if (ci < 0n) C.warn(e, 'array subscript ' + ci + " is below array bounds of '" + typeStr(aT) + "' [-Warray-bounds]");
        else if (ci >= BigInt(aT.n) && aT.n > 0) C.warn(e, 'array subscript ' + ci + " is above array bounds of '" + typeStr(aT) + "' [-Warray-bounds]");
      }
      C.toIndex(it);
      C.scaleIndex(bt.to);
      e1(OP.ADD_U);
      return bt.to;
    };
    C.genMemAddr = function (e) {
      let st;
      if (e.arrow) {
        const t = C.rv(e.e);
        if (t.k !== 'ptr' || t.to.k !== 'struct') { C.error(e, "invalid type argument of '->' (have '" + typeStr(t) + "')"); return T.int; }
        st = t.to;
      } else {
        { let b = e.e; while (b && b.k === 'Paren') b = b.e; if (b && b.k === 'Id' && !C.quiet) { const bs = C.lookup(b.name); if (bs && bs.kind === 'var') bs.used = true; } }
        const t = C.lvOrValue(e.e);
        if (t.k !== 'struct') { C.error(e, "request for member '" + e.name + "' in something not a structure or union"); return T.int; }
        st = t;
      }
      if (!st.complete) { C.error(e, "invalid use of incomplete type 'struct " + (st.tag || '') + "'"); return T.int; }
      const m = C.findMember(st, e.name);
      if (!m) { C.error(e, "'" + typeStr(st) + "' has no member named '" + e.name + "'"); return T.int; }
      if (m.off) { C.pushInt(m.off); e1(OP.ADD_U); }
      const rt = st.c && !m.type.c ? T.qual(m.type, true) : m.type;
      return m.bf ? Object.assign({}, rt, { bf: m.bf }) : rt;
    };
    /** address of lvalue, or the address of the temporary holding an rvalue struct */
    C.lvOrValue = function (e) {
      const s = stripParen(e);
      if (C.isLvalue(s)) return C.lv(s);
      const t = C.expr(s);   // struct rvalues (call results) are already addresses
      return t;
    };

    C.genCompoundLit = function (e) {
      const t0 = C.typeOfName(e.tn);
      const t = C.completeArray(t0, e.init);
      if (C.fn && !C.fn.probe && C.fn.name !== '') {
        const off = C.allocFrame(Math.max(T.sizeOf(t), 1), Math.max(T.alignOf(t), 1));
        C.genLocalInit(off, t, e.init, e);
        e1(OP.LEAL, off);
      } else {
        const addr = C.allocGlobal(Math.max(T.sizeOf(t), 1), T.alignOf(t));
        C.staticInit(addr, t, e.init, e);
        C.pushInt(addr);
      }
      return t;
    };

    // ---------- main dispatcher ----------
    C.rv = function (e) { return decay(C.expr(e)); };
    C.exprType = function (e) { return C.expr(e); };

    C.expr = function (e) {
      C.curNode = e;
      switch (e.k) {
        case 'Paren': return C.expr(e.e);
        case 'Num': {
          const cv = C.constVal(e);
          if (!cv) { C.pushInt(0); return T.int; }
          if (cv.k === 'float') { C.pushConst(cv.t, cv.v); return cv.t; }
          C.pushConst(cv.t, cv.v); return cv.t;
        }
        case 'Chr': { C.pushInt(e.value); return T.int; }
        case 'Str': { C.pushInt(C.internString(e.bytes)); return T.array(T.char, e.bytes.length + 1); }
        case 'Id': return C.genId(e);
        case 'Index': { const t = C.genIndexAddr(e); C.emitLoad(t); return t; }
        case 'Mem': { const t = C.genMemAddr(e); C.emitLoad(t); return C.bfValueType(t); }
        case 'Call': return C.genCall(e);
        case 'Cast': return C.genCast(e);
        case 'SizeofT': {
          const t = C.typeOfName(e.tn);
          if (t.k === 'func') { C.error(e, "invalid application of 'sizeof' to a function type"); }
          if (t.k === 'struct' && !t.complete) { C.error(e, "invalid application of 'sizeof' to incomplete type 'struct " + (t.tag || '') + "'"); }
          C.sizeCode(t); return T.ulong;
        }
        case 'SizeofE': {
          const t = C.staticTypeOf(e.e);
          if (!t) { C.pushConst(T.ulong, 1n); return T.ulong; }
          if (t.k === 'struct' && !t.complete) C.error(e, "invalid application of 'sizeof' to incomplete type 'struct " + (t.tag || '') + "'");
          C.sizeCode(t); return T.ulong;
        }
        case 'AlignofT': { const t = C.typeOfName(e.tn); C.pushConst(T.ulong, BigInt(T.alignOf(t))); return T.ulong; }
        case 'Un': return C.genUnary(e);
        case 'Post': return C.genIncDec(e, true, false);
        case 'Bin': return C.genBinary(e);
        case 'Logic': {
          const Lf = C.newLabel(), Le = C.newLabel();
          if (e.op === '&&') {
            C.cond(e.l); C.jump(OP.JZ, Lf);
            C.condBool(e.r); C.jump(OP.JMP, Le);
            C.place(Lf); C.pushInt(0); C.place(Le);
          } else {
            C.cond(e.l); C.jump(OP.JNZ, Lf);
            C.condBool(e.r); C.jump(OP.JMP, Le);
            C.place(Lf); C.pushInt(1); C.place(Le);
          }
          return T.int;
        }
        case 'Cond': return C.genCond(e);
        case 'Assign': return C.genAssign(e, false);
        case 'Comma': { C.exprDiscard(e.l); return C.expr(e.r); }
        case 'CompoundLit': { const t = C.genCompoundLit(e); C.emitLoad(t); return t; }
        case 'InitList': C.error(e, 'braced-group initializer is not allowed here'); C.pushInt(0); return T.int;
      }
      C.error(e, 'unsupported expression'); C.pushInt(0); return T.int;
    };

    /** evaluate an expression for its side effects only */
    C.exprDiscard = function (e) {
      const s = stripParen(e);
      if (s.k === 'Assign') { C.genAssign(s, true); return; }
      if (s.k === 'Post' || (s.k === 'Un' && (s.op === '++' || s.op === '--'))) { C.genIncDec(s, s.k === 'Post', true); return; }
      if (s.k === 'Comma') { C.exprDiscard(s.l); C.exprDiscard(s.r); return; }
      C.expr(s); e1(OP.POP);
    };

    C.genId = function (e) {
      if (e.name === '__func__' && C.fn && C.fn.name) {
        const bytes = Array.from(new TextEncoder().encode(C.fn.name));
        C.pushInt(C.internString(bytes)); return T.array(T.char, bytes.length + 1);
      }
      const s = C.lookup(e.name);
      if (!s) {
        // implicit function declaration is handled at the call site; anything else is an error
        C.error(e, "'" + e.name + "' undeclared (first use in this function)");
        C.pushInt(0); return T.int;
      }
      if (s.kind === 'enum') { C.pushInt(Number(BigInt.asIntN(32, s.value))); return T.int; }
      if (s.kind === 'typedef') { C.error(e, "expected expression before '" + e.name + "'"); C.pushInt(0); return T.int; }
      if (s.kind === 'func') { C.pushInt(C.funcAddr(s)); C.useFunc(s, e); return s.type; }
      // variable
      if (!C.quiet) {
        s.used = true;
        if (s.storage === 'local' && !s.assigned && !s.addrTaken && !s.noUninit && (T.isScalar(s.type))) {
          if (!s.warnedUninit) { s.warnedUninit = true; C.warn(e, "'" + e.name + "' is used uninitialized [-Wuninitialized]"); }
        }
      }
      if (s.type.k === 'array' || s.type.k === 'struct') { C.pushVarAddr(s); return s.type; }
      if (s.storage === 'local' && !s.indirect) { e1(OP.LLOAD, T.kindOf(s.type), s.off); return s.type; }
      C.pushVarAddr(s); C.emitLoad(s.type);
      return s.type;
    };

    C.genCast = function (e) {
      const to = C.typeOfName(e.tn);
      if (to.k === 'void') { C.exprDiscard(e.e); C.pushInt(0); return T.void; }
      const from = C.rv(e.e);
      if (to.k === 'struct' || to.k === 'array' || to.k === 'func') {
        if (to.k === 'struct' && from.k === 'struct' && C.sameType(to, from)) return to;
        C.error(e, 'conversion to non-scalar type requested'); return to;
      }
      if (from.k === 'struct') { C.error(e, 'aggregate value used where an integer was expected'); return to; }
      if (from.k === 'void') { C.error(e, 'void value not ignored as it ought to be'); return to; }
      if (from.k === 'float' && to.k === 'ptr') { C.error(e, 'cannot convert a floating-point value to a pointer type'); return to; }
      if (from.k === 'ptr' && to.k === 'float') { C.error(e, 'cannot convert a pointer to a floating-point type'); return to; }
      C.convert(from, to);
      return to;
    };

    // ---------- unary ----------
    C.genUnary = function (e) {
      switch (e.op) {
        case '&': {
          const inner = stripParen(e.e);
          if (inner.k === 'Id') {
            const s = C.lookup(inner.name);
            if (s && s.kind === 'var' && !C.quiet) { s.used = true; s.assigned = true; s.addrTaken = true; }
          } else if (inner.k === 'Index' || inner.k === 'Mem') {
            let b = inner; while (b && (b.k === 'Index' || b.k === 'Mem' || b.k === 'Paren')) b = b.k === 'Index' ? b.a : b.e;
            if (b && b.k === 'Id') { const s = C.lookup(b.name); if (s && s.kind === 'var' && !C.quiet) { s.used = true; s.assigned = true; s.addrTaken = true; } }
          }
          if (!C.isLvalue(inner)) { C.error(e, 'lvalue required as unary \'&\' operand'); C.pushInt(0); return T.ptr(T.int); }
          const t = C.lv(inner);
          if (t.bf) { C.error(e, "cannot take address of bit-field '" + inner.name + "'"); return T.ptr(T.int); }
          return T.ptr(t);
        }
        case '*': {
          const t = C.rv(e.e);
          if (t.k !== 'ptr') { C.error(e, "invalid type argument of unary '*' (have '" + typeStr(t) + "')"); return T.int; }
          if (t.to.k === 'void') { C.error(e, "dereferencing 'void *' pointer"); return T.int; }
          if (t.to.k === 'struct' && !t.to.complete) { C.error(e, "dereferencing pointer to incomplete type 'struct " + (t.to.tag || '') + "'"); return T.int; }
          C.emitLoad(t.to);
          return t.to;
        }
        case '++': case '--': return C.genIncDec(e, false, false);
        case '!': {
          const t = C.rv(e.e);
          if (!isScalar(t)) { C.error(e, "wrong type argument to unary exclamation mark"); return T.int; }
          e1(OP.LNOT, cn(t)); return T.int;
        }
        case '-': case '+': case '~': {
          const t = C.rv(e.e);
          if (!isScalar(t) || t.k === 'ptr') { C.error(e, "wrong type argument to unary " + (e.op === '-' ? 'minus' : e.op === '+' ? 'plus' : 'bit-complement')); return T.int; }
          if (e.op === '~' && t.k === 'float') { C.error(e, 'wrong type argument to bit-complement'); return T.int; }
          const p = T.promote(t);
          C.convert(t, p);
          if (e.op === '-') e1(OP.NEG, cn(p)); else if (e.op === '~') e1(OP.BNOT, cn(p));
          return p;
        }
      }
      C.error(e, 'unsupported unary operator'); C.pushInt(0); return T.int;
    };

    /** ++x --x x++ x-- ; when `discard` nothing is left on the stack */
    C.genIncDec = function (e, post, discard) {
      const lhs = stripParen(e.e);
      const sub = e.op === '--';
      if (!C.isLvalue(lhs)) { C.error(e, "lvalue required as " + (sub ? 'decrement' : 'increment') + ' operand'); if (!discard) C.pushInt(0); return T.int; }
      let sym = null;
      if (lhs.k === 'Id') { sym = C.lookup(lhs.name); }
      const quickLocal = sym && sym.kind === 'var' && sym.storage === 'local' && !sym.indirect && T.isScalar(sym.type);
      if (sym && sym.kind === 'var' && !C.quiet) {
        if (!sym.assigned && !sym.addrTaken && sym.storage === 'local' && !sym.warnedUninit) { sym.warnedUninit = true; C.warn(e, "'" + lhs.name + "' is used uninitialized [-Wuninitialized]"); }
        sym.assigned = true; sym.written = true;
      }
      const t = (quickLocal ? sym.type : null);
      let ty;
      const amount = (type) => {
        if (type.k === 'ptr') { C.elemSizeInt(type.to); return T.int; }
        const p = T.promote(type);
        if (p.k === 'float') C.pushConst(p, 1); else C.pushConst(p, 1n);
        return p;
      };
      const arithOp = (type) => {
        if (type.k === 'ptr') e1(sub ? OP.SUB_U : OP.ADD_U);
        else e1(CC.binOpcode(sub ? '-' : '+', cn(T.promote(type))));
      };
      if (quickLocal) {
        ty = sym.type;
        if (!isScalar(ty)) { C.error(e, 'wrong type argument to increment'); return ty; }
        if (ty.k === 'ptr' && ty.to.k === 'void') C.warn(e, 'wrong type argument to increment', 'warning');
        e1(OP.LLOAD, T.kindOf(ty), sym.off);
        if (post && !discard) e1(OP.DUP);
        const at = amount(ty);
        const p = ty.k === 'ptr' ? ty : T.promote(ty);
        arithOp(ty);
        if (ty.k !== 'ptr') C.convert(p, ty);
        if (post && !discard) e1(OP.LSTOREP, T.kindOf(ty), sym.off);
        else e1(discard ? OP.LSTOREP : OP.LSTORE, T.kindOf(ty), sym.off);
        return ty;
      }
      ty = C.lv(lhs);
      if (!isScalar(ty)) { C.error(e, 'wrong type argument to ' + (sub ? 'decrement' : 'increment')); if (!discard) { e1(OP.POP); C.pushInt(0); } else e1(OP.POP); return ty; }
      if (ty.c) C.error(e, (sub ? 'decrement' : 'increment') + ' of read-only variable' + (lhs.k === 'Id' ? " '" + lhs.name + "'" : ''));
      // stack: [addr]
      e1(OP.DUP); C.emitLoad(ty);                  // [addr, old]
      if (post && !discard) { e1(OP.DUPX1); }        // [old, addr, old]
      amount(ty);
      const p = ty.k === 'ptr' ? ty : T.promote(ty);
      arithOp(ty);
      if (ty.k !== 'ptr') C.convert(p, ty);
      if (post && !discard) { C.emitStore(ty, false); }   // [old]
      else C.emitStore(ty, !discard);
      return ty;
    };

    // ---------- binary ----------
    const CMP = new Set(['==', '!=', '<', '>', '<=', '>=']);
    C.genBinary = function (e) {
      const op = e.op;
      const lt = C.rv(e.l);
      // constants on the left of a division are fine; check right operand type next
      const rt = C.rv(e.r);
      return C.binaryTail(e, op, lt, rt);
    };
    /** both operands already on the stack (left below right) */
    C.binaryTail = function (e, op, lt, rt) {
      const bad = () => { C.error(e, "invalid operands to binary " + op + " (have '" + typeStr(lt) + "' and '" + typeStr(rt) + "')"); e1(OP.POP); e1(OP.POP); C.pushInt(0); return T.int; };
      if (lt.k === 'struct' || rt.k === 'struct' || lt.k === 'void' || rt.k === 'void') return bad();
      if (CMP.has(op)) {
        if (lt.k === 'ptr' || rt.k === 'ptr') {
          // pointer comparisons: pointer vs pointer, or pointer vs 0
          if (lt.k === 'float' || rt.k === 'float') return bad();
          if (lt.k === 'int') { if (!C.isNullConst(e.l)) C.warn(e, 'comparison between pointer and integer'); e1(OP.SWAP); C.convert(lt, T.ulong.size === 8 ? T.uint : T.uint); e1(OP.SWAP); }
          if (rt.k === 'int') { if (!C.isNullConst(e.r)) C.warn(e, 'comparison between pointer and integer'); C.convert(rt, T.uint); }
          e1(CC.cmpOpcode(op, 1));
          return T.int;
        }
        const ct = T.usual(lt, rt);
        C.balance(lt, rt, ct);
        if (ct.k === 'int' && !ct.signed && (C.isNegConst(e.l) || C.isNegConst(e.r))) C.warn(e, 'comparison of unsigned expression with a negative constant is always ' + (op === '!=' || op === '<' || op === '<=' ? 'true' : 'false') + ' [-Wtype-limits]');
        e1(CC.cmpOpcode(op, cn(ct)));
        return T.int;
      }
      if (op === '+' || op === '-') {
        if (lt.k === 'ptr' && rt.k === 'ptr') {
          if (op === '+') return bad();
          if (!T.sameNoQual(lt.to, rt.to) && lt.to.k !== 'void' && rt.to.k !== 'void') C.error(e, "invalid operands to binary - (have '" + typeStr(lt) + "' and '" + typeStr(rt) + "')");
          e1(OP.SUB_I);
          if (C.hasVLA(lt.to)) { C.elemSizeInt(lt.to); e1(OP.DIV_I); }
          else { const sz = lt.to.k === 'void' ? 1 : T.sizeOf(lt.to); if (sz !== 1) { C.pushInt(sz); e1(OP.DIV_I); } }
          e1(OP.CONV, 0 * 8 + 2);
          return T.long;
        }
        if (lt.k === 'ptr' && rt.k === 'int') {
          if (lt.to.k === 'void') C.warn(e, "pointer of type 'void *' used in arithmetic [-Wpointer-arith]");
          if (lt.to.k === 'func') C.warn(e, 'arithmetic on a pointer to a function [-Wpointer-arith]');
          C.toIndex(rt); C.scaleIndex(lt.to.k === 'void' ? T.char : lt.to); e1(op === '+' ? OP.ADD_U : OP.SUB_U); return lt;
        }
        if (lt.k === 'int' && rt.k === 'ptr' && op === '+') {
          // [int, ptr] -> scale the int below
          e1(OP.SWAP); C.toIndex(lt); C.scaleIndex(rt.to.k === 'void' ? T.char : rt.to); e1(OP.ADD_U); return rt;
        }
        if (lt.k === 'ptr' || rt.k === 'ptr') return bad();
      } else if (lt.k === 'ptr' || rt.k === 'ptr') return bad();

      if (op === '<<' || op === '>>') {
        if (lt.k !== 'int' || rt.k !== 'int') return bad();
        const pl = T.promote(lt), pr = T.promote(rt);
        if (!C.quiet && C.constInt(e.r) !== null) {
          const sh = C.constInt(e.r);
          if (sh < 0n) C.warn(e, (op === '<<' ? 'left' : 'right') + ' shift count is negative [-Wshift-count-negative]');
          else if (sh >= BigInt(pl.size * 8)) C.warn(e, (op === '<<' ? 'left' : 'right') + ' shift count >= width of type [-Wshift-count-overflow]');
        }
        // convert the count (top) to the left operand's class, then the left to its promoted type
        C.convert(rt, pr);
        const lc = cn(pl), rc = cn(pr);
        if (lc !== rc) e1(OP.CONV, rc * 8 + lc);
        if (!(pl === lt || (lt.k === 'int' && lt.size >= 4))) { e1(OP.SWAP); C.convert(lt, pl); e1(OP.SWAP); }
        e1(CC.binOpcode(op, lc));
        return pl;
      }
      if (!isScalar(lt) || !isScalar(rt)) return bad();
      const ct = T.usual(lt, rt);
      if ((op === '%' || op === '&' || op === '|' || op === '^') && ct.k === 'float') return bad();
      if ((op === '/' || op === '%') && !C.quiet) {
        const z = C.constVal(stripParen(e.r));
        if (z && z.k === 'int' && z.v === 0n) C.warn(e, 'division by zero [-Wdiv-by-zero]');
      }
      C.balance(lt, rt, ct);
      if (ct.k === 'float') {
        const c = cn(ct);
        e1(CC.binOpcode(op, c === 4 ? 4 : 5));
      } else e1(CC.binOpcode(op, cn(ct)));
      return ct;
    };
    C.isNegConst = function (e) { const v = C.constVal(stripParen(e)); return !!(v && v.k === 'int' && v.v < 0n && v.t.signed); };
    /** convert left (below) and right (top) operands to ct */
    C.balance = function (lt, rt, ct) {
      C.convert(rt, ct);
      if (cn(lt) !== cn(ct)) {
        e1(OP.SWAP); C.convert(lt, ct); e1(OP.SWAP);
      }
    };

    C.genCond = function (e) {
      const Lf = C.newLabel(), Le = C.newLabel();
      C.cond(e.c); C.jump(OP.JZ, Lf);
      const a = C.rv(e.a);
      const convA = C.code.length; e1(OP.CONV, 0);            // placeholder: patched once the result type is known
      C.jump(OP.JMP, Le);
      C.place(Lf);
      const b = C.rv(e.b);
      let rt;
      if (isScalar(a) && isScalar(b) && a.k !== 'ptr' && b.k !== 'ptr') rt = T.usual(a, b);
      else if (a.k === 'ptr' && b.k === 'ptr') rt = (a.to.k === 'void' ? b : a);
      else if (a.k === 'ptr' && C.isNullConst(e.b)) rt = a;
      else if (b.k === 'ptr' && C.isNullConst(e.a)) rt = b;
      else if (a.k === 'ptr' && b.k === 'int') { rt = a; C.warn(e, 'pointer/integer type mismatch in conditional expression'); }
      else if (b.k === 'ptr' && a.k === 'int') { rt = b; C.warn(e, 'pointer/integer type mismatch in conditional expression'); }
      else if (a.k === 'struct' && b.k === 'struct' && C.sameType(a, b)) rt = a;
      else if (a.k === 'void' && b.k === 'void') rt = T.void;
      else { C.error(e, 'type mismatch in conditional expression'); rt = a; }
      if (isScalar(b) && isScalar(rt)) {
        C.convert(b, rt);
        // patch A's conversion
        if (isScalar(a) && cn(a) !== cn(rt)) C.code[convA + 1] = cn(a) * 8 + cn(rt);
        else if (isScalar(a)) C.code[convA + 1] = 0;
      }
      C.place(Le);
      return rt;
    };

    // ---------- assignment ----------
    const COMPOUND = { '+=': '+', '-=': '-', '*=': '*', '/=': '/', '%=': '%', '&=': '&', '|=': '|', '^=': '^', '<<=': '<<', '>>=': '>>' };
    C.genAssign = function (e, discard) {
      const lhs = stripParen(e.l);
      if (!C.isLvalue(lhs)) { C.error(e, 'lvalue required as left operand of assignment'); C.rv(e.r); if (discard) e1(OP.POP); return T.int; }
      let sym = null;
      if (lhs.k === 'Id') sym = C.lookup(lhs.name);
      const isVar = sym && sym.kind === 'var';
      if (e.op === '=') {
        // peek at the destination type without emitting code
        const lt = C.staticTypeOf(lhs);
        if (lt && lt.k === 'array') { C.error(e, 'assignment to expression with array type'); C.rv(e.r); if (discard) e1(OP.POP); return lt; }
        if (lt && lt.c && !(lt.k === 'struct' && false)) C.error(e, 'assignment of read-only ' + (lhs.k === 'Id' ? "variable '" + lhs.name + "'" : lhs.k === 'Mem' ? "member '" + lhs.name + "'" : 'location'));
        if (lt && lt.k === 'struct') {
          C.lv(lhs);
          const rt = C.rv(e.r);
          if (!C.checkAssign(lt, rt, e.r, { kind: 'assign' })) { e1(OP.POP); if (discard) e1(OP.POP); return lt; }
          e1(OP.MEMCPY, T.sizeOf(lt));
          if (discard) e1(OP.POP);
          if (isVar && !C.quiet) { sym.assigned = true; sym.written = true; }
          return lt;
        }
        if (lt && isVar && sym.storage === 'local' && !sym.indirect && isScalar(lt)) {
          C.rvTo(e.r, lt, { kind: 'assign' });
          if (!C.quiet) { sym.assigned = true; sym.written = true; }
          e1(discard ? OP.LSTOREP : OP.LSTORE, T.kindOf(lt), sym.off);
          return T.unqual(lt);
        }
        const t = C.lv(lhs);
        C.rvTo(e.r, t, { kind: 'assign' });
        if (isVar && !C.quiet) { sym.assigned = true; sym.written = true; }
        C.emitStore(t, !discard);
        return T.unqual(t);
      }
      // compound assignment
      const op = COMPOUND[e.op];
      if (isVar && !C.quiet) {
        if (!sym.assigned && !sym.addrTaken && sym.storage === 'local' && !sym.warnedUninit) { sym.warnedUninit = true; C.warn(e, "'" + lhs.name + "' is used uninitialized [-Wuninitialized]"); }
        sym.assigned = true; sym.written = true;
      }
      const lt0 = C.staticTypeOf(lhs);
      if (lt0 && lt0.c) C.error(e, 'assignment of read-only ' + (lhs.k === 'Id' ? "variable '" + lhs.name + "'" : 'location'));
      const fastLocal = !!(isVar && sym.storage === 'local' && !sym.indirect && lt0 && isScalar(lt0));
      const t = fastLocal ? lt0 : C.lv(lhs);
      if (!isScalar(t)) { C.error(e, "invalid operands to binary " + op); e1(OP.POP); C.rv(e.r); e1(OP.POP); if (!discard) C.pushInt(0); return t; }
      const finish = () => { if (fastLocal) e1(discard ? OP.LSTOREP : OP.LSTORE, T.kindOf(t), sym.off); else C.emitStore(t, !discard); };
      if (fastLocal) e1(OP.LLOAD, T.kindOf(t), sym.off); else { e1(OP.DUP); C.emitLoad(t); }   // [addr, cur] or [cur]
      const rt = C.rv(e.r);                               // [addr, cur, rhs]
      let res;
      if (t.k === 'ptr' && (op === '+' || op === '-')) {
        if (rt.k !== 'int') { C.error(e, 'invalid operands to binary ' + op); e1(OP.POP); e1(OP.POP); res = t; }
        else { C.toIndex(rt); C.scaleIndex(t.to.k === 'void' ? T.char : t.to); e1(op === '+' ? OP.ADD_U : OP.SUB_U); res = t; }
        finish();
        return T.unqual(t);
      }
      res = C.binaryTail(e, op, t, rt);              // [addr, result of type res]
      C.convert(res, t);
      finish();
      return T.unqual(t);
    };

    // ---------- calls ----------
    function hasSideEffect(n) {
      if (!n || typeof n !== 'object') return false;
      if (Array.isArray(n)) return n.some(hasSideEffect);
      if (n.k === 'Assign' || n.k === 'Post' || n.k === 'Call' || (n.k === 'Un' && (n.op === '++' || n.op === '--'))) return true;
      if (n.k === 'SizeofE' || n.k === 'SizeofT') return false;
      for (const key of Object.keys(n)) { if (key === 'spec' || key === 'bytes') continue; const v = n[key]; if (v && typeof v === 'object' && hasSideEffect(v)) return true; }
      return false;
    }
    C.genCall = function (e) {
      const callee = stripParen(e.f);
      let sym = null, ftype = null, direct = false, name = null;
      if (callee.k === 'Id') {
        sym = C.lookup(callee.name);
        name = callee.name;
        if (!sym) {
          // implicit declaration, gcc style
          sym = C.implicitFunc(callee, e);
        }
        if (sym && sym.kind === 'func') { direct = true; ftype = sym.type; C.useFunc(sym, callee); }
        else if (sym && sym.kind === 'var') { /* function pointer variable */ }
        else if (sym) { C.error(e, "called object '" + callee.name + "' is not a function or function pointer"); C.pushInt(0); return T.int; }
      }
      let tmpSlot = null;
      if (!direct) {
        const ct = C.rv(callee);
        if (ct.k === 'ptr' && ct.to.k === 'func') ftype = ct.to;
        else { C.error(e, "called object is not a function or function pointer"); e1(OP.POP); C.pushInt(0); return T.int; }
        tmpSlot = C.allocFrame(8, 8);
        e1(OP.LSTOREP, 10, tmpSlot);
      }
      const params = ftype.params;
      const fname = name || 'function';
      if (!ftype.unspecified) {
        if (e.args.length < params.length) { C.error(e, "too few arguments to function '" + fname + "'"); }
        else if (e.args.length > params.length && !ftype.variadic) { C.error(e, "too many arguments to function '" + fname + "'"); }
      }
      let argc = 0;
      const argTypes = [];
      // user-defined variadic functions receive the extra arguments in a caller-side buffer (8-byte slots) via a hidden last parameter
      const userVariadic = !!ftype.variadic && !(direct && sym && CC.libc.isBuiltin(sym.name));
      let vaArea = -1;
      const retStruct = ftype.ret.k === 'struct';
      if (retStruct) {
        const tmp = C.allocFrame(Math.max(T.sizeOf(ftype.ret), 1), Math.max(T.alignOf(ftype.ret), 1));
        e1(OP.LEAL, tmp); argc++;
      }
      // gcc evaluates call arguments right to left. Programs like printf("%d %d", i++, i++) depend on it, so when an
      // argument has side effects we do the same (evaluate last-to-first into temporaries, then push in order).
      if (e.args.length >= 2 && !userVariadic && !params.some(p => p.k === 'struct') && e.args.some(hasSideEffect)) {
        // like gcc: arguments with side effects run first (last to first); plain reads happen afterwards
        const evalArg = (i) => {      // leaves the converted value on the stack and returns its memory kind
          const a = e.args[i];
          const at = C.rv(a);
          argTypes[i] = at;
          if (i < params.length) {
            if (C.checkAssign(params[i], at, a, { kind: 'arg', n: i + 1, fname })) C.convert(at, params[i]);
            return T.kindOf(params[i]);
          }
          if (at.k === 'struct') { C.error(a, 'passing a struct to a variadic function is not supported'); return 6; }
          if (at.k === 'void') { C.error(a, 'void value not ignored as it ought to be'); return 6; }
          if (at.k === 'int') { const pr = T.promote(at); C.convert(at, pr); return T.kindOf(pr); }
          return at.k === 'float' ? 9 : 10;
        };
        const slots = [];
        for (let i = e.args.length - 1; i >= 0; i--) {
          if (!hasSideEffect(e.args[i])) continue;
          const kind = evalArg(i);
          const off = C.allocFrame(8, 8);
          e1(OP.LSTOREP, kind, off);
          slots[i] = { kind, off };
        }
        for (let i = 0; i < e.args.length; i++) {
          if (slots[i]) e1(OP.LLOAD, slots[i].kind, slots[i].off); else evalArg(i);
          argc++;
        }
      } else
      for (let i = 0; i < e.args.length; i++) {
        const a = e.args[i];
        if (i < params.length) {
          const pt = params[i];
          if (pt.k === 'struct') {
            const tmp = C.allocFrame(Math.max(T.sizeOf(pt), 1), Math.max(T.alignOf(pt), 1));
            e1(OP.LEAL, tmp);
            const at = C.rv(a);
            if (!C.checkAssign(pt, at, a, { kind: 'arg', n: i + 1, fname })) { e1(OP.POP); }
            else e1(OP.MEMCPY, T.sizeOf(pt));
            argTypes.push(at);
          } else {
            const at = C.rv(a);
            argTypes.push(at);
            if (C.checkAssign(pt, at, a, { kind: 'arg', n: i + 1, fname })) C.convert(at, pt);
          }
        } else if (userVariadic) {
          if (vaArea < 0) vaArea = C.allocFrame(8 * Math.max(1, e.args.length - params.length), 8);
          e1(OP.LEAL, vaArea + 8 * (i - params.length));
          const at = C.rv(a);
          argTypes.push(at);
          let kind = 6;
          if (at.k === 'struct') { C.error(a, 'passing a struct to a variadic function is not supported'); e1(OP.POP); e1(OP.POP); continue; }
          else if (at.k === 'void') { C.error(a, 'void value not ignored as it ought to be'); e1(OP.POP); e1(OP.POP); continue; }
          else if (at.k === 'int') C.convert(at, T.promote(at));
          else if (at.k === 'float') kind = 9;
          else kind = 10;
          e1(OP.STOREP, kind);
          continue;
        } else {
          // default argument promotions
          const at = C.rv(a);
          argTypes.push(at);
          if (at.k === 'struct') {
            const tmp = C.allocFrame(Math.max(T.sizeOf(at), 1), Math.max(T.alignOf(at), 1));
            C.error(a, 'passing a struct to a variadic function is not supported');
          } else if (at.k === 'void') { C.error(a, 'void value not ignored as it ought to be'); }
          else if (at.k === 'int') C.convert(at, T.promote(at));
          else if (at.k === 'float' && at.size === 4) { /* float -> double is a no-op on the value stack */ }
        }
        argc++;
      }
      if (userVariadic) { if (vaArea < 0) vaArea = C.allocFrame(8, 8); e1(OP.LEAL, vaArea); argc++; }
      if (direct && sym && C.checkFormat && !C.quiet) C.checkFormat(e, sym.name, ftype, argTypes);
      if (direct) {
        const at = C.emit(OP.CALL, sym.idx, argc);
        C.fixups.push({ pc: at, sym, argc, line: e.line });
      } else {
        e1(OP.LLOAD, 10, tmpSlot);
        e1(OP.CALLI, argc);
      }
      return ftype.ret;
    };
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
