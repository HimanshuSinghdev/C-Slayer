/* C-Slayer · C library builtins implemented in JS.
 * Argument conventions follow the C prototypes: int/char -> number, long/size_t -> BigInt, double/float -> number, pointers -> number.
 * Every memory access goes through the VM's checked helpers, so library calls can never corrupt anything outside the program.
 */
(function (g) {
  'use strict';
  const CC = g.CC = g.CC || {};
  const WAIT = CC.WAIT;
  const B = new Map();                 // name -> {fn}
  const headerOwner = new Map();       // function name -> header
  const def = (name, fn) => { B.set(name, { name, fn }); };

  const num = (x) => typeof x === 'bigint' ? Number(x) : x;
  const big = (x) => typeof x === 'bigint' ? x : BigInt(Math.trunc(x) || 0);
  const UL = (n) => BigInt.asUintN(64, BigInt(n));
  const L = (n) => BigInt.asIntN(64, BigInt(n));
  const isSpace = (c) => c === 32 || (c >= 9 && c <= 13);
  const isDigit = (c) => c >= 48 && c <= 57;
  const isAlpha = (c) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
  const ENOENT = 2, EINVAL = 22, ERANGE = 34, EDOM = 33, EBADF = 9, EACCES = 13;

  function setErrno(vm, v) {
    const a = vm.symAddr && vm.symAddr.get('errno');
    if (a) vm.dv.setInt32(a, v, true);
  }
  function curLine(vm) { return vm.lineAt(vm.pc - 1); }

  // ---------------------------------------------------------------- exact float formatting
  const f64 = new DataView(new ArrayBuffer(8));
  function decompose(x) { // x > 0 finite -> {m: BigInt, e} with x = m * 2^e
    f64.setFloat64(0, x);
    const hi = f64.getUint32(0), lo = f64.getUint32(4);
    const exp = (hi >>> 20) & 0x7ff;
    let m = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
    if (exp === 0) return { m, e: -1074 };
    return { m: m | (1n << 52n), e: exp - 1075 };
  }
  const POW10 = [1n];
  const p10 = (n) => { while (POW10.length <= n) POW10.push(POW10[POW10.length - 1] * 10n); return POW10[n]; };
  function ratioRound(num, den) { // round-half-even(num/den)
    let q = num / den; const r = num % den; const t = r * 2n;
    if (t > den || (t === den && (q & 1n))) q++;
    return q;
  }
  function fixedDigits(ax, p) { // ax >= 0 -> string with p fractional digits (no sign)
    let N;
    if (ax === 0) N = 0n;
    else {
      const { m, e } = decompose(ax);
      if (e >= 0) N = (m << BigInt(e)) * p10(p);
      else N = ratioRound(m * p10(p), 1n << BigInt(-e));
    }
    let s = N.toString();
    if (p === 0) return s;
    if (s.length <= p) s = '0'.repeat(p - s.length + 1) + s;
    return s.slice(0, s.length - p) + '.' + s.slice(s.length - p);
  }
  function sciParts(ax, p) { // -> {digits: string of p+1 digits, exp: int}
    if (ax === 0) return { digits: '0'.repeat(p + 1), exp: 0 };
    const { m, e } = decompose(ax);
    let X = Math.floor(Math.log10(ax));
    for (let tries = 0; tries < 4; tries++) {
      const a = p - X;
      let num = m, den = 1n;
      if (e >= 0) num <<= BigInt(e); else den <<= BigInt(-e);
      if (a >= 0) num *= p10(a); else den *= p10(-a);
      const N = ratioRound(num, den);
      const s = N.toString();
      if (s.length === p + 1) return { digits: s, exp: X };
      if (s.length > p + 1) X++; else X--;
    }
    return { digits: '0'.repeat(p + 1), exp: X };
  }
  function expStr(X, upper) { return (upper ? 'E' : 'e') + (X < 0 ? '-' : '+') + String(Math.abs(X)).padStart(2, '0'); }
  function fmtFloat(x, conv, prec, flags) {
    const upper = conv === 'E' || conv === 'G' || conv === 'F' || conv === 'A';
    let neg = x < 0 || Object.is(x, -0);
    if (x !== x) { f64.setFloat64(0, x); neg = (f64.getUint32(0) >>> 31) === 1; return { body: upper ? 'NAN' : 'nan', neg, special: true }; }
    if (!isFinite(x)) return { body: upper ? 'INF' : 'inf', neg, special: true };
    const ax = Math.abs(x);
    const lc = conv.toLowerCase();
    let body;
    if (lc === 'f') {
      const p = prec === null ? 6 : prec;
      body = fixedDigits(ax, p);
      if (p === 0 && flags.hash) body += '.';
    } else if (lc === 'e') {
      const p = prec === null ? 6 : prec;
      const { digits, exp } = sciParts(ax, p);
      body = digits[0] + (p > 0 ? '.' + digits.slice(1) : (flags.hash ? '.' : '')) + expStr(exp, upper);
    } else if (lc === 'g') {
      let P = prec === null ? 6 : (prec === 0 ? 1 : prec);
      const { exp: X } = sciParts(ax, P - 1);
      if (X >= -4 && X < P) {
        body = fixedDigits(ax, P - 1 - X);
        if (!flags.hash && body.indexOf('.') >= 0) body = body.replace(/0+$/, '').replace(/\.$/, '');
        else if (flags.hash && body.indexOf('.') < 0) body += '.';
      } else {
        const { digits, exp } = sciParts(ax, P - 1);
        let mant = digits[0] + (P > 1 ? '.' + digits.slice(1) : '');
        if (!flags.hash && mant.indexOf('.') >= 0) mant = mant.replace(/0+$/, '').replace(/\.$/, '');
        body = mant + expStr(exp, upper);
      }
    } else { // %a: rarely used; fall back to a simple hex float
      body = ax.toString(16);
    }
    return { body, neg, special: false };
  }

  // ---------------------------------------------------------------- printf engine
  function fmtPrintf(vm, fmt, args, ai, vaPtr) {
    const out = [];
    const push = (s) => { for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i)); };
    let i = 0;
    // vaPtr: address of a va_list buffer (8-byte slots written by the caller of a user-defined variadic function)
    let vp = vaPtr === undefined ? -1 : vaPtr;
    const nextArg = (kind) => {
      if (vp >= 0) { vm.chk(vp, 8, false); const x = kind === 'f' ? vm.dv.getFloat64(vp, true) : vm.dv.getBigInt64(vp, true); vp += 8; return x; }
      return ai < args.length ? args[ai++] : 0;
    };
    while (i < fmt.length) {
      const c = fmt[i++];
      if (c !== 37) { out.push(c); continue; }
      const flags = { minus: false, plus: false, space: false, hash: false, zero: false };
      for (;;) {
        const f = fmt[i];
        if (f === 45) flags.minus = true; else if (f === 43) flags.plus = true; else if (f === 32) flags.space = true;
        else if (f === 35) flags.hash = true; else if (f === 48) flags.zero = true; else break;
        i++;
      }
      let width = null;
      if (fmt[i] === 42) { width = Number(BigInt.asIntN(32, big(nextArg()))); if (width < 0) { flags.minus = true; width = -width; } i++; }
      else { let w = 0, has = false; while (isDigit(fmt[i])) { w = w * 10 + fmt[i] - 48; i++; has = true; } if (has) width = Math.min(w, 100000); }
      let prec = null;
      if (fmt[i] === 46) {
        i++;
        if (fmt[i] === 42) { prec = Number(BigInt.asIntN(32, big(nextArg()))); if (prec < 0) prec = null; i++; }
        else { let p = 0; while (isDigit(fmt[i])) { p = p * 10 + fmt[i] - 48; i++; } prec = Math.min(p, 100000); }
      }
      let len = '';
      while (fmt[i] === 104 || fmt[i] === 108 || fmt[i] === 76 || fmt[i] === 106 || fmt[i] === 122 || fmt[i] === 116 || fmt[i] === 113) { len += String.fromCharCode(fmt[i]); i++; }
      if (i >= fmt.length) break;
      const conv = String.fromCharCode(fmt[i++]);
      const bits = len === 'hh' ? 8 : len === 'h' ? 16 : (len === '' ? 32 : 64);
      let sign = '', body = '', prefix = '', numeric = false, bytes = null;
      switch (conv) {
        case 'd': case 'i': {
          const v = BigInt.asIntN(bits, big(nextArg()));
          numeric = true;
          let s = (v < 0n ? -v : v).toString();
          if (prec !== null) { if (prec === 0 && v === 0n) s = ''; s = s.padStart(prec, '0'); }
          sign = v < 0n ? '-' : flags.plus ? '+' : flags.space ? ' ' : '';
          body = s;
          if (prec !== null) flags.zero = false;
          break;
        }
        case 'u': case 'x': case 'X': case 'o': {
          const v = BigInt.asUintN(bits, big(nextArg()));
          numeric = true;
          const base = conv === 'u' ? 10 : conv === 'o' ? 8 : 16;
          let s = v.toString(base);
          if (conv === 'X') s = s.toUpperCase();
          if (prec !== null) { if (prec === 0 && v === 0n) s = ''; s = s.padStart(prec, '0'); flags.zero = false; }
          if (flags.hash && v !== 0n) { if (conv === 'x') prefix = '0x'; else if (conv === 'X') prefix = '0X'; else if (conv === 'o' && s[0] !== '0') s = '0' + s; }
          body = s;
          break;
        }
        case 'c': { bytes = [Number(BigInt.asUintN(8, big(nextArg())))]; break; }
        case 's': {
          const p = num(nextArg());
          if (p === 0) { bytes = Array.from('(null)', ch => ch.charCodeAt(0)); if (prec !== null && prec < 6) bytes = bytes.slice(0, prec); }
          else { bytes = vm.readCStr(p, prec === null ? undefined : prec); }
          break;
        }
        case 'p': {
          const p = num(nextArg());
          bytes = Array.from(p === 0 ? '(nil)' : '0x' + p.toString(16), ch => ch.charCodeAt(0));
          break;
        }
        case 'f': case 'F': case 'e': case 'E': case 'g': case 'G': case 'a': case 'A': {
          let x = nextArg('f'); x = typeof x === 'bigint' ? Number(x) : x;
          const r = fmtFloat(x, conv, prec, flags);
          numeric = true;
          sign = r.neg ? '-' : flags.plus ? '+' : flags.space ? ' ' : '';
          body = r.body;
          if (r.special) flags.zero = false;
          break;
        }
        case '%': bytes = [37]; break;
        case 'n': nextArg(); bytes = []; break;   // %n is deliberately ignored (it is a classic exploit vector)
        default: bytes = [37, conv.charCodeAt(0)];
      }
      if (bytes === null) {
        const total = sign.length + prefix.length + body.length;
        const pad = width !== null && width > total ? width - total : 0;
        if (flags.minus) { push(sign + prefix + body); for (let k = 0; k < pad; k++) out.push(32); }
        else if (flags.zero && numeric) { push(sign + prefix); for (let k = 0; k < pad; k++) out.push(48); push(body); }
        else { for (let k = 0; k < pad; k++) out.push(32); push(sign + prefix + body); }
      } else {
        const pad = width !== null && width > bytes.length ? width - bytes.length : 0;
        if (!flags.minus) for (let k = 0; k < pad; k++) out.push(32);
        for (let k = 0; k < bytes.length; k++) out.push(bytes[k]);
        if (flags.minus) for (let k = 0; k < pad; k++) out.push(32);
      }
      if (out.length > 4 * 1024 * 1024) vm.fail('output-limit', 'A single printf produced far too much output.');
    }
    return out;
  }

  // ---------------------------------------------------------------- scanf engine
  function stdinSource(vm) {
    return { peek: (k) => { const i = vm.inPos + k; if (i < vm.inBytes.length) return vm.inBytes[i]; return vm.inEOF ? -1 : -2; }, commit: (k) => { vm.inPos += k; if (vm.inPos >= vm.inBytes.length && vm.inEOF) vm.stdinAtEof = true; } };
  }
  function arraySource(arr, getPos, setPos) {
    return { peek: (k) => { const i = getPos() + k; return i < arr.length ? arr[i] : -1; }, commit: (k) => setPos(getPos() + k) };
  }
  const WAITR = { wait: true };
  function doScanf(vm, src, fmt, args, ai) {
    let k = 0, count = 0, fi = 0, assigned = false;
    const peek = (j) => src.peek(k + j);
    const eofResult = () => (count === 0 && !assigned ? -1 : count);
    scan:
    while (fi < fmt.length) {
      const c = fmt[fi++];
      if (isSpace(c)) {
        for (;;) { const b = peek(0); if (b === -2) return WAITR; if (b >= 0 && isSpace(b)) k++; else break; }
        continue;
      }
      if (c !== 37) {
        const b = peek(0);
        if (b === -2) return WAITR;
        if (b === -1) { src.commit(k); return { n: eofResult() }; }
        if (b !== c) break scan;
        k++; continue;
      }
      // conversion spec
      let suppress = false, width = 0;
      if (fmt[fi] === 42) { suppress = true; fi++; }
      while (isDigit(fmt[fi])) { width = width * 10 + fmt[fi] - 48; fi++; }
      let len = '';
      while (fmt[fi] === 104 || fmt[fi] === 108 || fmt[fi] === 76 || fmt[fi] === 106 || fmt[fi] === 122 || fmt[fi] === 116) { len += String.fromCharCode(fmt[fi]); fi++; }
      const conv = String.fromCharCode(fmt[fi++]);
      if (conv === '%') {
        for (;;) { const b = peek(0); if (b === -2) return WAITR; if (b >= 0 && isSpace(b)) k++; else break; }
        const b = peek(0); if (b === -2) return WAITR; if (b !== 37) break scan; k++; continue;
      }
      if (conv === 'n') { if (!suppress) { const p = num(args[ai++]); vm.chk(p, 4, true); vm.dv.setInt32(p, k, true); } continue; }
      if (conv !== 'c' && conv !== '[') {
        for (;;) { const b = peek(0); if (b === -2) return WAITR; if (b >= 0 && isSpace(b)) k++; else break; }
      }
      const maxw = width || 1e9;
      if (conv === 'd' || conv === 'i' || conv === 'u' || conv === 'x' || conv === 'X' || conv === 'o' || conv === 'p') {
        let b = peek(0); if (b === -2) return WAITR;
        if (b === -1) { src.commit(k); return { n: eofResult() }; }
        let n = 0, neg = false, base = conv === 'x' || conv === 'X' || conv === 'p' ? 16 : conv === 'o' ? 8 : 10;
        if ((b === 43 || b === 45) && n < maxw) { neg = b === 45; n++; }
        let b2 = peek(n); if (b2 === -2) return WAITR;
        if ((conv === 'i' || base === 16) && b2 === 48 && n < maxw) {
          const b3 = peek(n + 1); if (b3 === -2) return WAITR;
          if (b3 === 120 || b3 === 88) { const b4 = peek(n + 2); if (b4 === -2) return WAITR; if (b4 >= 0 && /[0-9a-fA-F]/.test(String.fromCharCode(b4))) { base = 16; n += 2; } }
          else if (conv === 'i') base = 8;
        }
        let digits = '';
        for (;;) {
          if (n >= maxw) break;
          const d = peek(n); if (d === -2) return WAITR;
          if (d < 0) break;
          const ch = String.fromCharCode(d);
          const v = parseInt(ch, 16);
          if (isNaN(v) || v >= base || !/[0-9a-fA-F]/.test(ch)) break;
          digits += ch; n++;
        }
        if (!digits) break scan;
        k += n;
        let v = BigInt((base === 16 ? '0x' : base === 8 ? '0o' : '') + digits);
        if (neg) v = -v;
        if (!suppress) {
          const p = num(args[ai++]);
          const bits = len === 'hh' ? 8 : len === 'h' ? 16 : (len === 'l' || len === 'll' || len === 'j' || len === 'z' || len === 't') ? 64 : 32;
          if (p === undefined) break scan;
          const sz = bits / 8; vm.chk(p, sz, true);
          if (sz === 1) vm.u8[p] = Number(BigInt.asUintN(8, v)); else if (sz === 2) vm.dv.setUint16(p, Number(BigInt.asUintN(16, v)), true);
          else if (sz === 4) vm.dv.setUint32(p, Number(BigInt.asUintN(32, v)), true); else vm.dv.setBigUint64(p, BigInt.asUintN(64, v), true);
          count++; assigned = true;
        }
      } else if (conv === 'f' || conv === 'e' || conv === 'g' || conv === 'E' || conv === 'G' || conv === 'a') {
        let b = peek(0); if (b === -2) return WAITR;
        if (b === -1) { src.commit(k); return { n: eofResult() }; }
        let n = 0, txt = '';
        const take = () => { const d = peek(n); return d; };
        let d = take(); if (d === -2) return WAITR;
        if ((d === 43 || d === 45) && n < maxw) { txt += String.fromCharCode(d); n++; }
        // inf / nan
        const rest = [];
        for (let j = 0; j < 3; j++) { const x = peek(n + j); if (x === -2) return WAITR; rest.push(x); }
        const word = String.fromCharCode(...rest.filter(x => x > 0)).toLowerCase();
        let value;
        if (word === 'inf') { n += 3; value = txt === '-' ? -Infinity : Infinity; }
        else if (word === 'nan') { n += 3; value = NaN; }
        else {
          let seenDigit = false;
          for (;;) { d = peek(n); if (d === -2) return WAITR; if (n < maxw && d >= 48 && d <= 57) { txt += String.fromCharCode(d); n++; seenDigit = true; } else break; }
          if (d === 46 && n < maxw) { txt += '.'; n++; for (;;) { d = peek(n); if (d === -2) return WAITR; if (n < maxw && d >= 48 && d <= 57) { txt += String.fromCharCode(d); n++; seenDigit = true; } else break; } }
          if (!seenDigit) break scan;
          if ((d === 101 || d === 69) && n < maxw) {
            let m = n + 1, e = 'e'; let d2 = peek(m); if (d2 === -2) return WAITR;
            if (d2 === 43 || d2 === 45) { e += String.fromCharCode(d2); m++; d2 = peek(m); if (d2 === -2) return WAITR; }
            if (d2 >= 48 && d2 <= 57) { for (;;) { d2 = peek(m); if (d2 === -2) return WAITR; if (d2 >= 48 && d2 <= 57) { e += String.fromCharCode(d2); m++; } else break; } txt += e; n = m; }
          }
          value = parseFloat(txt);
        }
        k += n;
        if (!suppress) {
          const p = num(args[ai++]);
          if (len === 'l' || len === 'L') { vm.chk(p, 8, true); vm.dv.setFloat64(p, value, true); }
          else { vm.chk(p, 4, true); vm.dv.setFloat32(p, value, true); }
          count++; assigned = true;
        }
      } else if (conv === 's') {
        let b = peek(0); if (b === -2) return WAITR;
        if (b === -1) { src.commit(k); return { n: eofResult() }; }
        const bytes = []; let n = 0;
        for (;;) {
          if (n >= maxw) break;
          const d = peek(n); if (d === -2) return WAITR;
          if (d < 0 || isSpace(d)) break;
          bytes.push(d); n++;
        }
        if (!bytes.length) break scan;
        k += n;
        if (!suppress) { const p = num(args[ai++]); vm.chkRange(p, bytes.length + 1, true); vm.u8.set(bytes, p); vm.u8[p + bytes.length] = 0; count++; assigned = true; }
      } else if (conv === 'c') {
        const w = width || 1; const bytes = [];
        for (let j = 0; j < w; j++) { const d = peek(j); if (d === -2) return WAITR; if (d < 0) break; bytes.push(d); }
        if (bytes.length === 0) { src.commit(k); return { n: eofResult() }; }
        if (bytes.length < w) break scan;
        k += w;
        if (!suppress) { const p = num(args[ai++]); vm.chkRange(p, bytes.length, true); vm.u8.set(bytes, p); count++; assigned = true; }
      } else if (conv === '[') {
        let neg = false; const set = new Set();
        if (fmt[fi] === 94) { neg = true; fi++; }
        if (fmt[fi] === 93) { set.add(93); fi++; }
        while (fi < fmt.length && fmt[fi] !== 93) {
          if (fmt[fi + 1] === 45 && fmt[fi + 2] !== 93 && fmt[fi + 2] !== undefined) { for (let x = fmt[fi]; x <= fmt[fi + 2]; x++) set.add(x); fi += 3; }
          else { set.add(fmt[fi]); fi++; }
        }
        fi++;
        const bytes = []; let n = 0;
        for (;;) {
          if (n >= maxw) break;
          const d = peek(n); if (d === -2) return WAITR;
          if (d < 0) break;
          if (set.has(d) === neg) break;
          bytes.push(d); n++;
        }
        if (!bytes.length) { if (peek(0) === -1) { src.commit(k); return { n: eofResult() }; } break scan; }
        k += n;
        if (!suppress) { const p = num(args[ai++]); vm.chkRange(p, bytes.length + 1, true); vm.u8.set(bytes, p); vm.u8[p + bytes.length] = 0; count++; assigned = true; }
      } else { break scan; }
    }
    src.commit(k);
    return { n: count };
  }

  // ---------------------------------------------------------------- files
  function fdOf(vm, fp) {
    vm.chk(fp, 4, false);
    return vm.dv.getInt32(fp, true);
  }
  function fileObj(vm, fp) {
    const fd = fdOf(vm, fp);
    const f = vm.files.get(fd);
    return { fd, f };
  }
  function writeFd(vm, fd, bytes) {
    if (fd === 1 || fd === 2) { vm.emit(fd, bytes); return bytes.length; }
    const f = vm.files.get(fd);
    if (!f || !f.write) { return -1; }
    const d = f.entry.data;
    if (f.append) f.pos = d.length;
    for (let i = 0; i < bytes.length; i++) d[f.pos + i] = bytes[i];
    f.pos += bytes.length;
    return bytes.length;
  }
  function srcForFile(vm, fp) {
    const fd = fdOf(vm, fp);
    if (fd === 0) return { src: stdinSource(vm), fd, std: true };
    const f = vm.files.get(fd);
    if (!f || !f.read) return null;
    return { src: arraySource(f.entry.data, () => f.pos, (p) => { f.pos = p; }), fd, f };
  }
  function cstrArg(vm, p) { return vm.readCStr(num(p)); }
  const ASCII = (s) => Array.from(s, ch => ch.charCodeAt(0));

  // ---------------------------------------------------------------- stdio
  def('printf', (vm, a) => { const fmt = cstrArg(vm, a[0]); const out = fmtPrintf(vm, fmt, a, 1); vm.emit(1, out); return out.length; });
  def('fprintf', (vm, a) => {
    const fd = fdOf(vm, num(a[0])); const fmt = cstrArg(vm, a[1]); const out = fmtPrintf(vm, fmt, a, 2);
    const r = writeFd(vm, fd, out); return r; });
  def('vprintf', (vm, a) => { const out = fmtPrintf(vm, cstrArg(vm, a[0]), a, 1, num(a[1])); vm.emit(1, out); return out.length; });
  def('vfprintf', (vm, a) => { const fd = fdOf(vm, num(a[0])); const out = fmtPrintf(vm, cstrArg(vm, a[1]), a, 2, num(a[2])); return writeFd(vm, fd, out); });
  def('vsprintf', (vm, a) => { const p = num(a[0]); const out = fmtPrintf(vm, cstrArg(vm, a[1]), a, 2, num(a[2])); vm.chkRange(p, out.length + 1, true); vm.u8.set(out, p); vm.u8[p + out.length] = 0; return out.length; });
  def('vsnprintf', (vm, a) => {
    const p = num(a[0]), size = num(a[1]); const out = fmtPrintf(vm, cstrArg(vm, a[2]), a, 3, num(a[3]));
    if (size > 0) { const n = Math.min(out.length, size - 1); vm.chkRange(p, n + 1, true); vm.u8.set(out.slice(0, n), p); vm.u8[p + n] = 0; }
    return out.length;
  });
  def('sprintf', (vm, a) => { const p = num(a[0]); const out = fmtPrintf(vm, cstrArg(vm, a[1]), a, 2); vm.chkRange(p, out.length + 1, true); vm.u8.set(out, p); vm.u8[p + out.length] = 0; return out.length; });
  def('snprintf', (vm, a) => {
    const p = num(a[0]), size = num(a[1]); const out = fmtPrintf(vm, cstrArg(vm, a[2]), a, 3);
    if (size > 0) { const n = Math.min(out.length, size - 1); vm.chkRange(p, n + 1, true); vm.u8.set(out.slice(0, n), p); vm.u8[p + n] = 0; }
    return out.length;
  });
  def('puts', (vm, a) => { const s = cstrArg(vm, a[0]); s.push(10); vm.emit(1, s); return 1; });
  def('putchar', (vm, a) => { const c = a[0] & 255; vm.emit(1, [c]); return c; });
  def('putc', (vm, a) => { const c = a[0] & 255; writeFd(vm, fdOf(vm, num(a[1])), [c]); return c; });
  def('fputc', (vm, a) => { const c = a[0] & 255; writeFd(vm, fdOf(vm, num(a[1])), [c]); return c; });
  def('fputs', (vm, a) => { const s = cstrArg(vm, a[0]); writeFd(vm, fdOf(vm, num(a[1])), s); return 1; });
  def('fflush', (vm, a) => 0);
  def('setbuf', (vm, a) => 0);
  def('setvbuf', (vm, a) => 0);
  def('perror', (vm, a) => { const p = num(a[0]); const msg = p ? vm.readCStr(p) : []; const e = vm.symAddr && vm.symAddr.get('errno') ? vm.dv.getInt32(vm.symAddr.get('errno'), true) : 0; const out = (msg.length ? msg.concat(ASCII(': ')) : []).concat(ASCII(strerrorText(e))).concat([10]); vm.emit(2, out); });

  def('scanf', (vm, a) => {
    const fmt = cstrArg(vm, a[0]);
    const r = doScanf(vm, stdinSource(vm), fmt, a, 1);
    if (r === WAITR) return WAIT;
    return r.n;
  });
  def('fscanf', (vm, a) => {
    const so = srcForFile(vm, num(a[0])); if (!so) return -1;
    const r = doScanf(vm, so.src, cstrArg(vm, a[1]), a, 2);
    if (r === WAITR) return WAIT;
    return r.n;
  });
  def('sscanf', (vm, a) => {
    const s = cstrArg(vm, a[0]); let pos = 0;
    const r = doScanf(vm, arraySource(s, () => pos, (p) => { pos = p; }), cstrArg(vm, a[1]), a, 2);
    return r.n;
  });
  def('getchar', (vm) => {
    const s = stdinSource(vm); const b = s.peek(0);
    if (b === -2) return WAIT;
    if (b === -1) { vm.stdinAtEof = true; return -1; }
    s.commit(1); return b;
  });
  const fgetcImpl = (vm, a) => {
    const so = srcForFile(vm, num(a[0])); if (!so) return -1;
    const b = so.src.peek(0);
    if (b === -2) return WAIT;
    if (b === -1) { if (so.f) so.f.eof = true; else vm.stdinAtEof = true; return -1; }
    so.src.commit(1); return b;
  };
  def('getc', fgetcImpl); def('fgetc', fgetcImpl);
  def('ungetc', (vm, a) => {
    const c = a[0]; if (c === -1) return -1;
    const fd = fdOf(vm, num(a[1]));
    if (fd === 0) { if (vm.inPos > 0) { vm.inPos--; vm.inBytes[vm.inPos] = c & 255; } else vm.inBytes.unshift(c & 255); return c & 255; }
    const f = vm.files.get(fd); if (!f) return -1;
    if (f.pos > 0) f.pos--; return c & 255;
  });
  def('fgets', (vm, a) => {
    const p = num(a[0]), n = a[1], fp = num(a[2]);
    if (n <= 0) return 0;
    const so = srcForFile(vm, fp); if (!so) return 0;
    const bytes = []; let k = 0;
    while (bytes.length < n - 1) {
      const b = so.src.peek(k);
      if (b === -2) return WAIT;
      if (b === -1) break;
      bytes.push(b); k++;
      if (b === 10) break;
    }
    if (bytes.length === 0) { if (so.f) so.f.eof = true; else vm.stdinAtEof = true; return 0; }
    vm.chkRange(p, bytes.length + 1, true); vm.u8.set(bytes, p); vm.u8[p + bytes.length] = 0;
    so.src.commit(k);
    return p;
  });
  def('feof', (vm, a) => {
    const fd = fdOf(vm, num(a[0]));
    if (fd === 0) return vm.stdinAtEof ? 1 : 0;
    const f = vm.files.get(fd); return f && f.eof ? 1 : 0;
  });
  def('ferror', () => 0);
  def('clearerr', (vm, a) => { const f = vm.files.get(fdOf(vm, num(a[0]))); if (f) f.eof = false; });
  def('fopen', (vm, a) => {
    const name = vm.decodeBytes(cstrArg(vm, a[0])); const mode = vm.decodeBytes(cstrArg(vm, a[1]));
    if (!name) { setErrno(vm, ENOENT); return 0; }
    const m = mode.replace('b', '');
    let entry = vm.vfs.get(name);
    const f = { name, pos: 0, read: false, write: false, append: false, eof: false };
    if (m[0] === 'r') { if (!entry) { setErrno(vm, ENOENT); return 0; } f.read = true; f.write = m.includes('+'); }
    else if (m[0] === 'w') { entry = { data: [] }; vm.vfs.set(name, entry); f.write = true; f.read = m.includes('+'); }
    else if (m[0] === 'a') { if (!entry) { entry = { data: [] }; vm.vfs.set(name, entry); } f.write = true; f.append = true; f.read = m.includes('+'); }
    else { setErrno(vm, EINVAL); return 0; }
    f.entry = entry;
    const fp = vm.malloc(16, curLine(vm));
    if (!fp) return 0;
    const b = vm.blocks.get(fp); if (b) b.isFile = true;
    const fd = vm.nextFd++;
    vm.dv.setInt32(fp, fd, true); vm.dv.setInt32(fp + 4, 0, true);
    vm.files.set(fd, f);
    return fp;
  });
  def('fclose', (vm, a) => {
    const fp = num(a[0]); const fd = fdOf(vm, fp);
    if (fd < 3) return -1;
    if (!vm.files.has(fd)) { vm.fail('invalid-free', 'fclose() on a file that is already closed'); }
    vm.files.delete(fd);
    vm.free(fp, curLine(vm));
    return 0;
  });
  def('fread', (vm, a) => {
    const p = num(a[0]), size = num(a[1]), n = num(a[2]);
    const so = srcForFile(vm, num(a[3])); if (!so || size === 0 || n === 0) return 0n;
    const want = size * n; const bytes = [];
    for (let k = 0; k < want; k++) { const b = so.src.peek(k); if (b === -2) return WAIT; if (b === -1) break; bytes.push(b); }
    const items = Math.floor(bytes.length / size);
    if (items < n && so.f) so.f.eof = true;
    const used = items * size;
    vm.chkRange(p, used, true); vm.u8.set(bytes.slice(0, used), p);
    so.src.commit(used);
    return BigInt(items);
  });
  def('fwrite', (vm, a) => {
    const p = num(a[0]), size = num(a[1]), n = num(a[2]);
    const fd = fdOf(vm, num(a[3]));
    const total = size * n; if (total === 0) return 0n;
    const bytes = Array.from(vm.readBytes(p, total));
    const r = writeFd(vm, fd, bytes);
    return r < 0 ? 0n : BigInt(n);
  });
  def('fseek', (vm, a) => {
    const f = vm.files.get(fdOf(vm, num(a[0]))); if (!f) return -1;
    const off = Number(a[1]), wh = a[2];
    const len = f.entry.data.length;
    const np = wh === 0 ? off : wh === 1 ? f.pos + off : len + off;
    if (np < 0) { setErrno(vm, EINVAL); return -1; }
    f.pos = np; f.eof = false; return 0;
  });
  def('ftell', (vm, a) => { const f = vm.files.get(fdOf(vm, num(a[0]))); return f ? BigInt(f.pos) : -1n; });
  def('rewind', (vm, a) => { const f = vm.files.get(fdOf(vm, num(a[0]))); if (f) { f.pos = 0; f.eof = false; } });
  def('remove', (vm, a) => { const n = vm.decodeBytes(cstrArg(vm, a[0])); if (vm.vfs.delete(n)) return 0; setErrno(vm, ENOENT); return -1; });
  def('rename', (vm, a) => { const o = vm.decodeBytes(cstrArg(vm, a[0])), n = vm.decodeBytes(cstrArg(vm, a[1])); const e = vm.vfs.get(o); if (!e) { setErrno(vm, ENOENT); return -1; } vm.vfs.delete(o); vm.vfs.set(n, e); return 0; });

  // ---------------------------------------------------------------- stdlib
  def('malloc', (vm, a) => vm.malloc(num(a[0]), curLine(vm)));
  def('calloc', (vm, a) => {
    const n = num(a[0]) * num(a[1]);
    const p = vm.malloc(n, curLine(vm)); if (p) vm.u8.fill(0, p, p + n); return p;
  });
  def('realloc', (vm, a) => vm.realloc(num(a[0]), num(a[1]), curLine(vm)));
  def('free', (vm, a) => { vm.free(num(a[0]), curLine(vm)); });
  def('exit', (vm, a) => { throw new CC.ExitSignal(a[0] | 0); });
  def('_Exit', (vm, a) => { throw new CC.ExitSignal(a[0] | 0); });
  def('abort', (vm) => { vm.emit(2, ASCII('Aborted\n')); vm.fail('abort', 'The program called abort()'); });
  def('atexit', (vm, a) => {
    const f = num(a[0]); if (f < CC.MEM.FUNC_BASE || (f - CC.MEM.FUNC_BASE) % CC.MEM.FUNC_STRIDE !== 0 || !vm.funcs[(f - CC.MEM.FUNC_BASE) / CC.MEM.FUNC_STRIDE]) return 1;
    if (vm.atexitQ.length >= 32) return 1; vm.atexitQ.push(f); return 0;
  });
  def('__assert_fail', (vm, a) => {
    const expr = vm.decodeBytes(cstrArg(vm, a[0])), file = vm.decodeBytes(cstrArg(vm, a[1])), func = vm.decodeBytes(cstrArg(vm, a[3]));
    vm.emit(2, ASCII('a.out: ' + file + ':' + a[2] + ': ' + (func ? func + ': ' : '') + "Assertion `" + expr + "' failed.\n"));
    vm.fail('assert', "Assertion failed: " + expr + ' (line ' + a[2] + ')');
  });
  function parseIntStr(vm, ptr, endp, base, bits, unsigned) {
    const s = vm.readCStr(ptr);
    let i = 0; while (i < s.length && isSpace(s[i])) i++;
    let neg = false;
    if (s[i] === 43 || s[i] === 45) { neg = s[i] === 45; i++; }
    if ((base === 0 || base === 16) && s[i] === 48 && (s[i + 1] === 120 || s[i + 1] === 88)) { base = 16; i += 2; }
    else if (base === 0 && s[i] === 48) base = 8;
    else if (base === 0) base = 10;
    let v = 0n, any = false; const B = BigInt(base);
    for (; i < s.length; i++) {
      const ch = String.fromCharCode(s[i]); const d = parseInt(ch, 36);
      if (isNaN(d) || d >= base || !/[0-9a-zA-Z]/.test(ch)) break;
      v = v * B + BigInt(d); any = true;
      if (v > (1n << 70n)) v = 1n << 70n;
    }
    if (!any) i = 0;
    if (endp) vm.dv.setUint32(endp, ptr + i, true), vm.dv.setUint32(endp + 4, 0, true);
    if (neg) v = -v;
    const lo = unsigned ? 0n : -(1n << BigInt(bits - 1)), hi = unsigned ? (1n << BigInt(bits)) - 1n : (1n << BigInt(bits - 1)) - 1n;
    if (unsigned && neg) return BigInt.asUintN(bits, v);
    if (v > hi) { setErrno(vm, ERANGE); return hi; }
    if (v < lo) { setErrno(vm, ERANGE); return lo; }
    return v;
  }
  def('atoi', (vm, a) => Number(BigInt.asIntN(32, parseIntStr(vm, num(a[0]), 0, 10, 32, false))));
  def('atol', (vm, a) => parseIntStr(vm, num(a[0]), 0, 10, 64, false));
  def('atoll', (vm, a) => parseIntStr(vm, num(a[0]), 0, 10, 64, false));
  def('strtol', (vm, a) => parseIntStr(vm, num(a[0]), num(a[1]), a[2], 64, false));
  def('strtoll', (vm, a) => parseIntStr(vm, num(a[0]), num(a[1]), a[2], 64, false));
  def('strtoul', (vm, a) => parseIntStr(vm, num(a[0]), num(a[1]), a[2], 64, true));
  def('strtoull', (vm, a) => parseIntStr(vm, num(a[0]), num(a[1]), a[2], 64, true));
  function parseDbl(vm, ptr, endp) {
    const s = vm.readCStr(ptr); const str = String.fromCharCode.apply(null, s.slice(0, 400));
    const m = /^\s*([+-]?(?:inf(?:inity)?|nan|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?))/i.exec(str);
    let v = 0, used = 0;
    const hx = /^\s*([+-]?)0[xX]([0-9a-fA-F]+)(?:\.([0-9a-fA-F]*))?(?:[pP]([+-]?\d+))?/.exec(str);
    if (hx) {
      let mant = parseInt(hx[2], 16); const fr = hx[3] || '';
      for (let i = 0; i < fr.length; i++) mant += parseInt(fr[i], 16) / Math.pow(16, i + 1);
      v = mant * Math.pow(2, hx[4] ? +hx[4] : 0); if (hx[1] === '-') v = -v; used = hx[0].length;
    } else if (m) { const t = m[1].toLowerCase(); used = m[0].length; v = /inf/.test(t) ? (t[0] === '-' ? -Infinity : Infinity) : /nan/.test(t) ? NaN : parseFloat(t); }
    if (endp) { vm.chk(endp, 8, true); vm.dv.setUint32(endp, ptr + used, true); vm.dv.setUint32(endp + 4, 0, true); }
    return v;
  }
  def('atof', (vm, a) => parseDbl(vm, num(a[0]), 0));
  def('strtod', (vm, a) => parseDbl(vm, num(a[0]), num(a[1])));
  def('strtof', (vm, a) => Math.fround(parseDbl(vm, num(a[0]), num(a[1]))));
  def('abs', (vm, a) => { const x = a[0]; return x === -2147483648 ? x : Math.abs(x); });
  def('labs', (vm, a) => { const x = big(a[0]); return x < 0n ? BigInt.asIntN(64, -x) : x; });
  def('llabs', (vm, a) => { const x = big(a[0]); return x < 0n ? BigInt.asIntN(64, -x) : x; });
  // glibc-compatible rand() (TYPE_3 additive feedback generator)
  function seedRand(vm, seed) {
    seed = seed >>> 0; if (seed === 0) seed = 1;
    const r = new Array(34); r[0] = seed | 0;
    for (let i = 1; i < 31; i++) {
      const prev = r[i - 1]; const hi = (prev / 127773) | 0, lo = prev % 127773;
      let word = 16807 * lo - 2836 * hi; if (word < 0) word += 2147483647; r[i] = word | 0;
    }
    for (let i = 31; i < 34; i++) r[i] = r[i - 31];
    vm.rng = r;
    for (let i = 34; i < 344; i++) nextRand(vm);
  }
  function nextRand(vm) {
    const r = vm.rng; const v = (r[3] + r[31]) | 0;
    r.shift(); r.push(v);
    return v >>> 1;
  }
  def('srand', (vm, a) => { seedRand(vm, a[0]); });
  def('rand', (vm) => { if (!vm.rng) seedRand(vm, 1); return nextRand(vm); });
  def('getenv', () => 0);
  def('system', () => -1);

  // ---------------------------------------------------------------- string.h / memory
  def('strlen', (vm, a) => BigInt(vm.cstrLen(num(a[0]))));
  def('strcpy', (vm, a) => { const d = num(a[0]), s = vm.readCStr(num(a[1])); vm.chkRange(d, s.length + 1, true); vm.u8.set(s, d); vm.u8[d + s.length] = 0; return d; });
  def('strncpy', (vm, a) => {
    const d = num(a[0]), n = num(a[2]); if (n === 0) return d;
    const s = vm.readCStr(num(a[1]), n);
    vm.chkRange(d, n, true);
    for (let i = 0; i < n; i++) vm.u8[d + i] = i < s.length ? s[i] : 0;
    return d;
  });
  def('strcat', (vm, a) => {
    const d = num(a[0]); const dl = vm.cstrLen(d); const s = vm.readCStr(num(a[1]));
    vm.chkRange(d + dl, s.length + 1, true); vm.u8.set(s, d + dl); vm.u8[d + dl + s.length] = 0; return d;
  });
  def('strncat', (vm, a) => {
    const d = num(a[0]); const dl = vm.cstrLen(d); const s = vm.readCStr(num(a[1]), num(a[2]));
    vm.chkRange(d + dl, s.length + 1, true); vm.u8.set(s, d + dl); vm.u8[d + dl + s.length] = 0; return d;
  });
  const cmpBytes = (x, y, n, ci) => {
    for (let i = 0; i < n; i++) {
      let p = i < x.length ? x[i] : 0, q = i < y.length ? y[i] : 0;
      if (ci) { if (p >= 65 && p <= 90) p += 32; if (q >= 65 && q <= 90) q += 32; }
      if (p !== q) return p < q ? -1 : 1;
      if (p === 0) return 0;
    }
    return 0;
  };
  def('strcmp', (vm, a) => cmpBytes(vm.readCStr(num(a[0])), vm.readCStr(num(a[1])), 1 << 30, false));
  def('strcoll', (vm, a) => cmpBytes(vm.readCStr(num(a[0])), vm.readCStr(num(a[1])), 1 << 30, false));
  def('strncmp', (vm, a) => { const n = num(a[2]); return cmpBytes(vm.readCStr(num(a[0]), n), vm.readCStr(num(a[1]), n), n, false); });
  def('strcasecmp', (vm, a) => cmpBytes(vm.readCStr(num(a[0])), vm.readCStr(num(a[1])), 1 << 30, true));
  def('strncasecmp', (vm, a) => { const n = num(a[2]); return cmpBytes(vm.readCStr(num(a[0]), n), vm.readCStr(num(a[1]), n), n, true); });
  def('strchr', (vm, a) => { const p = num(a[0]), c = a[1] & 255; const s = vm.readCStr(p); if (c === 0) return p + s.length; const i = s.indexOf(c); return i < 0 ? 0 : p + i; });
  def('strrchr', (vm, a) => { const p = num(a[0]), c = a[1] & 255; const s = vm.readCStr(p); if (c === 0) return p + s.length; const i = s.lastIndexOf(c); return i < 0 ? 0 : p + i; });
  def('strstr', (vm, a) => {
    const p = num(a[0]); const s = vm.readCStr(p), n = vm.readCStr(num(a[1]));
    if (n.length === 0) return p;
    outer: for (let i = 0; i + n.length <= s.length; i++) { for (let j = 0; j < n.length; j++) if (s[i + j] !== n[j]) continue outer; return p + i; }
    return 0;
  });
  def('strdup', (vm, a) => { const s = vm.readCStr(num(a[0])); const p = vm.malloc(s.length + 1, curLine(vm)); if (!p) return 0; vm.u8.set(s, p); vm.u8[p + s.length] = 0; return p; });
  def('strndup', (vm, a) => { const s = vm.readCStr(num(a[0]), num(a[1])); const p = vm.malloc(s.length + 1, curLine(vm)); if (!p) return 0; vm.u8.set(s, p); vm.u8[p + s.length] = 0; return p; });
  def('strspn', (vm, a) => { const s = vm.readCStr(num(a[0])), set = new Set(vm.readCStr(num(a[1]))); let i = 0; while (i < s.length && set.has(s[i])) i++; return BigInt(i); });
  def('strcspn', (vm, a) => { const s = vm.readCStr(num(a[0])), set = new Set(vm.readCStr(num(a[1]))); let i = 0; while (i < s.length && !set.has(s[i])) i++; return BigInt(i); });
  def('strpbrk', (vm, a) => { const p = num(a[0]); const s = vm.readCStr(p), set = new Set(vm.readCStr(num(a[1]))); for (let i = 0; i < s.length; i++) if (set.has(s[i])) return p + i; return 0; });
  def('strtok', (vm, a) => {
    let p = num(a[0]); if (p === 0) p = vm.strtokPtr; if (p === 0) return 0;
    const delim = new Set(vm.readCStr(num(a[1])));
    let s = vm.readCStr(p); let i = 0;
    while (i < s.length && delim.has(s[i])) i++;
    if (i === s.length) { vm.strtokPtr = 0; return 0; }
    let j = i; while (j < s.length && !delim.has(s[j])) j++;
    const start = p + i;
    if (j < s.length) { vm.chk(p + j, 1, true); vm.u8[p + j] = 0; vm.strtokPtr = p + j + 1; } else vm.strtokPtr = 0;
    return start;
  });
  function strerrorText(e) { return { 0: 'Success', 1: 'Operation not permitted', 2: 'No such file or directory', 5: 'Input/output error', 9: 'Bad file descriptor', 12: 'Cannot allocate memory', 13: 'Permission denied', 17: 'File exists', 22: 'Invalid argument', 33: 'Numerical argument out of domain', 34: 'Numerical result out of range' }[e] || ('Unknown error ' + e); }
  def('strerror', (vm, a) => {
    const text = strerrorText(a[0]);
    if (!vm.errStrs) vm.errStrs = new Map();
    let p = vm.errStrs.get(text);
    if (!p) { const b = vm.strBytes(text); p = vm.malloc(b.length + 1, 0); vm.u8.set(b, p); vm.u8[p + b.length] = 0; vm.blocks.get(p).state = 3; vm.errStrs.set(text, p); }
    return p;
  });
  def('memcpy', (vm, a) => { const d = num(a[0]), s = num(a[1]), n = num(a[2]); if (n) { vm.chkRange(s, n, false); vm.chkRange(d, n, true); vm.u8.copyWithin(d, s, s + n); } return d; });
  def('memmove', (vm, a) => { const d = num(a[0]), s = num(a[1]), n = num(a[2]); if (n) { vm.chkRange(s, n, false); vm.chkRange(d, n, true); vm.u8.copyWithin(d, s, s + n); } return d; });
  def('memset', (vm, a) => { const d = num(a[0]), n = num(a[2]); if (n) { vm.chkRange(d, n, true); vm.u8.fill(a[1] & 255, d, d + n); } return d; });
  def('memcmp', (vm, a) => { const n = num(a[2]); if (!n) return 0; const x = vm.readBytes(num(a[0]), n), y = vm.readBytes(num(a[1]), n); for (let i = 0; i < n; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1; return 0; });
  def('memchr', (vm, a) => { const p = num(a[0]), n = num(a[2]); if (!n) return 0; const x = vm.readBytes(p, n); const i = x.indexOf(a[1] & 255); return i < 0 ? 0 : p + i; });

  // ---------------------------------------------------------------- ctype
  const ct = (name, f) => def(name, (vm, a) => (f(a[0]) ? 1 : 0));
  ct('isalpha', (c) => isAlpha(c)); ct('isdigit', (c) => isDigit(c)); ct('isalnum', (c) => isAlpha(c) || isDigit(c));
  ct('isspace', (c) => isSpace(c)); ct('isupper', (c) => c >= 65 && c <= 90); ct('islower', (c) => c >= 97 && c <= 122);
  ct('ispunct', (c) => c > 32 && c < 127 && !isAlpha(c) && !isDigit(c)); ct('isprint', (c) => c >= 32 && c < 127);
  ct('isgraph', (c) => c > 32 && c < 127); ct('iscntrl', (c) => (c >= 0 && c < 32) || c === 127);
  ct('isxdigit', (c) => isDigit(c) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102)); ct('isblank', (c) => c === 32 || c === 9);
  def('toupper', (vm, a) => (a[0] >= 97 && a[0] <= 122 ? a[0] - 32 : a[0]));
  def('tolower', (vm, a) => (a[0] >= 65 && a[0] <= 90 ? a[0] + 32 : a[0]));

  // ---------------------------------------------------------------- time / unistd
  def('time', (vm, a) => { const t = BigInt(Math.floor((vm.startMs + (Date.now() - vm.clockStart)) / 1000)); const p = num(a[0]); if (p) { vm.chk(p, 8, true); vm.dv.setBigInt64(p, t, true); } return t; });
  def('clock', (vm) => BigInt(Math.round((Date.now() - vm.clockStart) * 1000)));
  def('difftime', (vm, a) => Number(big(a[0]) - big(a[1])));

  // ---- getline / strtok_r / strnlen / aligned_alloc ----
  def('getline', (vm, a) => {
    const lp = num(a[0]), np = num(a[1]), fp = num(a[2]);
    if (!lp || !np) return -1;
    const so = srcForFile(vm, fp); if (!so) return -1;
    const bytes = []; let k = 0;
    for (;;) { const b = so.src.peek(k); if (b === -2) return WAIT; if (b === -1) break; bytes.push(b); k++; if (b === 10) break; }
    if (!bytes.length) { if (so.f) so.f.eof = true; else vm.stdinAtEof = true; return -1; }
    vm.chk(lp, 4, false); vm.chk(np, 8, true);
    let ptr = vm.dv.getUint32(lp, true); const cap = Number(vm.dv.getBigUint64(np, true));
    if (!ptr || cap < bytes.length + 1) {
      const nc = Math.max(bytes.length + 1, 120);
      ptr = ptr ? vm.realloc(ptr, nc, curLine(vm)) : vm.malloc(nc, curLine(vm));
      if (!ptr) return -1;
      vm.dv.setUint32(lp, ptr, true); vm.dv.setUint32(lp + 4, 0, true); vm.dv.setBigUint64(np, BigInt(nc), true);
    }
    vm.chkRange(ptr, bytes.length + 1, true); vm.u8.set(bytes, ptr); vm.u8[ptr + bytes.length] = 0;
    so.src.commit(k);
    return bytes.length;
  });
  def('strtok_r', (vm, a) => {
    const sv = num(a[2]); vm.chk(sv, 8, true);
    let p = num(a[0]); if (p === 0) p = vm.dv.getUint32(sv, true); if (p === 0) return 0;
    const delim = new Set(vm.readCStr(num(a[1])));
    const s = vm.readCStr(p); let i = 0;
    while (i < s.length && delim.has(s[i])) i++;
    if (i === s.length) { vm.dv.setUint32(sv, 0, true); return 0; }
    let j = i; while (j < s.length && !delim.has(s[j])) j++;
    if (j < s.length) { vm.chk(p + j, 1, true); vm.u8[p + j] = 0; vm.dv.setUint32(sv, p + j + 1, true); } else vm.dv.setUint32(sv, 0, true);
    vm.dv.setUint32(sv + 4, 0, true);
    return p + i;
  });
  def('strnlen', (vm, a) => { const p = num(a[0]), m = num(a[1]); let n = 0; while (n < m) { vm.chk(p + n, 1, false); if (vm.u8[p + n] === 0) break; n++; } return n; });
  def('aligned_alloc', (vm, a) => vm.malloc(num(a[1]), curLine(vm)));

  // ---- time: broken-down time. The local time zone is UTC (like most online judges). ----
  const TM_SIZE = 56;
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function tmBuf(vm) { return vm.prog.libcBuf; }
  function writeTm(vm, p, d) {
    const f = [d.getUTCSeconds(), d.getUTCMinutes(), d.getUTCHours(), d.getUTCDate(), d.getUTCMonth(), d.getUTCFullYear() - 1900, d.getUTCDay(), Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000), 0];
    f.forEach((v, i) => vm.dv.setInt32(p + 4 * i, v, true));
    vm.dv.setInt32(p + 36, 0, true); vm.dv.setBigInt64(p + 40, 0n, true); vm.dv.setUint32(p + 48, 0, true); vm.dv.setUint32(p + 52, 0, true);
  }
  function readTm(vm, p) { vm.chk(p, 36, false); const g = (i) => vm.dv.getInt32(p + 4 * i, true); return { sec: g(0), min: g(1), hour: g(2), mday: g(3), mon: g(4), year: g(5), wday: g(6), yday: g(7) }; }
  const tmFromTime = (vm, a) => { const p = num(a[0]); vm.chk(p, 8, false); const t = Number(vm.dv.getBigInt64(p, true)); const d = new Date(t * 1000); if (isNaN(d.getTime())) return 0; const b = tmBuf(vm); writeTm(vm, b, d); return b; };
  def('gmtime', tmFromTime); def('localtime', tmFromTime);
  def('mktime', (vm, a) => {
    const p = num(a[0]); const t = readTm(vm, p);
    const ms = Date.UTC(t.year + 1900, t.mon, t.mday, t.hour, t.min, t.sec);
    if (isNaN(ms)) return -1;
    writeTm(vm, p, new Date(ms)); return Math.floor(ms / 1000);
  });
  const two = (n) => String(n).padStart(2, '0');
  function strf(vm, fmt, t) {
    const d = new Date(Date.UTC(t.year + 1900, t.mon, t.mday, t.hour, t.min, t.sec));
    let o = '';
    for (let i = 0; i < fmt.length; i++) {
      if (fmt[i] !== '%') { o += fmt[i]; continue; }
      const c = fmt[++i];
      switch (c) {
        case 'Y': o += (t.year + 1900); break; case 'y': o += two((t.year + 1900) % 100); break; case 'C': o += two(Math.floor((t.year + 1900) / 100)); break;
        case 'm': o += two(t.mon + 1); break; case 'd': o += two(t.mday); break; case 'e': o += String(t.mday).padStart(2, ' '); break;
        case 'H': o += two(t.hour); break; case 'I': o += two(t.hour % 12 || 12); break; case 'M': o += two(t.min); break; case 'S': o += two(t.sec); break;
        case 'p': o += t.hour < 12 ? 'AM' : 'PM'; break; case 'P': o += t.hour < 12 ? 'am' : 'pm'; break;
        case 'a': o += DAYS[t.wday].slice(0, 3); break; case 'A': o += DAYS[t.wday]; break;
        case 'b': case 'h': o += MONTHS[t.mon].slice(0, 3); break; case 'B': o += MONTHS[t.mon]; break;
        case 'j': o += String(t.yday + 1).padStart(3, '0'); break; case 'u': o += (t.wday || 7); break; case 'w': o += t.wday; break;
        case 'Z': o += 'UTC'; break; case 'z': o += '+0000'; break; case 'n': o += '\n'; break; case 't': o += '\t'; break; case '%': o += '%'; break;
        case 'F': o += (t.year + 1900) + '-' + two(t.mon + 1) + '-' + two(t.mday); break;
        case 'T': o += two(t.hour) + ':' + two(t.min) + ':' + two(t.sec); break; case 'R': o += two(t.hour) + ':' + two(t.min); break;
        case 'D': o += two(t.mon + 1) + '/' + two(t.mday) + '/' + two((t.year + 1900) % 100); break;
        case 'c': o += DAYS[t.wday].slice(0, 3) + ' ' + MONTHS[t.mon].slice(0, 3) + ' ' + String(t.mday).padStart(2, ' ') + ' ' + two(t.hour) + ':' + two(t.min) + ':' + two(t.sec) + ' ' + (t.year + 1900); break;
        case 'x': o += two(t.mon + 1) + '/' + two(t.mday) + '/' + two((t.year + 1900) % 100); break;
        case 'X': o += two(t.hour) + ':' + two(t.min) + ':' + two(t.sec); break;
        case 's': o += Math.floor(d.getTime() / 1000); break;
        default: o += '%' + (c === undefined ? '' : c);
      }
    }
    return o;
  }
  def('strftime', (vm, a) => {
    const p = num(a[0]), max = num(a[1]); const out = ASCII(strf(vm, vm.readCStr(num(a[2])).map(c => String.fromCharCode(c)).join(''), readTm(vm, num(a[3]))));
    if (out.length + 1 > max) return 0;
    vm.chkRange(p, out.length + 1, true); vm.u8.set(out, p); vm.u8[p + out.length] = 0; return out.length;
  });
  const asc = (vm, t) => { const b = tmBuf(vm) + 64; const s = ASCII(strf(vm, '%a %b %e %T %Y\n', t).replace(/^(\w+ \w+) (\s?\d)/, (m, x, y) => x + ' ' + y)); vm.u8.set(s, b); vm.u8[b + s.length] = 0; return b; };
  def('asctime', (vm, a) => asc(vm, readTm(vm, num(a[0]))));
  def('ctime', (vm, a) => { const p = num(a[0]); vm.chk(p, 8, false); const d = new Date(Number(vm.dv.getBigInt64(p, true)) * 1000); const b = tmBuf(vm); writeTm(vm, b, d); return asc(vm, readTm(vm, b)); });
  def('sleep', () => 0); def('usleep', () => 0);

  // ---------------------------------------------------------------- math
  const rnd = (x) => (x < 0 ? -Math.round(-x) : Math.round(x));
  const U1 = { sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, asinh: Math.asinh, acosh: Math.acosh, atanh: Math.atanh, exp: Math.exp, expm1: Math.expm1, log: Math.log, log10: Math.log10, log2: Math.log2, log1p: Math.log1p, ceil: Math.ceil, floor: Math.floor, fabs: Math.abs, round: rnd, trunc: Math.trunc, cbrt: Math.cbrt, exp2: (x) => Math.pow(2, x), rint: (x) => { const r = Math.round(x); return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r; }, nearbyint: (x) => { const r = Math.round(x); return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r; } };
  const cpow = (x, y) => { if (x === 1) return 1; if (y === 0) return 1; if (x === -1 && (y === Infinity || y === -Infinity)) return 1; return Math.pow(x, y); };
  const B2 = { pow: cpow, atan2: Math.atan2, fmod: (x, y) => x % y, hypot: Math.hypot, fmax: (x, y) => (x !== x ? y : y !== y ? x : Math.max(x, y)), fmin: (x, y) => (x !== x ? y : y !== y ? x : Math.min(x, y)), copysign: (x, y) => { const s = (y < 0 || Object.is(y, -0)) ? -1 : 1; return s * Math.abs(x); }, fdim: (x, y) => (x > y ? x - y : 0), remainder: (x, y) => x - y * Math.round(x / y) };
  const mathDecl = ['#ifndef _MATH_H', '#define _MATH_H',
    '#define M_PI 3.14159265358979323846', '#define M_E 2.7182818284590452354', '#define M_SQRT2 1.41421356237309504880', '#define M_LN2 0.69314718055994530942', '#define M_LN10 2.30258509299404568402', '#define M_PI_2 1.57079632679489661923', '#define M_PI_4 0.78539816339744830962',
    '#define HUGE_VAL (1.0/0.0)', '#define INFINITY (1.0f/0.0f)', '#define NAN (0.0f/0.0f)', '#define FP_NAN 0', '#define FP_INFINITE 1'];
  for (const [n, f] of Object.entries(U1)) {
    def(n, (vm, a) => f(a[0])); def(n + 'f', (vm, a) => Math.fround(f(a[0])));
    mathDecl.push('double ' + n + '(double x);', 'float ' + n + 'f(float x);'); headerOwner.set(n, 'math.h'); headerOwner.set(n + 'f', 'math.h');
  }
  for (const [n, f] of Object.entries(B2)) {
    def(n, (vm, a) => f(a[0], a[1])); def(n + 'f', (vm, a) => Math.fround(f(a[0], a[1])));
    mathDecl.push('double ' + n + '(double x, double y);', 'float ' + n + 'f(float x, float y);'); headerOwner.set(n, 'math.h'); headerOwner.set(n + 'f', 'math.h');
  }
  def('ldexp', (vm, a) => a[0] * Math.pow(2, a[1])); mathDecl.push('double ldexp(double x, int e);');
  def('frexp', (vm, a) => {
    const x = a[0], p = num(a[1]); vm.chk(p, 4, true);
    if (x === 0 || !isFinite(x)) { vm.dv.setInt32(p, 0, true); return x; }
    let e = Math.max(-1023, Math.floor(Math.log2(Math.abs(x))) + 1); let m = x * Math.pow(2, -e);
    while (Math.abs(m) < 0.5) { m *= 2; e--; } while (Math.abs(m) >= 1) { m /= 2; e++; }
    vm.dv.setInt32(p, e, true); return m;
  }); mathDecl.push('double frexp(double x, int *e);');
  def('modf', (vm, a) => { const x = a[0], p = num(a[1]); vm.chk(p, 8, true); const i = Math.trunc(x); vm.dv.setFloat64(p, i, true); return isFinite(x) ? x - i : 0; }); mathDecl.push('double modf(double x, double *ip);');
  def('isnan', (vm, a) => (a[0] !== a[0] ? 1 : 0)); def('isinf', (vm, a) => (a[0] === Infinity || a[0] === -Infinity ? 1 : 0)); def('isfinite', (vm, a) => (isFinite(a[0]) ? 1 : 0)); def('signbit', (vm, a) => (a[0] < 0 || Object.is(a[0], -0) ? 1 : 0));
  mathDecl.push('int isnan(double x);', 'int isinf(double x);', 'int isfinite(double x);', 'int signbit(double x);');
  def('lround', (vm, a) => BigInt(rnd(a[0]))); def('llround', (vm, a) => BigInt(rnd(a[0]))); mathDecl.push('long lround(double x);', 'long long llround(double x);');
  mathDecl.push('#endif');
  CC.headerTexts['math.h'] = mathDecl.join('\n');
  headerOwner.set('ldexp', 'math.h'); headerOwner.set('frexp', 'math.h'); headerOwner.set('modf', 'math.h'); headerOwner.set('isnan', 'math.h'); headerOwner.set('lround', 'math.h');

  // which header declares which function (for "did you forget #include" hints and automatic recovery)
  (function indexHeaders() {
    const re = /^[A-Za-z_][\w \*]*?[ \*](\w+)\s*\(/gm;
    for (const [h, text] of Object.entries(CC.headerTexts)) {
      let m; re.lastIndex = 0;
      while ((m = re.exec(text))) if (!headerOwner.has(m[1])) headerOwner.set(m[1], h);
    }
    for (const c of CC.preludeChunks) for (const n of c.names) { if (!headerOwner.has(n)) headerOwner.set(n, 'stdlib.h'); }
  })();

  CC.libc = {
    table: B,
    headers: CC.headerTexts,
    headerOf: (n) => headerOwner.get(n) || null,
    isBuiltin: (n) => B.has(n),
    WAITR
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
