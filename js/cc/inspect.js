/* C-Slayer · debugger support for the VM: breakpoints, stepping, and a JSON snapshot of frames, variables and heap.
 * Programs must be compiled with {debug:true} so they contain LINE markers and variable tables. */
(function (g) {
  'use strict';
  const CC = g.CC = g.CC || {};
  const P = CC.VM.prototype;
  const hex = (n) => '0x' + (n >>> 0).toString(16);

  /** mode: 'run' | 'into' | 'over' | 'out';  breakpoints: array of line numbers */
  P.dbgSet = function (mode, breakpoints) {
    const depth = this.frames.length;
    this.dbg = { mode: mode || 'run', depth, bp: new Set(breakpoints || []), line: this.dbg ? this.dbg.line : 0, first: this.dbg ? this.dbg.first : true };
  };
  P.dbgCheck = function (ln, depth) {
    const d = this.dbg;
    let stop = false;
    if (d.bp.has(ln) && !(d.line === ln && d.depth === depth && d.mode === 'run' && d.justStopped)) stop = true;
    else if (d.mode === 'into') stop = true;
    else if (d.mode === 'over') stop = depth <= d.depth;
    else if (d.mode === 'out') stop = depth < d.depth;
    if (stop) { d.line = ln; d.mode = 'run'; d.justStopped = false; }
    return stop;
  };

  // ---------- safe memory reads (never throw, never trigger sanitizer errors) ----------
  P.dbgOk = function (a, n) { return a >= CC.MEM.LOW && a + n <= this.size; };
  function rdInt(vm, a, size, signed) {
    if (!vm.dbgOk(a, size)) return null;
    const dv = vm.dv;
    switch (size) {
      case 1: return signed ? dv.getInt8(a) : dv.getUint8(a);
      case 2: return signed ? dv.getInt16(a, true) : dv.getUint16(a, true);
      case 4: return signed ? dv.getInt32(a, true) : dv.getUint32(a, true);
      default: return signed ? dv.getBigInt64(a, true).toString() : dv.getBigUint64(a, true).toString();
    }
  }
  function where(vm, a) {
    if (a === 0) return 'NULL';
    if (a < CC.MEM.LOW) return 'invalid';
    if (a >= vm.roStart && a < vm.roEnd) return 'string literal';
    if (a >= vm.roEnd && a < vm.heapStart) return 'global';
    if (a >= vm.heapStart && a < vm.heapEnd) {
      for (const b of vm.blocks.values()) if (a >= b.addr && a < b.addr + Math.max(b.size, 1)) return (b.state === 2 ? 'FREED heap block' : 'heap block') + ' (' + b.size + ' bytes, from line ' + b.line + ')' + (a > b.addr ? ' +' + (a - b.addr) : '');
      return 'heap (unallocated)';
    }
    if (a >= vm.heapEnd && a < vm.stackTop) return 'stack';
    return 'invalid';
  }
  function cstr(vm, a) {
    let s = '';
    for (let i = 0; i < 40; i++) {
      if (!vm.dbgOk(a + i, 1)) return null;
      const c = vm.u8[a + i];
      if (c === 0) return s;
      s += c >= 32 && c < 127 ? String.fromCharCode(c) : '\\x' + c.toString(16).padStart(2, '0');
    }
    return s + '…';
  }
  function num(x, size) { return size === 4 ? Number(x.toPrecision(7)) : Number(x.toPrecision(15)); }

  /** value node for a variable of type desc `t` stored at address `a` */
  function show(vm, t, a, depth) {
    const out = { type: t.name };
    switch (t.k) {
      case 'int': {
        const v = rdInt(vm, a, t.size, t.signed);
        if (v === null) { out.text = '?'; break; }
        if (t.isBool) out.text = v ? 'true' : 'false';
        else if (t.isChar && typeof v === 'number') out.text = v + (v >= 32 && v < 127 ? " '" + String.fromCharCode(v) + "'" : v === 10 ? " '\\n'" : v === 0 ? " '\\0'" : '');
        else out.text = String(v);
        if ((t.size === 4 && (v === -858993460 || v === 3435973836)) || (t.size === 1 && v === -52 && false)) out.hint = 'uninitialized?';
        break;
      }
      case 'float': {
        if (!vm.dbgOk(a, t.size)) { out.text = '?'; break; }
        const v = t.size === 4 ? vm.dv.getFloat32(a, true) : vm.dv.getFloat64(a, true);
        out.text = isFinite(v) ? String(num(v, t.size)) : String(v);
        break;
      }
      case 'ptr': {
        const p = rdInt(vm, a, 4, false);
        if (p === null) { out.text = '?'; break; }
        out.text = p === 0 ? 'NULL' : hex(p);
        out.addr = p;
        if (p) {
          out.where = where(vm, p);
          if (t.cstr) { const s = cstr(vm, p); if (s !== null) out.text += '  "' + s + '"'; }
          else if (t.to && depth < 2 && !t.isFunc && (out.where.indexOf('heap block') === 0 || out.where === 'stack' || out.where === 'global')) {
            const sub = show(vm, t.to, p, depth + 1); out.deref = sub;
          }
        }
        break;
      }
      case 'array': {
        const el = t.of; const n = Math.min(t.n, 64);
        if (el.k === 'int' && el.isChar && el.size === 1) {
          let s = ''; let ended = false;
          for (let i = 0; i < t.n && i < 80; i++) { if (!vm.dbgOk(a + i, 1)) break; const c = vm.u8[a + i]; if (c === 0) { ended = true; break; } s += c >= 32 && c < 127 ? String.fromCharCode(c) : '\\x' + c.toString(16).padStart(2, '0'); }
          out.text = '"' + s + '"' + (ended ? '' : '…'); out.size = t.n;
          break;
        }
        const esz = Math.max(1, Math.floor(t.size / Math.max(t.n, 1)));
        const kids = [];
        for (let i = 0; i < n; i++) { const k = show(vm, el, a + i * esz, depth + 1); k.name = '[' + i + ']'; kids.push(k); }
        out.kids = kids;
        out.text = '{' + kids.slice(0, 8).map(k => k.text).join(', ') + (t.n > 8 ? ', …' : '') + '}';
        out.size = t.n;
        break;
      }
      case 'struct': {
        const kids = [];
        for (const f of t.fields) { if (depth > 3) break; const k = show(vm, f.type, a + f.off, depth + 1); k.name = f.name; kids.push(k); }
        out.kids = kids;
        out.text = '{' + kids.slice(0, 4).map(k => k.name + '=' + k.text).join(', ') + (kids.length > 4 ? ', …' : '') + '}';
        break;
      }
      default: out.text = '…';
    }
    return out;
  }

  /** snapshot for the UI: call stack (innermost first) with variables, and the heap */
  P.inspect = function () {
    const dbgv = (this.prog.debug && this.prog.debug.vars) || [];
    const stack = [];
    const cur = { fn: this.curFn, fp: this.fp, pc: this.pc - 1, line: this.dbg ? this.dbg.line : this.lineAt(this.pc - 1) };
    const recs = [cur];
    for (let i = this.frames.length - 1; i >= 0 && recs.length < 40; i--) { const f = this.frames[i]; recs.push({ fn: f.fn, fp: f.fp, pc: f.ret - 1, line: this.lineAt(f.ret - 1) }); }
    for (const r of recs) {
      const fnRec = this.funcs[r.fn];
      if (!fnRec || fnRec.name === undefined) continue;
      const vars = [];
      for (const v of dbgv) {
        if (v.fn !== r.fn || r.pc < v.startPc || r.pc >= v.endPc) continue;
        let addr = r.fp + v.off;
        if (v.indirect) { const p = rdInt(this, addr, 4, false); if (p === null) continue; addr = p; }
        const node = show(this, v.type, addr, 0); node.name = v.name; node.param = v.isParam; node.address = addr;
        vars.push(node);
      }
      stack.push({ fn: fnRec.name, line: r.line, vars });
    }
    const heap = [];
    for (const b of this.blocks.values()) { if (heap.length >= 200) break; heap.push({ addr: b.addr, size: b.size, line: b.line, freed: b.state === 2 }); }
    heap.sort((a, b) => a.addr - b.addr);
    return { line: cur.line, stack, heap, output: null };
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
