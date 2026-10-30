/* C-Slayer · virtual machine
 * Runs compiled C inside a private linear memory. The program can never touch anything outside it:
 *  - every load/store is bounds-checked, address 0..64K is a trap zone (NULL dereference),
 *  - a poison map marks heap red zones, freed blocks, array red zones and read-only strings,
 *  - the run is resumable (scanf can pause the VM and continue later), has step / output / memory limits.
 */
(function (g) {
  'use strict';
  const CC = g.CC = g.CC || {};
  const OP = CC.OP;
  const MEM = CC.MEM;

  const WAIT = { wait: true };            // builtin result: "need more stdin, call me again"
  class RunError extends Error {
    constructor(kind, msg, extra) { super(msg); this.kind = kind; this.extra = extra || null; }
  }
  class ExitSignal extends Error { constructor(code) { super('exit'); this.code = code; } }

  const P_HEAP = 1, P_FREED = 2, P_STACK = 3, P_GLOBAL = 4;
  const HEAP_BYTES = 24 * 1024 * 1024;
  const STACK_BYTES = 8 * 1024 * 1024;
  const OUT_LIMIT = 2 * 1024 * 1024;
  const MAX_FRAMES = 60000;
  const OPSTACK = 1 << 16;
  const QUARANTINE = 2 * 1024 * 1024;

  const hex = n => '0x' + (n >>> 0).toString(16);
  const I32_MIN = -2147483648;
  const I64_MIN = -(1n << 63n);

  function f2i(v) { // float -> int32 the way x86 cvttsd2si does
    if (v !== v || v >= 2147483648 || v < -2147483648) return I32_MIN;
    return Math.trunc(v) | 0;
  }
  function f2u(v) {
    if (v >= 0 && v < 4294967296) return v >>> 0;
    if (v !== v || v >= 9.2e18 || v <= -9.2e18) return 0;
    return Number(BigInt.asUintN(32, BigInt(Math.trunc(v))));
  }
  function f2l(v) {
    if (v !== v || v >= 9223372036854775808 || v < -9223372036854775808) return I64_MIN;
    return BigInt(Math.trunc(v));
  }
  function f2ul(v) {
    if (v !== v || v >= 18446744073709551616 || v <= -9223372036854775809) return 1n << 63n;
    return BigInt.asUintN(64, BigInt(Math.trunc(v)));
  }
  // value-class conversion: from*8+to
  function conv(v, ft) {
    const from = ft >> 3, to = ft & 7;
    switch (to) {
      case 0: // -> I
        if (from === 1) return v | 0;
        if (from === 2 || from === 3) return Number(BigInt.asIntN(32, v));
        if (from >= 4) return f2i(v);
        return v;
      case 1: // -> U / pointer
        if (from === 0) return v >>> 0;
        if (from === 2 || from === 3) return Number(BigInt.asUintN(32, v));
        if (from >= 4) return f2u(v);
        return v;
      case 2: // -> L
        if (from <= 1) return BigInt(v);
        if (from === 3) return BigInt.asIntN(64, v);
        if (from >= 4) return f2l(v);
        return v;
      case 3: // -> UL
        if (from <= 1) return BigInt.asUintN(64, BigInt(v));
        if (from === 2) return BigInt.asUintN(64, v);
        if (from >= 4) return f2ul(v);
        return v;
      case 4: // -> F
        if (from === 2 || from === 3) return Math.fround(Number(v));
        return Math.fround(v);
      case 5: // -> D
        if (from === 2 || from === 3) return Number(v);
        return v;
    }
    return v;
  }

  class VM {
    constructor(prog, opts) {
      opts = opts || {};
      this.prog = prog;
      this.code = prog.code; this.lines = prog.lines; this.consts = prog.consts; this.funcs = prog.funcs;
      this.builtins = prog.builtins;
      this.maxSteps = opts.maxSteps || Infinity;
      // ---- memory layout ----
      const dataEnd = MEM.RO_BASE + MEM.RO_SIZE + ((prog.globalSize + 15) & ~15);
      this.heapStart = (dataEnd + 4095) & ~4095;
      this.heapEnd = this.heapStart + HEAP_BYTES;
      this.stackTop = this.heapEnd + STACK_BYTES;
      this.size = this.stackTop;
      this.stackLimit = this.heapEnd + 4096;
      const buf = new ArrayBuffer(this.size);
      this.u8 = new Uint8Array(buf);
      this.dv = new DataView(buf);
      this.poison = new Uint8Array(this.size);
      this.u8.set(prog.rodata, MEM.RO_BASE);
      this.u8.set(prog.gdata, MEM.RO_BASE + MEM.RO_SIZE);
      this.roStart = MEM.RO_BASE; this.roEnd = MEM.RO_BASE + MEM.RO_SIZE;
      for (const r of prog.globalRedzones) this.poison.fill(P_GLOBAL, r.addr, r.addr + r.len);
      this.poison.fill(P_HEAP, this.heapStart, this.heapEnd); // unallocated heap is off limits until malloc hands it out
      // ---- heap ----
      this.brk = this.heapStart + 16;
      this.blocks = new Map();       // addr -> {size, rs, line, state}
      this.freeLists = new Map();    // rs -> [addr]
      this.quarantine = []; this.quarantineBytes = 0;
      this.heapInUse = 0;
      // ---- registers ----
      this.S = new Array(OPSTACK);
      this.ssp = 0;
      this.pc = 0; this.fp = this.stackTop; this.sp = this.stackTop;
      this.frames = [];
      this.curFn = -1;
      this.steps = 0;
      this.done = false; this.exitCode = 0;
      // ---- io ----
      this.inBytes = []; this.inPos = 0; this.inEOF = false;
      this.outQ = []; this.outBytes = 0;
      this.decoders = [null, new TextDecoder('utf-8'), new TextDecoder('utf-8')];
      this.files = new Map(); this.nextFd = 3;
      this.vfs = opts.vfs || new Map();
      this.rng = null; this.strtokPtr = 0; this.clockStart = Date.now();
      this.symAddr = prog.symAddr;
      this.stats = { allocs: 0, frees: 0, bytesAllocated: 0, calls: 0 };
      this.warnings = [];
      // start: argv setup is done by the compiled startup stub, which calls main
      this.pc = prog.startPc;
    }

    // ---------- errors ----------
    lineAt(pc) {
      const L = this.lines;
      let i = Math.min(pc, L.length - 1);
      while (i > 0 && L[i] === 0) i--;
      return L[i] || 0;
    }
    where() {
      return { line: this.lineAt(this.pc - 1), fn: this.curFn >= 0 ? this.funcs[this.curFn].name : null };
    }
    fail(kind, msg, extra) {
      const e = new RunError(kind, msg, extra);
      const w = this.where(); e.line = w.line; e.fn = w.fn;
      throw e;
    }
    describeAddr(a) {
      if (a < MEM.LOW) return a === 0 ? 'NULL' : hex(a);
      return hex(a);
    }
    poisonError(a, n, write) {
      const verb = write ? 'writing' : 'reading';
      const bytes = n + ' byte' + (n === 1 ? '' : 's');
      const p = this.poison;
      let bad = a; for (let i = 0; i < n; i++) if (p[a + i]) { bad = a + i; break; }
      const kind = p[bad];
      if (kind === P_HEAP) {
        const b = this.nearestBlock(bad);
        if (b) {
          const rel = bad - (b.addr + b.size);
          const where = rel >= 0 ? (rel === 0 ? 'right after the end of' : rel + ' bytes past the end of') : (-rel) + ' bytes before the start of';
          this.fail('heap-overflow', 'Heap buffer overflow: ' + verb + ' ' + bytes + ' at ' + hex(a) + ', ' + where + ' a ' + b.size + '-byte block (allocated on line ' + b.line + ')', { blockLine: b.line });
        }
        this.fail('heap-overflow', 'Heap buffer overflow: ' + verb + ' ' + bytes + ' at ' + hex(a));
      }
      if (kind === P_FREED) {
        const b = this.nearestBlock(bad);
        this.fail('use-after-free', 'Use after free: ' + verb + ' ' + bytes + ' at ' + hex(a) + (b ? ' inside a block of ' + b.size + ' bytes that was freed' + (b.freeLine ? ' on line ' + b.freeLine : '') + ' (allocated on line ' + b.line + ')' : ''), { blockLine: b && b.line });
      }
      if (kind === P_STACK) {
        const info = this.findStackRz(bad);
        this.fail('stack-overflow-array', 'Array out of bounds: ' + verb + ' ' + bytes + (info ? ' ' + info : ' outside a local array'));
      }
      if (kind === P_GLOBAL) {
        const info = this.findGlobalRz(bad);
        this.fail('global-overflow', 'Array out of bounds: ' + verb + ' ' + bytes + (info ? ' ' + info : ' outside a global array'));
      }
      this.fail('segv', 'Invalid memory access at ' + hex(a));
    }
    findStackRz(bad) {
      const fnIdx = this.curFn; if (fnIdx < 0) return '';
      const rz = this.funcs[fnIdx].redzones || [];
      for (const r of rz) {
        const a = this.fp + r.off;
        if (bad >= a && bad < a + r.len) {
          const dist = r.side === 'after' ? bad - a : (a + r.len) - bad;
          return (r.side === 'after' ? 'past the end of' : 'before the start of') + " local array '" + r.name + "' (" + r.arrSize + ' bytes)' + (r.side === 'after' && dist >= 0 ? '' : '');
        }
      }
      return '';
    }
    findGlobalRz(bad) {
      for (const r of this.prog.globalRedzones) {
        if (bad >= r.addr && bad < r.addr + r.len) return (r.side === 'after' ? 'past the end of' : 'before the start of') + " global array '" + r.name + "' (" + r.arrSize + ' bytes)';
      }
      return '';
    }
    nearestBlock(a) {
      // blocks are laid out in address order by the bump allocator; linear search is fine for an error path
      let best = null;
      for (const b of this.blocks.values()) {
        const lo = b.addr - 16, hi = b.addr + b.rs + 16;
        if (a >= lo && a < hi) return b;
        if (!best || Math.abs(b.addr - a) < Math.abs(best.addr - a)) best = b;
      }
      return best;
    }
    segv(a, n, write) {
      if (a < MEM.LOW) {
        if (a < 4096 * 4) {
          this.fail('segv', 'Segmentation fault: ' + (write ? 'writing to' : 'reading from') + ' ' + (a === 0 ? 'a NULL pointer' : 'invalid address ' + hex(a) + ' (small address, likely a NULL pointer plus an offset)'));
        }
        this.fail('segv', 'Segmentation fault: ' + (write ? 'writing to' : 'reading from') + ' invalid address ' + hex(a));
      }
      if (a >= this.stackTop - 8 || (a >= this.heapEnd && a < this.stackLimit)) this.fail('stack-overflow', 'Stack overflow: the program used too much stack (infinite recursion or a huge local array?)');
      this.fail('segv', 'Segmentation fault: ' + (write ? 'writing to' : 'reading from') + ' invalid address ' + hex(a) + ' (outside the program\'s memory)');
    }
    /** validate [a, a+n) for access; throws RunError on any violation */
    chk(a, n, write) {
      if (a < MEM.LOW || a + n > this.size) this.segv(a, n, write);
      if (n > 0 && (this.poison[a] | this.poison[a + n - 1])) this.poisonError(a, n, write);
      if (write && a < this.roEnd && a + n > this.roStart) this.fail('segv', 'Segmentation fault: writing to read-only memory (string literals cannot be modified; copy it into a char array first)');
    }
    chkRange(a, n, write) {  // for long copies: also scans the poison map
      if (n <= 0) return;
      if (a < MEM.LOW || a + n > this.size) this.segv(a, n, write);
      const p = this.poison;
      if ((p[a] | p[a + n - 1])) this.poisonError(a, n, write);
      if (n > 16) { for (let i = a; i < a + n; i++) if (p[i]) this.poisonError(a, n, write); }
      if (write && a < this.roEnd && a + n > this.roStart) this.fail('segv', 'Segmentation fault: writing to read-only memory (string literals cannot be modified; copy it into a char array first)');
    }
    readCStr(a, max) {
      const u8 = this.u8, p = this.poison, out = [];
      const lim = max === undefined ? 1 << 24 : max;
      for (let i = 0; i < lim; i++) {
        const x = a + i;
        if (x < MEM.LOW || x >= this.size) this.segv(x, 1, false);
        if (p[x]) this.poisonError(x, 1, false);
        const b = u8[x]; if (b === 0) return out;
        out.push(b);
      }
      return out;
    }
    readStr(a, max) { return this.decodeBytes(this.readCStr(a, max)); }
    decodeBytes(arr) { try { return new TextDecoder('utf-8').decode(Uint8Array.from(arr)); } catch (e) { return String.fromCharCode.apply(null, arr); } }
    readBytes(a, n) { this.chkRange(a, n, false); return this.u8.subarray(a, a + n); }
    writeBytes(a, bytes) { this.chkRange(a, bytes.length, true); this.u8.set(bytes, a); }
    cstrLen(a) {
      const u8 = this.u8, p = this.poison; let n = 0;
      for (;;) {
        const x = a + n;
        if (x < MEM.LOW || x >= this.size) this.segv(x, 1, false);
        if (p[x]) this.poisonError(x, 1, false);
        if (u8[x] === 0) return n; n++;
      }
    }
    strBytes(s) { return Array.from(new TextEncoder().encode(s)); }
    writeCStr(a, s) { const b = typeof s === 'string' ? this.strBytes(s) : s; this.chkRange(a, b.length + 1, true); this.u8.set(b, a); this.u8[a + b.length] = 0; }

    // ---------- heap ----------
    malloc(n, line) {
      if (n < 0 || n > HEAP_BYTES) return 0;
      const rs = Math.max(16, (n + 15) & ~15);
      let addr = 0;
      const fl = this.freeLists.get(rs);
      if (fl && fl.length) addr = fl.pop();
      else {
        if (this.brk + rs + 32 > this.heapEnd) { this.drainQuarantine(true); const f2 = this.freeLists.get(rs); if (f2 && f2.length) addr = f2.pop(); }
        if (!addr) {
          if (this.brk + rs + 32 > this.heapEnd) return 0;
          addr = this.brk + 0; this.brk += rs + 32; addr += 16;
        }
      }
      this.poison.fill(P_HEAP, addr - 16, addr);
      this.poison.fill(0, addr, addr + n);
      this.poison.fill(P_HEAP, addr + n, addr + rs + 16);
      this.u8.fill(0xCD, addr, addr + n);
      this.blocks.set(addr, { addr, size: n, rs, line: line || 0, state: 1 });
      this.heapInUse += n; this.stats.allocs++; this.stats.bytesAllocated += n;
      return addr;
    }
    free(a, line) {
      if (a === 0) return;
      const b = this.blocks.get(a);
      if (!b) {
        if (a >= this.heapStart && a < this.brk) {
          for (const x of this.blocks.values()) if (a > x.addr && a < x.addr + x.rs) this.fail('invalid-free', 'Invalid free: the pointer ' + hex(a) + ' is inside a block, not the pointer malloc returned (allocated on line ' + x.line + ')');
        }
        this.fail('invalid-free', 'Invalid free: ' + hex(a) + ' was not returned by malloc/calloc/realloc');
      }
      if (b.state === 2) this.fail('double-free', 'Double free: this block (allocated on line ' + b.line + ') was already freed' + (b.freeLine ? ' on line ' + b.freeLine : ''));
      b.state = 2; b.freeLine = line || 0;
      this.poison.fill(P_FREED, b.addr, b.addr + b.rs);
      this.u8.fill(0xDD, b.addr, b.addr + b.size);
      this.heapInUse -= b.size; this.stats.frees++;
      this.quarantine.push(b); this.quarantineBytes += b.rs;
      if (this.quarantineBytes > QUARANTINE) this.drainQuarantine(false);
    }
    drainQuarantine(all) {
      while (this.quarantine.length && (all || this.quarantineBytes > QUARANTINE / 2)) {
        const b = this.quarantine.shift(); this.quarantineBytes -= b.rs;
        this.blocks.delete(b.addr);
        let l = this.freeLists.get(b.rs); if (!l) { l = []; this.freeLists.set(b.rs, l); }
        l.push(b.addr);
      }
    }
    realloc(a, n, line) {
      if (a === 0) return this.malloc(n, line);
      const b = this.blocks.get(a);
      if (!b || b.state === 2) { this.free(a, line); return 0; }
      if (n === 0) { this.free(a, line); return 0; }
      const na = this.malloc(n, line);
      if (!na) return 0;
      this.u8.copyWithin(na, a, a + Math.min(b.size, n));
      this.free(a, line);
      return na;
    }
    leaks() {
      const out = [];
      for (const b of this.blocks.values()) if (b.state === 1) out.push(b);
      return out;
    }

    // ---------- io ----------
    feedInput(text, eof) {
      if (text) for (const b of new TextEncoder().encode(text)) this.inBytes.push(b);
      if (eof) this.inEOF = true;
    }
    emit(fd, bytes) {
      this.outBytes += bytes.length;
      if (this.outBytes > OUT_LIMIT) this.fail('output-limit', 'Output limit reached (' + (OUT_LIMIT / 1024 / 1024) + ' MB): the program printed far too much. Is there an infinite loop?');
      const dec = this.decoders[fd];
      const s = dec.decode(Uint8Array.from(bytes), { stream: true });
      if (s) this.outQ.push({ fd, s });
    }
    drainOutput() { const q = this.outQ; this.outQ = []; return q; }
    fileFromHandle(ptr) {
      const fd = this.dv.getInt32(ptr, true);
      return fd;
    }

    // ---------- execution ----------
    /** runs up to `budget` jumps/calls; returns 'done' | 'yield' | 'wait' | 'error' */
    run(budget) {
      try { return this.exec(budget); }
      catch (e) {
        if (e instanceof ExitSignal) { this.done = true; this.exitCode = e.code; return 'done'; }
        if (e instanceof RunError) { this.error = e; this.done = true; return 'error'; }
        if (e instanceof RangeError && /call stack|Maximum/i.test(e.message)) { const w = this.where(); this.error = Object.assign(new RunError('internal', 'The program is too deeply nested to run.'), w); this.done = true; return 'error'; }
        const w = this.where();
        this.error = Object.assign(new RunError('internal', 'Internal error: ' + (e && e.message ? e.message : e)), w);
        this.error.stack0 = e && e.stack;
        this.done = true; return 'error';
      }
    }

    exec(budget) {
      const code = this.code, S = this.S, dv = this.dv, u8 = this.u8, poison = this.poison, consts = this.consts;
      const lo = MEM.LOW, memSize = this.size, roS = this.roStart, roE = this.roEnd;
      let pc = this.pc, ssp = this.ssp, fp = this.fp, sp = this.sp;
      const frames = this.frames;
      let a, b, v;
      const save = () => { this.pc = pc; this.ssp = ssp; this.fp = fp; this.sp = sp; };
      const self = this;
      // fast inline access checks
      const rd = (addr, n) => { if (addr < lo || addr + n > memSize) { save(); self.segv(addr, n, false); } if (poison[addr] | poison[addr + n - 1]) { save(); self.poisonError(addr, n, false); } };
      const wr = (addr, n) => {
        if (addr < lo || addr + n > memSize) { save(); self.segv(addr, n, true); }
        if (poison[addr] | poison[addr + n - 1]) { save(); self.poisonError(addr, n, true); }
        if (addr < roE && addr + n > roS) { save(); self.fail('segv', 'Segmentation fault: writing to read-only memory (string literals cannot be modified; copy it into a char array first)'); }
      };
      const divz = () => { save(); self.fail('sigfpe', 'Floating point exception: integer division by zero'); };

      for (;;) {
        switch (code[pc++]) {
          case OP.ICONST: S[ssp++] = code[pc++]; break;
          case OP.KCONST: S[ssp++] = consts[code[pc++]]; break;
          case OP.POP: ssp--; break;
          case OP.DUP: S[ssp] = S[ssp - 1]; ssp++; break;
          case OP.DUPX1: a = S[ssp - 1]; b = S[ssp - 2]; S[ssp - 2] = a; S[ssp - 1] = b; S[ssp++] = a; break;
          case OP.SWAP: a = S[ssp - 1]; S[ssp - 1] = S[ssp - 2]; S[ssp - 2] = a; break;

          case OP.LEAL: S[ssp++] = fp + code[pc++]; break;
          case OP.LLOAD: {
            const k = code[pc++], ad = fp + code[pc++];
            switch (k) {
              case 0: rd(ad, 1); S[ssp++] = dv.getInt8(ad); break;
              case 1: rd(ad, 1); S[ssp++] = u8[ad]; break;
              case 2: rd(ad, 2); S[ssp++] = dv.getInt16(ad, true); break;
              case 3: rd(ad, 2); S[ssp++] = dv.getUint16(ad, true); break;
              case 4: rd(ad, 4); S[ssp++] = dv.getInt32(ad, true); break;
              case 5: rd(ad, 4); S[ssp++] = dv.getUint32(ad, true); break;
              case 6: rd(ad, 8); S[ssp++] = dv.getBigInt64(ad, true); break;
              case 7: rd(ad, 8); S[ssp++] = dv.getBigUint64(ad, true); break;
              case 8: rd(ad, 4); S[ssp++] = dv.getFloat32(ad, true); break;
              case 9: rd(ad, 8); S[ssp++] = dv.getFloat64(ad, true); break;
              default: rd(ad, 8); S[ssp++] = dv.getUint32(ad, true);
            }
            break;
          }
          case OP.LSTORE: case OP.LSTOREP: {
            const keep = code[pc - 1] === OP.LSTORE;
            const k = code[pc++], ad = fp + code[pc++];
            v = S[--ssp];
            switch (k) {
              case 0: case 1: wr(ad, 1); u8[ad] = v; break;
              case 2: case 3: wr(ad, 2); dv.setInt16(ad, v, true); break;
              case 4: case 5: wr(ad, 4); dv.setInt32(ad, v, true); break;
              case 6: case 7: wr(ad, 8); dv.setBigInt64(ad, BigInt.asIntN(64, v), true); break;
              case 8: wr(ad, 4); dv.setFloat32(ad, v, true); break;
              case 9: wr(ad, 8); dv.setFloat64(ad, v, true); break;
              default: wr(ad, 8); dv.setUint32(ad, v, true); dv.setUint32(ad + 4, 0, true);
            }
            if (keep) S[ssp++] = v;
            break;
          }
          case OP.LOAD: {
            const k = code[pc++]; a = S[ssp - 1];
            switch (k) {
              case 0: rd(a, 1); S[ssp - 1] = dv.getInt8(a); break;
              case 1: rd(a, 1); S[ssp - 1] = u8[a]; break;
              case 2: rd(a, 2); S[ssp - 1] = dv.getInt16(a, true); break;
              case 3: rd(a, 2); S[ssp - 1] = dv.getUint16(a, true); break;
              case 4: rd(a, 4); S[ssp - 1] = dv.getInt32(a, true); break;
              case 5: rd(a, 4); S[ssp - 1] = dv.getUint32(a, true); break;
              case 6: rd(a, 8); S[ssp - 1] = dv.getBigInt64(a, true); break;
              case 7: rd(a, 8); S[ssp - 1] = dv.getBigUint64(a, true); break;
              case 8: rd(a, 4); S[ssp - 1] = dv.getFloat32(a, true); break;
              case 9: rd(a, 8); S[ssp - 1] = dv.getFloat64(a, true); break;
              default: rd(a, 8); S[ssp - 1] = dv.getUint32(a, true);
            }
            break;
          }
          case OP.STORE: case OP.STOREP: {
            const keep = code[pc - 1] === OP.STORE;
            const k = code[pc++];
            v = S[--ssp]; a = S[--ssp];
            switch (k) {
              case 0: case 1: wr(a, 1); u8[a] = v; break;
              case 2: case 3: wr(a, 2); dv.setInt16(a, v, true); break;
              case 4: case 5: wr(a, 4); dv.setInt32(a, v, true); break;
              case 6: case 7: wr(a, 8); dv.setBigInt64(a, BigInt.asIntN(64, v), true); break;
              case 8: wr(a, 4); dv.setFloat32(a, v, true); break;
              case 9: wr(a, 8); dv.setFloat64(a, v, true); break;
              default: wr(a, 8); dv.setUint32(a, v, true); dv.setUint32(a + 4, 0, true);
            }
            if (keep) S[ssp++] = v;
            break;
          }

          // ---- int32 ----
          case OP.ADD_I: ssp--; S[ssp - 1] = (S[ssp - 1] + S[ssp]) | 0; break;
          case OP.SUB_I: ssp--; S[ssp - 1] = (S[ssp - 1] - S[ssp]) | 0; break;
          case OP.MUL_I: ssp--; S[ssp - 1] = Math.imul(S[ssp - 1], S[ssp]); break;
          case OP.DIV_I: ssp--; b = S[ssp]; a = S[ssp - 1]; if (b === 0 || (b === -1 && a === I32_MIN)) { save(); divz(); } S[ssp - 1] = (a / b) | 0; break;
          case OP.MOD_I: ssp--; b = S[ssp]; a = S[ssp - 1]; if (b === 0 || (b === -1 && a === I32_MIN)) { save(); divz(); } S[ssp - 1] = (a % b) | 0; break;
          case OP.AND_I: ssp--; S[ssp - 1] = S[ssp - 1] & S[ssp]; break;
          case OP.OR_I: ssp--; S[ssp - 1] = S[ssp - 1] | S[ssp]; break;
          case OP.XOR_I: ssp--; S[ssp - 1] = S[ssp - 1] ^ S[ssp]; break;
          case OP.SHL_I: ssp--; S[ssp - 1] = S[ssp - 1] << S[ssp]; break;
          case OP.SHR_I: ssp--; S[ssp - 1] = S[ssp - 1] >> S[ssp]; break;
          // ---- uint32 / pointers ----
          case OP.ADD_U: ssp--; S[ssp - 1] = (S[ssp - 1] + S[ssp]) >>> 0; break;
          case OP.SUB_U: ssp--; S[ssp - 1] = (S[ssp - 1] - S[ssp]) >>> 0; break;
          case OP.MUL_U: ssp--; S[ssp - 1] = Math.imul(S[ssp - 1], S[ssp]) >>> 0; break;
          case OP.DIV_U: ssp--; b = S[ssp]; if (b === 0) { save(); divz(); } S[ssp - 1] = Math.floor(S[ssp - 1] / b) >>> 0; break;
          case OP.MOD_U: ssp--; b = S[ssp]; if (b === 0) { save(); divz(); } S[ssp - 1] = (S[ssp - 1] % b) >>> 0; break;
          case OP.AND_U: ssp--; S[ssp - 1] = (S[ssp - 1] & S[ssp]) >>> 0; break;
          case OP.OR_U: ssp--; S[ssp - 1] = (S[ssp - 1] | S[ssp]) >>> 0; break;
          case OP.XOR_U: ssp--; S[ssp - 1] = (S[ssp - 1] ^ S[ssp]) >>> 0; break;
          case OP.SHL_U: ssp--; S[ssp - 1] = (S[ssp - 1] << S[ssp]) >>> 0; break;
          case OP.SHR_U: ssp--; S[ssp - 1] = S[ssp - 1] >>> S[ssp]; break;
          // ---- int64 ----
          case OP.ADD_L: ssp--; S[ssp - 1] = BigInt.asIntN(64, S[ssp - 1] + S[ssp]); break;
          case OP.SUB_L: ssp--; S[ssp - 1] = BigInt.asIntN(64, S[ssp - 1] - S[ssp]); break;
          case OP.MUL_L: ssp--; S[ssp - 1] = BigInt.asIntN(64, S[ssp - 1] * S[ssp]); break;
          case OP.DIV_L: ssp--; b = S[ssp]; a = S[ssp - 1]; if (b === 0n || (b === -1n && a === I64_MIN)) { save(); divz(); } S[ssp - 1] = a / b; break;
          case OP.MOD_L: ssp--; b = S[ssp]; a = S[ssp - 1]; if (b === 0n || (b === -1n && a === I64_MIN)) { save(); divz(); } S[ssp - 1] = a % b; break;
          case OP.AND_L: ssp--; S[ssp - 1] = S[ssp - 1] & S[ssp]; break;
          case OP.OR_L: ssp--; S[ssp - 1] = S[ssp - 1] | S[ssp]; break;
          case OP.XOR_L: ssp--; S[ssp - 1] = S[ssp - 1] ^ S[ssp]; break;
          case OP.SHL_L: ssp--; S[ssp - 1] = BigInt.asIntN(64, S[ssp - 1] << (S[ssp] & 63n)); break;
          case OP.SHR_L: ssp--; S[ssp - 1] = S[ssp - 1] >> (S[ssp] & 63n); break;
          // ---- uint64 ----
          case OP.ADD_UL: ssp--; S[ssp - 1] = BigInt.asUintN(64, S[ssp - 1] + S[ssp]); break;
          case OP.SUB_UL: ssp--; S[ssp - 1] = BigInt.asUintN(64, S[ssp - 1] - S[ssp]); break;
          case OP.MUL_UL: ssp--; S[ssp - 1] = BigInt.asUintN(64, S[ssp - 1] * S[ssp]); break;
          case OP.DIV_UL: ssp--; b = S[ssp]; if (b === 0n) { save(); divz(); } S[ssp - 1] = S[ssp - 1] / b; break;
          case OP.MOD_UL: ssp--; b = S[ssp]; if (b === 0n) { save(); divz(); } S[ssp - 1] = S[ssp - 1] % b; break;
          case OP.AND_UL: ssp--; S[ssp - 1] = S[ssp - 1] & S[ssp]; break;
          case OP.OR_UL: ssp--; S[ssp - 1] = S[ssp - 1] | S[ssp]; break;
          case OP.XOR_UL: ssp--; S[ssp - 1] = S[ssp - 1] ^ S[ssp]; break;
          case OP.SHL_UL: ssp--; S[ssp - 1] = BigInt.asUintN(64, S[ssp - 1] << (S[ssp] & 63n)); break;
          case OP.SHR_UL: ssp--; S[ssp - 1] = S[ssp - 1] >> (S[ssp] & 63n); break;
          // ---- float / double ----
          case OP.ADD_F: ssp--; S[ssp - 1] = Math.fround(S[ssp - 1] + S[ssp]); break;
          case OP.SUB_F: ssp--; S[ssp - 1] = Math.fround(S[ssp - 1] - S[ssp]); break;
          case OP.MUL_F: ssp--; S[ssp - 1] = Math.fround(S[ssp - 1] * S[ssp]); break;
          case OP.DIV_F: ssp--; S[ssp - 1] = Math.fround(S[ssp - 1] / S[ssp]); break;
          case OP.ADD_D: ssp--; S[ssp - 1] = S[ssp - 1] + S[ssp]; break;
          case OP.SUB_D: ssp--; S[ssp - 1] = S[ssp - 1] - S[ssp]; break;
          case OP.MUL_D: ssp--; S[ssp - 1] = S[ssp - 1] * S[ssp]; break;
          case OP.DIV_D: ssp--; S[ssp - 1] = S[ssp - 1] / S[ssp]; break;
          // ---- comparisons (numbers and BigInts both work with JS relational operators) ----
          case OP.EQ_I: case OP.EQ_U: case OP.EQ_L: case OP.EQ_F: ssp--; S[ssp - 1] = S[ssp - 1] === S[ssp] ? 1 : 0; break;
          case OP.NE_I: case OP.NE_U: case OP.NE_L: case OP.NE_F: ssp--; S[ssp - 1] = S[ssp - 1] !== S[ssp] ? 1 : 0; break;
          case OP.LT_I: case OP.LT_U: case OP.LT_L: case OP.LT_F: ssp--; S[ssp - 1] = S[ssp - 1] < S[ssp] ? 1 : 0; break;
          case OP.GT_I: case OP.GT_U: case OP.GT_L: case OP.GT_F: ssp--; S[ssp - 1] = S[ssp - 1] > S[ssp] ? 1 : 0; break;
          case OP.LE_I: case OP.LE_U: case OP.LE_L: case OP.LE_F: ssp--; S[ssp - 1] = S[ssp - 1] <= S[ssp] ? 1 : 0; break;
          case OP.GE_I: case OP.GE_U: case OP.GE_L: case OP.GE_F: ssp--; S[ssp - 1] = S[ssp - 1] >= S[ssp] ? 1 : 0; break;

          // ---- unary / conversions ----
          case OP.NEG: {
            const c = code[pc++]; a = S[ssp - 1];
            S[ssp - 1] = c === 0 ? (-a) | 0 : c === 1 ? (-a) >>> 0 : c === 2 ? BigInt.asIntN(64, -a) : c === 3 ? BigInt.asUintN(64, -a) : c === 4 ? Math.fround(-a) : -a;
            break;
          }
          case OP.BNOT: {
            const c = code[pc++]; a = S[ssp - 1];
            S[ssp - 1] = c === 0 ? ~a : c === 1 ? (~a) >>> 0 : c === 2 ? ~a : BigInt.asUintN(64, ~a);
            break;
          }
          case OP.LNOT: { const c = code[pc++]; a = S[ssp - 1]; S[ssp - 1] = (c === 2 || c === 3) ? (a === 0n ? 1 : 0) : (a === 0 ? 1 : 0); break; }
          case OP.TOBOOL: { const c = code[pc++]; a = S[ssp - 1]; S[ssp - 1] = (c === 2 || c === 3) ? (a !== 0n ? 1 : 0) : (a !== 0 ? 1 : 0); break; }
          case OP.CONV: S[ssp - 1] = conv(S[ssp - 1], code[pc++]); break;
          case OP.NARROW: {
            const k = code[pc++]; a = S[ssp - 1];
            S[ssp - 1] = k === 0 ? (a << 24) >> 24 : k === 1 ? a & 255 : k === 2 ? (a << 16) >> 16 : a & 65535;
            break;
          }

          // ---- control ----
          case OP.JMP: pc = code[pc]; if (--budget <= 0) { save(); return 'yield'; } break;
          case OP.JZ: if (S[--ssp] === 0) { pc = code[pc]; if (--budget <= 0) { save(); return 'yield'; } } else pc++; break;
          case OP.JNZ: if (S[--ssp] !== 0) { pc = code[pc]; if (--budget <= 0) { save(); return 'yield'; } } else pc++; break;
          case OP.SWITCH: { const t = consts[code[pc++]]; v = S[--ssp]; const d = t.map.get(v); pc = d === undefined ? t.def : d; break; }
          case OP.ENTER: {
            const fs = code[pc++];
            if (frames.length >= MAX_FRAMES) { save(); self.fail('stack-overflow', 'Stack overflow: too many nested function calls (infinite recursion?)'); }
            fp = sp - fs; if (fp < this.stackLimit) { save(); self.fail('stack-overflow', 'Stack overflow: the program used too much stack (infinite recursion or a huge local array?)'); }
            sp = fp;
            // poison the stack frame so leftovers from earlier calls look like garbage, then mark array red zones
            u8.fill(0xCC, fp, fp + fs);
            const f = this.funcs[this.curFn];
            if (f.redzones && f.redzones.length) for (const r of f.redzones) poison.fill(P_STACK, fp + r.off, fp + r.off + r.len);
            break;
          }
          case OP.CALL: {
            const fi = code[pc++], argc = code[pc++];
            const f = this.funcs[fi];
            frames.push({ ret: pc, fp, sp, fn: this.curFn });
            this.curFn = fi; this.stats.calls++;
            pc = f.entry;
            if (--budget <= 0) { save(); return 'yield'; }
            break;
          }
          case OP.CALLI: {
            const argc = code[pc++]; a = S[--ssp];
            const fi = ((a - MEM.FUNC_BASE) / MEM.FUNC_STRIDE) | 0;
            const f = this.funcs[fi];
            if (a < MEM.FUNC_BASE || (a - MEM.FUNC_BASE) % MEM.FUNC_STRIDE !== 0 || !f || f.entry === undefined) {
              save(); self.fail('segv', 'Segmentation fault: calling through an invalid function pointer (' + (a === 0 ? 'NULL' : hex(a)) + ')');
            }
            frames.push({ ret: pc, fp, sp, fn: this.curFn });
            this.curFn = fi; this.stats.calls++;
            pc = f.entry;
            if (--budget <= 0) { save(); return 'yield'; }
            break;
          }
          case OP.CALLB: {
            const bi = code[pc++], argc = code[pc++];
            const bf = this.builtins[bi];
            const args = argc ? S.slice(ssp - argc, ssp) : [];
            save();
            const r = bf.fn(this, args);
            if (r === WAIT) { this.pc = pc - 3; return 'wait'; }
            ssp -= argc; S[ssp++] = r === undefined ? 0 : r;
            this.ssp = ssp;
            sp = this.sp; // builtins never move sp
            break;
          }
          case OP.RET: {
            const f = this.funcs[this.curFn];
            if (f.redzones.length) poison.fill(0, fp, fp + f.frameSize);
            const fr = frames.pop();
            fp = fr.fp; sp = fr.sp; pc = fr.ret; this.curFn = fr.fn;
            break;
          }
          case OP.MEMCPY: {
            const n = code[pc++]; a = S[--ssp]; b = S[ssp - 1]; // a = src, b = dst
            if (n > 0) { save(); self.chkRange(a, n, false); self.chkRange(b, n, true); u8.copyWithin(b, a, a + n); }
            break;
          }
          case OP.MEMZERO: {
            const n = code[pc++]; a = S[--ssp];
            if (n > 0) { save(); self.chkRange(a, n, true); u8.fill(0, a, a + n); }
            break;
          }
          case OP.ALLOCA: {
            const unit = code[pc++]; let n = S[ssp - 1];
            n = typeof n === 'bigint' ? Number(n) : n;
            n = n * unit; if (!(n >= 0) || n > STACK_BYTES) { save(); self.fail('stack-overflow', 'Stack overflow: variable-length array is too large (' + n + ' bytes)'); }
            n = (n + 15) & ~15;
            sp -= n; if (sp < this.stackLimit) { save(); self.fail('stack-overflow', 'Stack overflow: variable-length array is too large'); }
            u8.fill(0xCC, sp, sp + n);
            S[ssp - 1] = sp;
            break;
          }
          case OP.LINE: pc++; break;
          case OP.HALT: { v = S[--ssp]; save(); this.exitCode = typeof v === 'bigint' ? Number(BigInt.asIntN(32, v)) : v | 0; this.done = true; return 'done'; }
          default:
            save(); self.fail('internal', 'Internal error: bad instruction ' + code[pc - 1] + ' at ' + (pc - 1));
        }
      }
    }
  }

  CC.VM = VM; CC.RunError = RunError; CC.ExitSignal = ExitSignal; CC.WAIT = WAIT;
  CC.VMLIMITS = { HEAP_BYTES, STACK_BYTES, OUT_LIMIT };
})(typeof globalThis !== 'undefined' ? globalThis : self);
