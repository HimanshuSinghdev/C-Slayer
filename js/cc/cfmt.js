/* C-Slayer · compile-time checks of printf / scanf format strings (like gcc -Wformat). */
(function (g) {
  'use strict';
  const CC = g.CC = g.CC || {};
  const T = CC.T;

  const PRINTF = { printf: 0, fprintf: 1, sprintf: 1, snprintf: 2 };
  const SCANF = { scanf: 0, fscanf: 1, sscanf: 1 };

  function parseSpecs(bytes, isScan) {
    const specs = []; let i = 0;
    while (i < bytes.length) {
      if (bytes[i] !== 37) { i++; continue; }
      i++;
      if (bytes[i] === 37) { i++; continue; }
      let star = 0, suppress = false;
      if (isScan) { if (bytes[i] === 42) { suppress = true; i++; } }
      else { while ('-+ #0'.indexOf(String.fromCharCode(bytes[i])) >= 0 && i < bytes.length) i++; }
      if (bytes[i] === 42) { star++; i++; } else while (bytes[i] >= 48 && bytes[i] <= 57) i++;
      if (!isScan && bytes[i] === 46) { i++; if (bytes[i] === 42) { star++; i++; } else while (bytes[i] >= 48 && bytes[i] <= 57) i++; }
      let len = '';
      while ('hlLjzqt'.indexOf(String.fromCharCode(bytes[i])) >= 0 && i < bytes.length) { len += String.fromCharCode(bytes[i]); i++; }
      if (i >= bytes.length) { specs.push({ conv: '', len, bad: true }); break; }
      let conv = String.fromCharCode(bytes[i++]);
      if (conv === '[') { if (bytes[i] === 94) i++; if (bytes[i] === 93) i++; while (i < bytes.length && bytes[i] !== 93) i++; i++; }
      specs.push({ conv, len, star, suppress });
    }
    return specs;
  }

  CC.installFmt = function (C) {
    const typeStr = (t) => T.name(t);
    C.checkFormat = function (e, name, ftype, argTypes) {
      const isP = Object.prototype.hasOwnProperty.call(PRINTF, name), isS = Object.prototype.hasOwnProperty.call(SCANF, name);
      if (!isP && !isS) return;
      const fi = isP ? PRINTF[name] : SCANF[name];
      if (e.args.length <= fi) return;
      let fnode = C.stripParen(e.args[fi]);
      if (fnode.k !== 'Str') {
        if (isP && e.args.length === fi + 1 && !C.isNullConst(fnode)) C.warn(e.args[fi], 'format not a string literal and no format arguments [-Wformat-security]');
        return;
      }
      // adjacent string literals are already merged by the parser
      const specs = parseSpecs(fnode.bytes, isS);
      let ai = fi + 1;     // index into e.args / argTypes
      const argNo = (k) => k + 1;
      for (const sp of specs) {
        if (sp.bad) { C.warn(fnode, 'spurious trailing \'%\' in format [-Wformat=]'); break; }
        let needed = sp.star;
        while (needed-- > 0) { if (ai >= e.args.length) { C.warn(e, "format expects a matching 'int' argument for '*' [-Wformat=]"); return; } ai++; }
        const conv = sp.conv, len = sp.len;
        if (isS && sp.suppress) continue;
        if (!'diuoxXcspfeEgGaAn[%'.includes(conv) && !(isS && conv === 'i')) {
          C.warn(fnode, "unknown conversion type character '" + conv + "' in format [-Wformat=]"); continue;
        }
        if (ai >= e.args.length) {
          const want = expected(conv, len, isS);
          C.warn(fnode, "format '%" + len + conv + "' expects a matching '" + want + "' argument [-Wformat=]");
          ai++; continue;
        }
        const at = argTypes[ai];
        const node = e.args[ai];
        if (at) {
          const msg = isS ? checkScan(conv, len, at) : checkPrint(conv, len, at, node);
          if (msg) C.warn(node, "format '%" + len + conv + "' expects argument of type '" + msg + "', but argument " + argNo(ai) + " has type '" + typeStr(at) + "' [-Wformat=]");
        }
        ai++;
      }
      if (ai < e.args.length) C.warn(e.args[ai], 'too many arguments for format [-Wformat-extra-args]');
    };

    function expected(conv, len, isScan) {
      if (isScan) {
        if ('di'.includes(conv)) return (len === 'l' ? 'long int' : len === 'll' ? 'long long int' : len === 'h' ? 'short int' : len === 'hh' ? 'signed char' : 'int') + ' *';
        if ('uoxX'.includes(conv)) return (len === 'l' ? 'long unsigned int' : len === 'll' ? 'long long unsigned int' : len === 'h' ? 'short unsigned int' : len === 'hh' ? 'unsigned char' : 'unsigned int') + ' *';
        if ('feEgGa'.includes(conv)) return (len === 'l' || len === 'L' ? 'double' : 'float') + ' *';
        return 'char *';
      }
      if ('di'.includes(conv)) return len === 'l' ? 'long int' : len === 'll' ? 'long long int' : len === 'z' ? 'ssize_t' : 'int';
      if ('uoxX'.includes(conv)) return len === 'l' ? 'long unsigned int' : len === 'll' ? 'long long unsigned int' : len === 'z' ? 'size_t' : 'unsigned int';
      if ('feEgGaA'.includes(conv)) return len === 'L' ? 'long double' : 'double';
      if (conv === 'c') return 'int';
      if (conv === 's') return 'const char *';
      if (conv === 'p') return 'void *';
      return 'int';
    }
    /** returns the expected type string if `at` is wrong, else null */
    function checkPrint(conv, len, at, node) {
      const wide = len === 'l' || len === 'll' || len === 'z' || len === 'j' || len === 't' || len === 'q';
      if ('diuoxX'.includes(conv)) {
        if (at.k !== 'int') return expected(conv, len, false);
        const need = wide ? 8 : 4;
        const have = at.size < 4 ? 4 : at.size;
        if (have !== need) {
          // gcc is strict about int vs long; long long and long are both 8 bytes but distinct types
          return expected(conv, len, false);
        }
        if (wide && (len === 'l' && at.name && at.name.indexOf('long long') >= 0)) return expected(conv, len, false);
        if (wide && (len === 'll' && at.name && !(at.name.indexOf('long long') >= 0))) return expected(conv, len, false);
        return null;
      }
      if ('feEgGaA'.includes(conv)) return at.k === 'float' ? null : expected(conv, len, false);
      if (conv === 'c') return at.k === 'int' && at.size <= 4 ? null : expected(conv, len, false);
      if (conv === 's') {
        if (at.k === 'ptr' && at.to.k === 'int' && at.to.size === 1) return null;
        if (at.k === 'ptr' && at.to.k === 'void') return null;
        return 'char *';
      }
      if (conv === 'p') return at.k === 'ptr' ? null : 'void *';
      return null;
    }
    function checkScan(conv, len, at) {
      const want = expected(conv, len, true);
      if (at.k !== 'ptr') return want;
      const to = at.to;
      if ('di'.includes(conv) || 'uoxX'.includes(conv)) {
        const sz = len === 'hh' ? 1 : len === 'h' ? 2 : (len === 'l' || len === 'll' || len === 'z' || len === 'j' || len === 't') ? 8 : 4;
        return to.k === 'int' && to.size === sz ? null : want;
      }
      if ('feEgGa'.includes(conv)) {
        const sz = (len === 'l' || len === 'L') ? 8 : 4;
        return to.k === 'float' && (to.size === sz || (sz === 8 && to.size === 16)) ? null : want;
      }
      if (conv === 'c' || conv === 's' || conv === '[') return to.k === 'int' && to.size === 1 ? null : want;
      return null;
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
