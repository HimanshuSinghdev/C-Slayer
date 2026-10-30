/* C-Slayer · compiler: declarations, statements, function bodies. */
(function (g) {
  'use strict';
  const CC = g.CC = g.CC || {};
  const T = CC.T, OP = CC.OP, MEM = CC.MEM;

  CC.installStmt = function (C) {
    const e1 = (op, a, b) => C.emit(op, a, b);
    const typeStr = (t) => T.name(t);
    const stripParen = (e) => { while (e.k === 'Paren') e = e.e; return e; };

    // ---------- frame ----------
    C.allocFrame = function (size, align) {
      const fn = C.fn;
      fn.frame = C.alignUp(fn.frame, Math.max(align || 1, 1));
      const off = fn.frame;
      fn.frame += Math.max(size, 0);
      return off;
    };
    /** local array: red zone before and after so out-of-bounds accesses are caught */
    C.allocArrayFrame = function (size, align, name) {
      const fn = C.fn;
      fn.frame = C.alignUp(fn.frame + 16, 16);
      const off = fn.frame;
      fn.redzones.push({ off: off - 16, len: 16, side: 'before', name, arrSize: size });
      fn.redzones.push({ off: off + size, len: 16, side: 'after', name, arrSize: size });
      fn.frame = C.alignUp(off + size + 16, 8);
      return off;
    };

    // ---------- function symbols ----------
    C.declareFunction = function (name, type, line, node) {
      let s = C.scopes[0].get(name);
      if (s) {
        if (s.kind !== 'func') { C.error(node || { line }, "'" + name + "' redeclared as different kind of symbol"); return s; }
        if (!type.unspecified && (s.type.unspecified || !s.type.pinfo)) { s.type = type; }
        else if (!s.type.unspecified && !type.unspecified && !T.same(s.type, type)) {
          C.error(node || { line }, "conflicting types for '" + name + "'; have '" + typeStr(type) + "'");
        }
        return s;
      }
      const idx = C.funcs.length;
      const rec = { name, idx, entry: undefined, redzones: [], frameSize: 0, line };
      C.funcs.push(rec);
      s = { kind: 'func', name, type, idx, defined: false, line, rec };
      C.scopes[0].set(name, s);
      return s;
    };
    C.implicitFunc = function (idNode, callNode) {
      const name = idNode.name;
      C.implicit.add(name);
      const hdr = CC.libc && CC.libc.headerOf ? CC.libc.headerOf(name) : null;
      C.warn(idNode, "implicit declaration of function '" + name + "'" + (hdr ? '; did you forget #include <' + hdr + '>?' : '') + ' [-Wimplicit-function-declaration]');
      const t = T.func(T.int, [], false, true);
      const s = C.declareFunction(name, t, idNode.line, idNode);
      s.implicit = true;
      return s;
    };

    // ---------- initializers ----------
    C.genLocalInit = function (off, type, init, node) {
      const isAgg = type.k === 'struct' || type.k === 'array';
      if (!isAgg || (init.k !== 'InitList' && !(type.k === 'array' && stripParen(init).k === 'Str'))) {
        if (type.k === 'struct') {
          e1(OP.LEAL, off);
          const rt = C.rv(init);
          if (!C.checkAssign(type, rt, init, { kind: 'init' })) { e1(OP.POP); e1(OP.POP); return; }
          e1(OP.MEMCPY, T.sizeOf(type)); e1(OP.POP);
          return;
        }
        if (type.k === 'array') { C.error(init, 'invalid initializer'); return; }
        C.rvTo(init, type, { kind: 'init' });
        e1(OP.LSTOREP, T.kindOf(type), off);
        return;
      }
      // aggregate: clear, then store what was given
      e1(OP.LEAL, off); e1(OP.MEMZERO, T.sizeOf(type));
      C.walkInit(type, init, function (t, boff, expr, kind) {
        if (kind === 'str') {
          const bytes = expr.bytes; const n = Math.min(bytes.length + 1, t.n === null ? bytes.length + 1 : t.n);
          if (t.n !== null && bytes.length > t.n) C.warn(expr, 'initializer-string for array of chars is too long');
          e1(OP.LEAL, off + boff); C.pushInt(C.internString(bytes)); e1(OP.MEMCPY, n); e1(OP.POP);
        } else if (kind === 'struct') {
          e1(OP.LEAL, off + boff);
          const rt = C.rv(expr);
          if (!C.checkAssign(t, rt, expr, { kind: 'init' })) { e1(OP.POP); e1(OP.POP); return; }
          e1(OP.MEMCPY, T.sizeOf(t)); e1(OP.POP);
        } else {
          if (!T.isScalar(t)) { C.error(expr, 'invalid initializer'); return; }
          C.rvTo(expr, t, { kind: 'init' });
          e1(OP.LSTOREP, T.kindOf(t), off + boff);
        }
      }, node);
    };

    C.staticInit = function (addr, type, init, node) {
      C.walkInit(type, init, function (t, boff, expr, kind) {
        const a = addr + boff;
        if (kind === 'str') {
          const bytes = expr.bytes; const max = t.n === null ? bytes.length + 1 : t.n;
          if (bytes.length > max) C.warn(expr, 'initializer-string for array of chars is too long');
          for (let i = 0; i < Math.min(bytes.length + 1, max); i++) C.gdata[a - C.globalBase + i] = i < bytes.length ? bytes[i] & 255 : 0;
          return;
        }
        if (kind === 'struct') { C.error(expr, 'initializer element is not constant'); return; }
        const r = C.evalStatic(expr, t);
        if (!r) { C.error(expr, 'initializer element is not constant'); return; }
        if (t.k === 'float') {
          const v = r.k === 'float' ? r.v : r.k === 'int' ? Number(r.v) : null;
          if (v === null) { C.error(expr, 'initializer element is not computable at load time'); return; }
          C.gwriteF(a, t.size === 16 ? 8 : t.size, t.size === 4 ? Math.fround(v) : v);
        } else if (t.k === 'ptr') {
          if (r.k === 'float') { C.error(expr, 'initializer element is not computable at load time'); return; }
          C.gwrite(a, 8, r.k === 'addr' ? BigInt(r.v) : r.v);
        } else if (t.k === 'int') {
          if (r.k === 'addr') { if (t.size === 8) C.gwrite(a, 8, BigInt(r.v)); else C.error(expr, 'initializer element is not computable at load time'); return; }
          let v = r.k === 'float' ? BigInt(Math.trunc(r.v)) : r.v;
          if (t.isBool) v = v !== 0n ? 1n : 0n;
          C.gwrite(a, t.size, v);
        } else C.error(expr, 'invalid initializer');
      }, node);
    };

    // ---------- declarations ----------
    C.declareGlobalVar = function (name, type, item, spec, node) {
      let s = C.scopes[0].get(name);
      if (s && s.kind !== 'var') { C.error(node, "'" + name + "' redeclared as different kind of symbol"); return null; }
      if (type.k === 'func') return null;
      if (s) {
        if (!T.same(T.unqual(s.type), T.unqual(type)) && !(s.type.k === 'array' && type.k === 'array' && (s.type.n === null || type.n === null))) {
          C.error(node, "conflicting types for '" + name + "'; have '" + typeStr(type) + "'");
        }
        if (s.type.k === 'array' && s.type.n === null && type.k === 'array' && type.n !== null) { /* completed later */ }
        if (item.init && s.hasInit) { C.error(node, "redefinition of '" + name + "'"); return s; }
        return s;
      }
      return null;
    };

    C.genGlobalDecl = function (node) {
      const spec = node.spec;
      const base = C.baseType(spec);
      if (!node.items.length) return;   // struct/enum declaration only
      for (const item of node.items) {
        const r = C.applyDeclarator(base, item.decl);
        const name = r.name; let type = r.type;
        if (!name) continue;
        const nnode = { line: item.line || node.line, col: item.decl.col };
        if (spec.storage === 'typedef') {
          const prev = C.scopes[0].get(name);
          if (prev && !(prev.kind === 'typedef' && T.same(prev.type, type))) C.error(nnode, "redefinition of typedef '" + name + "'");
          C.declareSym(name, { kind: 'typedef', type, line: nnode.line });
          continue;
        }
        if (type.k === 'func') {
          const s = C.declareFunction(name, type, nnode.line, nnode);
          if (spec.storage === 'static') s.isStatic = true;
          continue;
        }
        if (item.init) type = C.completeArray(type, item.init);
        let s = C.declareGlobalVar(name, type, item, spec, nnode);
        if (type.k === 'struct' && !type.complete && spec.storage !== 'extern') { C.error(nnode, "storage size of '" + name + "' isn't known"); continue; }
        if (type.k === 'array' && type.n === null && !type.vla && spec.storage !== 'extern' && !item.init) { type = T.array(type.of, 1); C.warn(nnode, "array '" + name + "' assumed to have one element"); }
        if (type.vla) { C.error(nnode, 'variably modified \'' + name + '\' at file scope'); continue; }
        if (!s) {
          const size = Math.max(T.sizeOf(type), 1);
          const addr = type.k === 'array' ? C.allocGlobal(size, T.alignOf(type), { name }) : C.allocGlobal(size, T.alignOf(type));
          s = C.declareSym(name, { kind: 'var', name, type, storage: 'global', addr, line: nnode.line, used: true, assigned: true });
        } else if (s.type.k === 'array' && s.type.n === null && type.k === 'array' && type.n !== null) {
          s.type = type;
        }
        if (item.init) {
          s.hasInit = true;
          C.staticInit(s.addr, type, item.init, nnode);
        }
        if (spec.storage === 'static') s.isStatic = true;
      }
    };

    C.genLocalDecl = function (node) {
      const spec = node.spec;
      const base = C.baseType(spec);
      for (const item of node.items) {
        const r = C.applyDeclarator(base, item.decl);
        const name = r.name; let type = r.type;
        if (!name) continue;
        const nnode = { line: item.line || node.line, col: item.decl.col };
        const cur = C.scopes[C.scopes.length - 1];
        if (spec.storage === 'typedef') { C.declareSym(name, { kind: 'typedef', type, line: nnode.line }); continue; }
        if (type.k === 'func') {
          const s = C.declareFunction(name, type, nnode.line, nnode);
          continue;
        }
        const prev = cur.get(name);
        if (prev && prev.kind !== 'enum' && !(spec.storage === 'extern')) C.error(nnode, "redeclaration of '" + name + "' with no linkage");
        if (spec.storage === 'extern') {
          let s = C.scopes[0].get(name);
          if (!s) {
            const size = Math.max(T.sizeOf(type), 1);
            const addr = type.k === 'array' ? C.allocGlobal(size, T.alignOf(type), { name }) : C.allocGlobal(size, T.alignOf(type));
            s = { kind: 'var', name, type, storage: 'global', addr, line: nnode.line, used: true, assigned: true };
            C.scopes[0].set(name, s);
          }
          cur.set(name, s);
          continue;
        }
        if (item.init) type = C.completeArray(type, item.init);
        if (type.k === 'struct' && !type.complete) { C.error(nnode, "storage size of '" + name + "' isn't known"); continue; }
        if (type.k === 'array' && type.n === null && !type.vla) { C.error(nnode, "array size missing in '" + name + "'"); type = T.array(type.of, 1); }
        if (spec.storage === 'static') {
          const size = Math.max(T.sizeOf(type), 1);
          const addr = type.k === 'array' ? C.allocGlobal(size, T.alignOf(type), { name }) : C.allocGlobal(size, T.alignOf(type));
          const s = C.declareSym(name, { kind: 'var', name, type, storage: 'static', addr, line: nnode.line, used: false, assigned: true, isStaticLocal: true });
          if (item.init) C.staticInit(addr, type, item.init, nnode);
          continue;
        }
        let s;
        if (type.k === 'array' && type.vla) {
          if (item.init) C.error(nnode, 'variable-sized object may not be initialized');
          C.materializeVLA(type);
          const slot = C.allocFrame(8, 8);
          s = C.declareSym(name, { kind: 'var', name, type, storage: 'local', off: slot, indirect: true, vla: true, line: nnode.line, used: false, assigned: true, noUninit: true });
          C.sizeCode(type);
          e1(OP.ALLOCA, 1);
          e1(OP.LSTOREP, 10, slot);
          continue;
        }
        const size = Math.max(T.sizeOf(type), 1);
        const off = type.k === 'array' ? C.allocArrayFrame(size, T.alignOf(type), name) : C.allocFrame(size, T.alignOf(type));
        s = C.declareSym(name, { kind: 'var', name, type, storage: 'local', off, line: nnode.line, used: false, assigned: !!item.init, noUninit: type.k === 'array' || type.k === 'struct' });
        s.localDecl = true;
        if (item.init) C.genLocalInit(off, type, item.init, nnode);
      }
    };

    // ---------- statements ----------
    C.newLoop = function (isSwitch) { return { breakL: C.newLabel(), contL: isSwitch ? null : C.newLabel(), isSwitch }; };

    /** conservative "this statement never falls through" check for missing-return warnings */
    function alwaysReturns(s) {
      if (!s) return false;
      switch (s.k) {
        case 'Return': case 'Goto': return true;
        case 'Block': { for (const it of s.items) if (alwaysReturns(it)) return true; return false; }
        case 'If': return !!s.b && alwaysReturns(s.a) && alwaysReturns(s.b);
        case 'Label': return alwaysReturns(s.s);
        case 'While': case 'For': case 'DoWhile': {
          const c = s.c ? C.constVal(stripParen(s.c)) : { k: 'int', v: 1n };
          const infinite = !s.c || (c && c.k === 'int' && c.v !== 0n);
          if (!infinite) return s.k === 'DoWhile' && alwaysReturns(s.body);
          return !hasBreak(s.body);
        }
        case 'Switch': {
          let hasDefault = false;
          (function walk(n) { if (!n) return; if (n.k === 'Default') hasDefault = true; if (n.k === 'Block') n.items.forEach(walk); if (n.k === 'Label') walk(n.s); })(s.body);
          if (!hasDefault || hasBreak(s.body, true)) return false;
          const items = s.body.k === 'Block' ? s.body.items : [s.body];
          return alwaysReturns(items[items.length - 1]) || items.some(alwaysReturns);
        }
        case 'ExprStmt': {
          const e = stripParen(s.e);
          if (e.k === 'Call' && stripParen(e.f).k === 'Id' && ['exit', 'abort', '_Exit', 'quick_exit', '__assert_fail'].includes(stripParen(e.f).name)) return true;
          return false;
        }
      }
      return false;
    }
    function hasBreak(s, inSwitch) {
      if (!s) return false;
      switch (s.k) {
        case 'Break': return true;
        case 'Block': return s.items.some(x => hasBreak(x, inSwitch));
        case 'If': return hasBreak(s.a, inSwitch) || hasBreak(s.b, inSwitch);
        case 'Label': return hasBreak(s.s, inSwitch);
        case 'While': case 'For': case 'DoWhile': case 'Switch': return false; // breaks inside belong to the inner construct
      }
      return false;
    }
    C.alwaysReturns = alwaysReturns;

    function noEffect(e) {
      e = stripParen(e);
      switch (e.k) {
        case 'Num': case 'Chr': case 'Str': case 'Id': case 'SizeofT': case 'SizeofE': return true;
        case 'Bin': return true;
        case 'Logic': return noEffect(e.r) && false;
        case 'Un': return !['++', '--', '*'].includes(e.op) ? true : e.op === '*';
        case 'Cast': return false;
        case 'Index': case 'Mem': return true;
        case 'Cond': return noEffect(e.a) && noEffect(e.b);
      }
      return false;
    }

    C.genStmt = function (s) {
      C.line = s.line || C.line;
      C.curNode = s;
      switch (s.k) {
        case 'Empty': return;
        case 'StaticAssert': {
          const v = C.constInt(s.c);
          if (v === null) C.error(s, 'expression in static assertion is not constant');
          else if (v === 0n) C.error(s, 'static assertion failed' + (s.msg ? ': "' + s.msg + '"' : ''));
          return;
        }
        case 'Block': {
          C.pushScope();
          C.genBlockItems(s.items);
          C.closeScope();
          return;
        }
        case 'Decl': C.genLocalDecl(s); return;
        case 'ExprStmt': {
          const e = stripParen(s.e);
          if (noEffect(e) && !C.quiet) C.warn(s, 'statement with no effect [-Wunused-value]');
          else if (e.k === 'Bin' && false) { /* unreachable */ }
          C.exprDiscard(s.e);
          return;
        }
        case 'If': {
          if (stripParen(s.c) === s.c && s.c.k === 'Assign' && s.c.op === '=') C.warn(s.c, 'suggest parentheses around assignment used as truth value [-Wparentheses]');
          const Lelse = C.newLabel(), Lend = C.newLabel();
          C.cond(s.c); C.jump(OP.JZ, Lelse);
          C.genScoped(s.a);
          if (s.b) { C.jump(OP.JMP, Lend); C.place(Lelse); C.genScoped(s.b); C.place(Lend); }
          else C.place(Lelse);
          return;
        }
        case 'While': {
          if (s.c.k === 'Assign' && s.c.op === '=') C.warn(s.c, 'suggest parentheses around assignment used as truth value [-Wparentheses]');
          const lp = C.newLoop(false); const Ltop = lp.contL;
          C.place(Ltop);
          C.cond(s.c); C.jump(OP.JZ, lp.breakL);
          C.loops.push(lp); C.genScoped(s.body); C.loops.pop();
          C.jump(OP.JMP, Ltop);
          C.place(lp.breakL);
          return;
        }
        case 'DoWhile': {
          const lp = C.newLoop(false); const Ltop = C.newLabel();
          C.place(Ltop);
          C.loops.push(lp); C.genScoped(s.body); C.loops.pop();
          C.place(lp.contL);
          C.cond(s.c); C.jump(OP.JNZ, Ltop);
          C.place(lp.breakL);
          return;
        }
        case 'For': {
          C.pushScope();
          if (s.init) { if (s.init.k === 'Decl') C.genLocalDecl(s.init); else C.genStmt(s.init); }
          const lp = C.newLoop(false); const Ltop = C.newLabel();
          C.place(Ltop);
          if (s.c) { C.cond(s.c); C.jump(OP.JZ, lp.breakL); }
          C.loops.push(lp); C.genScoped(s.body); C.loops.pop();
          C.place(lp.contL);
          if (s.step) C.exprDiscard(s.step);
          C.jump(OP.JMP, Ltop);
          C.place(lp.breakL);
          C.closeScope();
          return;
        }
        case 'Switch': return C.genSwitch(s);
        case 'Case': case 'Default': return C.genCase(s);
        case 'Break': {
          const lp = C.loops[C.loops.length - 1];
          if (!lp) { C.error(s, 'break statement not within loop or switch'); return; }
          C.jump(OP.JMP, lp.breakL); return;
        }
        case 'Continue': {
          let lp = null;
          for (let i = C.loops.length - 1; i >= 0; i--) if (!C.loops[i].isSwitch) { lp = C.loops[i]; break; }
          if (!lp) { C.error(s, 'continue statement not within a loop'); return; }
          C.jump(OP.JMP, lp.contL); return;
        }
        case 'Return': return C.genReturn(s);
        case 'Goto': {
          const l = C.fn.labels.get(s.label) || (C.fn.labels.set(s.label, { label: C.newLabel(), defined: false, line: s.line, name: s.label }), C.fn.labels.get(s.label));
          C.jump(OP.JMP, l.label); l.used = true; return;
        }
        case 'Label': {
          let l = C.fn.labels.get(s.name);
          if (!l) { l = { label: C.newLabel(), defined: false, line: s.line, name: s.name }; C.fn.labels.set(s.name, l); }
          if (l.defined) C.error(s, "duplicate label '" + s.name + "'");
          l.defined = true; l.line = s.line;
          C.place(l.label);
          C.genStmt(s.s);
          return;
        }
      }
      C.error(s, 'unsupported statement');
    };
    /** a sub-statement of if/while/for gets its own scope when it is a declaration-free single statement */
    C.genScoped = function (s) { C.genStmt(s); };

    C.genBlockItems = function (items) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        C.genStmt(it);
        C.checkIndent(it, items[i + 1]);
      }
    };
    /** gcc -Wmisleading-indentation: `if (x) a();  b();` where b() is indented like it was guarded */
    C.checkIndent = function (s, nxt) {
      if (!nxt || C.quiet || !(s.k === 'If' || s.k === 'While' || s.k === 'For')) return;
      const body = s.k === 'If' ? (s.b || s.a) : s.body;
      if (!body || body.k === 'Block' || body.k === 'Empty') return;
      if (!body.col || !nxt.col || !body.line || !nxt.line) return;
      if (nxt.line > body.line && nxt.col === body.col && body.line > s.line && nxt.col > s.col) {
        C.warn(nxt, "this statement is indented as if it were guarded by the '" + (s.k === 'If' ? (s.b ? 'else' : 'if') : s.k === 'While' ? 'while' : 'for') + "' on line " + s.line + ", but it is not [-Wmisleading-indentation]");
      }
    };

    C.closeScope = function () {
      const scope = C.scopes[C.scopes.length - 1];
      if (!C.sys && !C.quiet) {
        for (const [name, s] of scope) {
          if (s.kind === 'var' && s.localDecl && !s.used && !s.isParam) {
            if (s.written) C.warn({ line: s.line }, "variable '" + name + "' set but not used [-Wunused-but-set-variable]");
            else C.warn({ line: s.line }, "unused variable '" + name + "' [-Wunused-variable]");
          }
        }
      }
      C.popScope();
    };

    C.genReturn = function (s) {
      const fn = C.fn; const ret = fn.ret;
      if (s.e) {
        if (ret.k === 'void') {
          const t = C.rv(s.e);
          if (t.k !== 'void') C.warn(s, "'return' with a value, in function returning void [-Wreturn-mismatch]");
          e1(OP.POP); C.pushInt(0);
        } else if (ret.k === 'struct') {
          e1(OP.LLOAD, 10, fn.retbuf);
          const t = C.rv(s.e);
          if (!C.checkAssign(ret, t, s.e, { kind: 'return' })) { e1(OP.POP); }
          else e1(OP.MEMCPY, T.sizeOf(ret));
        } else {
          // returning the address of a local
          const inner = stripParen(s.e);
          if (ret.k === 'ptr' && !C.quiet) {
            let target = null;
            if (inner.k === 'Un' && inner.op === '&') { let b = stripParen(inner.e); while (b.k === 'Index' || b.k === 'Mem' && !b.arrow) b = stripParen(b.k === 'Index' ? b.a : b.e); target = b; }
            else if (inner.k === 'Id') target = inner;
            if (target && target.k === 'Id') {
              const ls = C.lookup(target.name);
              if (ls && ls.kind === 'var' && ls.storage === 'local' && !ls.indirect && !ls.isParam && (inner === target ? ls.type.k === 'array' : true)) {
                C.warn(s, "function returns address of local variable '" + target.name + "' [-Wreturn-local-addr]");
              }
            }
          }
          C.rvTo(s.e, ret, { kind: 'return' });
        }
      } else {
        if (ret.k !== 'void' && !C.quiet) C.warn(s, "'return' with no value, in function returning non-void [-Wreturn-mismatch]");
        if (ret.k === 'struct') e1(OP.LLOAD, 10, fn.retbuf); else C.pushInt(0);
        if (T.isScalar(ret) && C.cn(ret) !== 0) { C.convert(T.int, ret); }
      }
      fn.sawReturn = true;
      e1(OP.RET);
    };

    C.genSwitch = function (s) {
      const t = C.rv(s.e);
      if (!T.isInt(t)) { C.error(s, 'switch quantity not an integer'); e1(OP.POP); return; }
      const pt = T.promote(t);
      C.convert(t, pt);
      const wide = pt.size === 8;
      const tbl = { map: new Map(), def: -1 };
      C.consts.push(tbl);
      e1(OP.SWITCH, C.consts.length - 1);
      const lp = C.newLoop(true);
      const ctx = { tbl, pt, wide, hasDefault: false, node: s };
      C.switches.push(ctx);
      C.loops.push(lp);
      C.pushScope();
      if (s.body.k === 'Block') C.genBlockItems(s.body.items); else C.genStmt(s.body);
      C.closeScope();
      C.loops.pop(); C.switches.pop();
      if (!ctx.hasDefault) tbl.def = -2;       // patched to the end label below
      ctx.endFix = true;
      C.place(lp.breakL);
      if (tbl.def === -2) tbl.def = C.code.length;
      C.switchTables.push(tbl);
    };
    C.genCase = function (s) {
      const ctx = C.switches[C.switches.length - 1];
      if (!ctx) { C.error(s, (s.k === 'Case' ? "'case'" : "'default'") + ' label not within a switch statement'); return; }
      const here = C.code.length;
      if (s.k === 'Default') {
        if (ctx.hasDefault) C.error(s, 'multiple default labels in one switch');
        ctx.hasDefault = true; ctx.tbl.def = here; return;
      }
      const lo = C.constInt(s.v);
      if (lo === null) { C.error(s, 'case label does not reduce to an integer constant'); return; }
      let hi = lo;
      if (s.hi) { const h = C.constInt(s.hi); if (h === null) { C.error(s, 'case label does not reduce to an integer constant'); return; } hi = h; }
      if (hi - lo > 4096n) { C.error(s, 'case range is too large'); return; }
      for (let v = lo; v <= hi; v++) {
        const w = T.wrap(v, ctx.pt);
        const key = ctx.wide ? w : Number(w);
        if (ctx.tbl.map.has(key)) { C.error(s, 'duplicate case value'); continue; }
        ctx.tbl.map.set(key, here);
      }
    };

    // ---------- functions ----------
    C.genFunction = function (node) {
      const spec = node.spec;
      const base = C.baseType(spec);
      const r = C.applyDeclarator(base, node.decl);
      const name = r.name, type = r.type;
      if (type.k !== 'func') { C.error(node, 'invalid function definition'); return; }
      const sym = C.declareFunction(name, type, node.line, node);
      if (sym.defined) { C.error(node, "redefinition of '" + name + "'"); return; }
      if (sym.kind !== 'func') return;
      sym.type = type.unspecified && sym.type.pinfo ? sym.type : type;
      sym.defined = true;
      if (spec.storage === 'static') sym.isStatic = true;
      const rec = sym.rec;
      if (name === 'main') {
        if (!(type.ret.k === 'int')) C.warn(node, "return type of 'main' is not 'int' [-Wmain]");
        C.mainSym = sym;
      }
      const fn = { name, sym, rec, frame: 0, redzones: rec.redzones, labels: new Map(), ret: type.ret, params: [], line: node.line };
      C.fn = fn; C.loops = []; C.switches = [];
      rec.entry = C.code.length;
      C.line = node.line;
      const enterPos = e1(OP.ENTER, 0);
      C.pushScope();                               // parameters + body share one scope
      const stores = [];
      if (type.ret.k === 'struct') {
        fn.retbuf = C.allocFrame(8, 8);
        stores.push({ kind: 10, off: fn.retbuf });
      }
      const pinfo = type.pinfo || [];
      if (type.unspecified && pinfo.length === 0 && node.decl.suffix[0].params.length) { /* K&R style params not supported */ }
      for (const p of pinfo) {
        let off, ptype = p.type;
        if (ptype.k === 'struct') {
          off = C.allocFrame(8, 8);
          stores.push({ kind: 10, off });
          if (p.name) C.declareSym(p.name, { kind: 'var', name: p.name, type: ptype, storage: 'local', off, indirect: true, isParam: true, used: true, assigned: true, line: p.line });
        } else {
          off = C.allocFrame(Math.max(T.sizeOf(ptype), 1), Math.max(T.alignOf(ptype), 1));
          stores.push({ kind: T.kindOf(ptype), off });
          if (p.name) {
            if (C.scopes[C.scopes.length - 1].has(p.name)) C.error({ line: p.line }, "redefinition of parameter '" + p.name + "'");
            C.declareSym(p.name, { kind: 'var', name: p.name, type: ptype, storage: 'local', off, isParam: true, used: true, assigned: true, line: p.line });
          }
        }
        fn.params.push({ name: p.name, type: ptype });
      }
      if (type.variadic) C.error(node, 'defining variadic functions is not supported yet');
      for (let i = stores.length - 1; i >= 0; i--) e1(OP.LSTOREP, stores[i].kind, stores[i].off);
      // array parameters with variable-length inner dimensions, e.g. int a[n][m]
      for (const p of pinfo) if (p.type.k === 'ptr' && C.hasVLA(p.type.to)) C.materializeVLA(p.type.to);

      const body = node.body;
      C.genBlockItems(body.items);
      // fall off the end
      const returns = alwaysReturns(body);
      if (!returns) {
        if (type.ret.k !== 'void' && name !== 'main' && !C.sys) C.warn({ line: body.endLine || node.line }, "control reaches end of non-void function [-Wreturn-type]");
        if (type.ret.k === 'struct') e1(OP.LLOAD, 10, fn.retbuf);
        else C.pushInt(0);
        if (T.isScalar(type.ret) && C.cn(type.ret) !== 0) C.convert(T.int, type.ret);
        e1(OP.RET);
      }
      C.closeScope();
      // labels
      for (const [n, l] of fn.labels) if (!l.defined) C.error({ line: l.line }, "label '" + n + "' used but not defined");
      for (const [n, l] of fn.labels) if (l.defined && !l.used && !C.sys) C.warn({ line: l.line }, "label '" + n + "' defined but not used [-Wunused-label]");
      C.code[enterPos + 1] = C.alignUp(fn.frame, 16);
      rec.frameSize = C.alignUp(fn.frame, 16);
      rec.endLine = body.endLine || node.line;
      C.fn = null;
    };
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
