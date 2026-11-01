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
      if (fn.slots) fn.slots.push({ off, size: Math.max(size, 0) });
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
      if (fn.slots) fn.slots.push({ off, size });
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
          if (t.bf) { e1(OP.LEAL, off + boff); C.rvTo(expr, t, { kind: 'init' }); C.emitStore(t, false); }
          else { C.rvTo(expr, t, { kind: 'init' }); e1(OP.LSTOREP, T.kindOf(t), off + boff); }
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
          if (t.bf) C.gwriteBF(a, t, v); else C.gwrite(a, t.size, v);
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
        if (type.k === 'void') { C.error(nnode, "variable '" + name + "' declared void"); continue; }
        if (type.k === 'struct' && !type.complete && spec.storage !== 'extern') { C.error(nnode, "storage size of '" + name + "' isn't known"); continue; }
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
    /** a statement that can be generated into a scratch buffer and dropped: no labels, case labels or jumps out of it */
    function deadBranchOk(n) {
      let ok = true;
      (function w(x) {
        if (!ok || !x || typeof x !== 'object') return;
        if (Array.isArray(x)) { x.forEach(w); return; }
        if (x.k === 'Label' || x.k === 'Case' || x.k === 'Default' || x.k === 'Goto' || x.k === 'Break' || x.k === 'Continue' || x.k === 'Switch') { ok = false; return; }
        for (const key in x) if (key !== 'type' && key !== 'sym') w(x[key]);
      })(n);
      return ok;
    }

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

    // ---------- dead-code elimination: loops whose only effect is feeding variables that are never read ----------
    function analyzeDead(body, paramNames) {
      const declCount = new Map(), cand = new Set(), occ = [];
      const bad = new Set(paramNames);
      let idx = 0, hasGoto = false; const loopStack = [], loops = [];
      const writeOnly = (e) => { e = stripParen(e); return e.k === 'Assign' && stripParen(e.l).k === 'Id' ? e : null; };
      function visit(n, owner) {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) { for (const x of n) visit(x, owner); return; }
        if (n.k === 'For' || n.k === 'While' || n.k === 'DoWhile') {
          const rec = { node: n, lo: idx, hi: 0, outerLo: loopStack.length ? loopStack[0].lo : idx };
          loopStack.push(rec); loops.push(rec);
          visit0(n, owner);
          rec.hi = idx; loopStack.pop(); return;
        }
        visit0(n, owner);
      }
      function visit0(n, owner) {
        switch (n.k) {
          case 'Goto': case 'Label': hasGoto = true; break;
          case 'Un': if (n.op === '&') { const q = stripParen(n.e); if (q && q.k === 'Id') bad.add(q.name); } break;
          case 'Decl':
            for (const it of n.items) {
              let d = it.decl; const nm = d && d.name;
              if (!nm) { let q = d; while (q && !q.name && q.inner) q = q.inner; if (q && q.name) bad.add(q.name); continue; }
              declCount.set(nm, (declCount.get(nm) || 0) + 1);
              const simple = n.spec && n.spec.base && n.spec.base.t === 'arith' && !n.spec.quals.volatile && !n.spec.storage && !d.ptrs.length && !d.inner && !d.suffix.length;
              if (simple) cand.add(nm); else bad.add(nm);
              if (it.init) visit(it.init, simple ? nm : null);
            }
            return;
          case 'ExprStmt': { const a = writeOnly(n.e); if (a) { visit(a.r, stripParen(a.l).name); return; } visit(n.e, null); return; }
          case 'For': {
            visit(n.init, null); visit(n.c, null);
            if (n.step) { const a = writeOnly(n.step); if (a) visit(a.r, stripParen(a.l).name); else visit(n.step, null); }
            visit(n.body, null); return;
          }
          case 'Id': occ.push({ name: n.name, owner, idx: idx++ }); return;
        }
        for (const key in n) { if (key === 'line' || key === 'col') continue; const v = n[key]; if (v && typeof v === 'object') visit(v, owner); }
      }
      visit(body, null);
      const dead = new Set([...cand].filter(x => declCount.get(x) === 1 && !bad.has(x) && !C.scopes[0].has(x)));
      for (let changed = true; changed;) {
        changed = false;
        for (const o of occ) if (dead.has(o.name) && (o.owner === null || !dead.has(o.owner)) && o.owner !== o.name) { dead.delete(o.name); changed = true; }
      }
      // variables that are not read after a given loop (and not read by an enclosing loop's next round)
      dead.after = new Map();
      if (!hasGoto) {
        const pool = [...cand].filter(x => declCount.get(x) === 1 && !bad.has(x) && !C.scopes[0].has(x));
        for (const L of loops) {
          if (L.node.k !== 'For') continue;
          const ok = new Set(pool);
          for (const o of occ) {
            if (!ok.has(o.name) || o.idx < L.outerLo || (o.idx >= L.lo && o.idx < L.hi)) continue;
            if (o.owner !== o.name) ok.delete(o.name);
          }
          dead.after.set(L.node, ok);
        }
      }
      return dead;
    }
    // can this expression be dropped when its value is unused? (no calls, no memory access, cannot trap)
    function pureExpr(e, locals) {
      e = stripParen(e);
      switch (e.k) {
        case 'Num': case 'Chr': return true;
        case 'Id': return locals.has(e.name);
        case 'Cast': return pureExpr(e.e, locals) && !!C.typeOfName && (() => { try { const t = C.typeOfName(e.tn); return t.k === 'int' || t.k === 'float'; } catch (x) { return false; } })();
        case 'Un': return ['-', '+', '~', '!'].includes(e.op) && pureExpr(e.e, locals);
        case 'Bin': {
          if (!pureExpr(e.l, locals) || !pureExpr(e.r, locals)) return false;
          if (['+', '-', '*', '&', '|', '^', '==', '!=', '<', '>', '<=', '>='].includes(e.op)) return true;
          if (e.op === '/' || e.op === '%') { const d = C.constInt(e.r); return d !== null && d !== 0n && d !== -1n; }
          return false;
        }
        case 'Logic': return pureExpr(e.l, locals) && pureExpr(e.r, locals);
        case 'Cond': return pureExpr(e.c, locals) && pureExpr(e.a, locals) && pureExpr(e.b, locals);
      }
      return false;
    }
    /** true when `for` can be removed entirely: bounded counting loop whose body only updates dead locals with pure values */
    function deadLoop(s) {
      const fn = C.fn; if (!fn || !fn.dead || C.debug || C.sys || !s.init || s.init.k !== 'Decl' || s.init.items.length !== 1 || !s.c || !s.step) return false;
      const it = s.init.items[0], iv = it.decl && it.decl.name; if (!iv || !it.init || it.decl.ptrs.length || it.decl.suffix.length || it.decl.inner) return false;
      if (s.init.spec.quals.volatile || s.init.spec.storage) return false;
      let ity; try { ity = C.applyDeclarator(C.baseType(s.init.spec), it.decl).type; } catch (x) { return false; }
      if (ity.k !== 'int' || ity.size < 4) return false;
      const lo = C.constInt(it.init); if (lo === null) return false;
      const max = ity.signed ? (1n << BigInt(ity.size * 8 - 1)) - 1n : (1n << BigInt(ity.size * 8)) - 1n;
      const c = stripParen(s.c); if (c.k !== 'Bin') return false;
      let op = c.op, bound;
      if (stripParen(c.l).k === 'Id' && stripParen(c.l).name === iv) bound = C.constInt(c.r);
      else if (stripParen(c.r).k === 'Id' && stripParen(c.r).name === iv) { bound = C.constInt(c.l); op = { '<': '>', '>': '<', '<=': '>=', '>=': '<=', '!=': '!=' }[op]; }
      else return false;
      if (bound === null || !['<', '<=', '>', '>=', '!='].includes(op)) return false;
      const st = stripParen(s.step); let dir = 0, amt = 1n;
      if ((st.k === 'Post' || (st.k === 'Un' && (st.op === '++' || st.op === '--'))) && stripParen(st.e).k === 'Id' && stripParen(st.e).name === iv) dir = st.op === '++' ? 1 : -1;
      else if (st.k === 'Assign' && (st.op === '+=' || st.op === '-=') && stripParen(st.l).k === 'Id' && stripParen(st.l).name === iv) { const a = C.constInt(st.r); if (a === null || a <= 0n) return false; amt = a; dir = st.op === '+=' ? 1 : -1; }
      else return false;
      if (dir > 0 && !(op === '<' || op === '<=' || (op === '!=' && lo <= bound))) return false;
      if (dir < 0 && !(op === '>' || op === '>=' || (op === '!=' && lo >= bound))) return false;
      if (dir > 0 && bound + amt > max) return false;
      if (dir < 0 && ity.signed && bound - amt < -max - 1n) return false;
      if (dir < 0 && !ity.signed && bound - amt < 0n) return false;
      const items = s.body.k === 'Block' ? s.body.items : [s.body];
      const after = (fn.dead.after && fn.dead.after.get(s)) || new Set(), isDead = (nm) => fn.dead.has(nm) || after.has(nm);
      const locals = new Set([iv, ...fn.dead, ...after]);
      // every local that the body reads must be a plain local scalar of this function
      for (const nm of fn.localNames) locals.add(nm);
      for (const stm of items) {
        if (stm.k === 'Empty' || (stm.k === 'ExprStmt' && !stm.e)) continue;
        if (stm.k !== 'ExprStmt') return false;
        const a = stripParen(stm.e);
        if (a.k !== 'Assign' || !['=', '+=', '-=', '*=', '^=', '|=', '&='].includes(a.op)) return false;
        const t = stripParen(a.l); if (t.k !== 'Id' || !isDead(t.name)) return false;
        if (!pureExpr(a.r, locals)) return false;
      }
      for (const stm of items) if (stm.k === 'ExprStmt' && stm.e) { const sy = C.lookup(stripParen(stripParen(stm.e).l).name); if (sy) { sy.assigned = true; sy.written = true; } }
      return true;
    }

    // ---- closed form for counting sums: for (int i=A; i<B; i++) s += i;  (or s += c;  or s++;) ----
    // Wrapping arithmetic is exactly what repeating the additions would give, so the answer is identical, just instant.
    function mentions(n, name) {
      if (!n || typeof n !== 'object') return false;
      if (Array.isArray(n)) return n.some(x => mentions(x, name));
      if (n.k === 'Id' && n.name === name) return true;
      for (const key in n) if (key !== 'line' && key !== 'col' && n[key] && typeof n[key] === 'object' && mentions(n[key], name)) return true;
      return false;
    }
    function closedSum(s) {
      const fn = C.fn; if (!fn || C.debug || C.sys || C.noOpt || !s.init || s.init.k !== 'Decl' || s.init.items.length !== 1 || !s.c || !s.step) return null;
      const it = s.init.items[0], iv = it.decl && it.decl.name; if (!iv || !it.init || it.decl.ptrs.length || it.decl.suffix.length || it.decl.inner) return null;
      if (s.init.spec.quals.volatile || s.init.spec.storage) return null;
      let ity; try { ity = C.applyDeclarator(C.baseType(s.init.spec), it.decl).type; } catch (x) { return null; }
      if (ity.k !== 'int' || !ity.signed || ity.size < 4) return null;
      const items = (s.body.k === 'Block' ? s.body.items : [s.body]).filter(x => !(x.k === 'Empty' || (x.k === 'ExprStmt' && !x.e)));
      if (items.length !== 1 || items[0].k !== 'ExprStmt') return null;
      const a = stripParen(items[0].e); let tgt, mode, cexp = null;
      if (a.k === 'Assign' && a.op === '+=') { tgt = stripParen(a.l); const r = stripParen(a.r); if (r.k === 'Id' && r.name === iv) mode = 0; else { mode = 1; cexp = a.r; } }
      else if ((a.k === 'Post' || (a.k === 'Un' && a.op === '++')) && a.op === '++') { tgt = stripParen(a.e); mode = 1; cexp = { k: 'Num', kind: 'int', value: 1n, base: 10, u: false, l: 0, line: s.line, col: 0 }; }
      else return null;
      if (!tgt || tgt.k !== 'Id' || tgt.name === iv) return null;
      const sy = C.lookup(tgt.name); if (!sy || sy.kind !== 'var' || sy.storage !== 'local' || !sy.type || sy.type.k !== 'int' || sy.type.size < 1) return null;
      const c = stripParen(s.c); if (c.k !== 'Bin' || (c.op !== '<' && c.op !== '<=')) return null;
      const cl = stripParen(c.l); if (cl.k !== 'Id' || cl.name !== iv) return null;
      const st = stripParen(s.step); const isInc = ((st.k === 'Post' || st.k === 'Un') && st.op === '++' && stripParen(st.e).k === 'Id' && stripParen(st.e).name === iv) ||
        (st.k === 'Assign' && st.op === '+=' && stripParen(st.l).k === 'Id' && stripParen(st.l).name === iv && C.constInt(st.r) === 1n);
      if (!isInc) return null;
      const locals = new Set(fn.localNames); for (const p of fn.params) if (p.name) locals.add(p.name);
      locals.delete(tgt.name); locals.delete(iv);
      const lo = it.init, hi = c.r;
      if (!pureExpr(lo, locals) || !pureExpr(hi, locals) || (cexp && !pureExpr(cexp, locals))) return null;
      for (const n of [lo, hi, cexp]) if (n && (mentions(n, tgt.name) || mentions(n, iv))) return null;
      const ln = s.line;
      const num = (v, ll) => ({ k: 'Num', kind: 'int', value: BigInt(v), base: 10, u: false, l: ll ? 2 : 0, line: ln, col: 0 });
      const bin = (op, l, r) => ({ k: 'Bin', op, l, r, line: ln, col: 0 });
      const par = (e) => ({ k: 'Paren', e, line: ln, col: 0 });
      const L1 = () => bin('*', num(1, true), par(lo));
      const hiE = c.op === '<' ? bin('*', num(1, true), par(hi)) : bin('+', bin('*', num(1, true), par(hi)), num(1));
      const nRaw = () => par(bin('-', par(hiE), par(L1())));
      const n = () => par({ k: 'Cond', c: bin('>', nRaw(), num(0)), a: nRaw(), b: num(0), line: ln, col: 0 });
      let sum;
      if (mode === 0) {
        const t = () => par(bin('-', bin('+', bin('*', num(2), L1()), n()), num(1)));   // 2*lo + n - 1
        sum = { k: 'Cond', c: bin('==', par(bin('&', n(), num(1))), num(0)), a: bin('*', par(bin('/', n(), num(2))), t()), b: bin('*', n(), par(bin('/', t(), num(2)))), line: ln, col: 0 };
      } else sum = bin('*', n(), par(bin('*', num(1, true), par(cexp))));
      const rhs = bin('+', { k: 'Id', name: tgt.name, line: ln, col: 0 }, par(sum));
      return { k: 'ExprStmt', e: { k: 'Assign', op: '=', l: { k: 'Id', name: tgt.name, line: ln, col: 0 }, r: rhs, line: ln, col: 0 }, line: ln };
    }

    C.genStmt = function (s) {
      C.line = s.line || C.line;
      C.curNode = s;
      if (C.debug && C.fn && !C.sys && s.k !== 'Block' && s.k !== 'Empty' && s.k !== 'Label' && s.k !== 'Case' && s.k !== 'Default' && s.line) e1(OP.LINE, s.line);
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
          if (!C.noOpt && !C.debug) {
            // constant condition: emit only the branch that can run (the other one is still checked for errors, then dropped)
            const cv = C.constVal(stripParen(s.c));
            if (cv && cv.k === 'int') {
              const live = cv.v !== 0n ? s.a : s.b, dead = cv.v !== 0n ? s.b : s.a;
              if (!dead || deadBranchOk(dead)) {
                if (dead) {
                  const sc = C.code, sl = C.lines, sf = C.fixups.length;
                  C.code = []; C.lines = [];
                  try { C.genScoped(dead); } finally { C.code = sc; C.lines = sl; for (let i = sf; i < C.fixups.length; i++) C.fixups[i].pc = -1; }  // library/undefined calls stay linked (and reported) but patch nothing
                }
                if (live) C.genScoped(live);
                return;
              }
            }
          }
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
          if (C.debug && !C.sys) e1(OP.LINE, s.line);
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
          if (deadLoop(s)) return;
          { const cf = closedSum(s); if (cf) { C.genStmt(cf); return; } }
          C.pushScope();
          if (s.init) { if (s.init.k === 'Decl') C.genLocalDecl(s.init); else C.genStmt(s.init); }
          const lp = C.newLoop(false); const Ltop = C.newLabel();
          C.place(Ltop);
          if (C.debug && !C.sys) e1(OP.LINE, s.line);
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
      if (C.debug) for (const [, s] of scope) if (s.dbg) s.dbg.endPc = C.code.length;
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
        const key = ctx.wide ? ((w >= -9007199254740991n && w <= 9007199254740991n) ? Number(w) : w) : Number(w);
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
      const fn = { name, sym, rec, frame: 0, redzones: rec.redzones, labels: new Map(), ret: type.ret, params: [], line: node.line, slots: [] };
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
      if (type.variadic) {
        // hidden last parameter: pointer to the caller's buffer of extra arguments (what va_start hands out)
        const off = C.allocFrame(8, 8);
        stores.push({ kind: 10, off });
        C.declareSym('__va_base', { kind: 'var', name: '__va_base', type: T.ptr(T.char), storage: 'local', off, isParam: true, used: true, assigned: true, line: node.line });
      }
      for (let i = stores.length - 1; i >= 0; i--) e1(OP.LSTOREP, stores[i].kind, stores[i].off);
      // array parameters with variable-length inner dimensions, e.g. int a[n][m]
      for (const p of pinfo) if (p.type.k === 'ptr' && C.hasVLA(p.type.to)) C.materializeVLA(p.type.to);

      const body = node.body;
      { const pn = []; try { for (const p of node.decl.suffix[0].params) if (p.decl && p.decl.name) pn.push(p.decl.name); } catch (x) { /* none */ }
        fn.dead = C.noOpt ? new Set() : analyzeDead(body, pn);
        fn.localNames = new Set(); (function collect(n) { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) { n.forEach(collect); return; } if (n.k === 'Decl') for (const it of n.items) { let q = it.decl; while (q && !q.name && q.inner) q = q.inner; if (q && q.name && n.spec && n.spec.base && n.spec.base.t === 'arith' && !n.spec.quals.volatile && !q.ptrs.length && !q.suffix.length) fn.localNames.add(q.name); } for (const key in n) if (key !== 'line' && key !== 'col') { const v = n[key]; if (v && typeof v === 'object') collect(v); } })(body); }
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
      rec.slots = fn.slots;
      rec.endLine = body.endLine || node.line;
      C.fn = null;
    };
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
