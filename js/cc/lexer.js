/* C-Slayer · lexer
 * Source text -> tokens. Pure function, no I/O, no eval. Strings become byte arrays (UTF-8).
 * Token: { k:'id'|'num'|'str'|'chr'|'punc'|'eof', v, line, col, bol, sp, [bytes], [val], [file], [hide] }
 */
(function (g) {
  'use strict';
  const CC = g.CC = g.CC || {};

  const PUNCS3 = ['<<=', '>>=', '...'];
  const PUNCS2 = ['->', '++', '--', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '##'];
  const PUNCS1 = '{}[]()<>.,;:?+-*/%&|^~!=#';

  const isIdStart = c => (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 36;
  const isDigit = c => c >= 48 && c <= 57;
  const isIdChar = c => isIdStart(c) || isDigit(c);
  const isHex = c => isDigit(c) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102);

  function utf8Push(out, cp) {
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xC0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xE0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }

  /** lex(src, file) -> { tokens, comments, errors, lineCount } */
  function lex(src, file) {
    file = file || 'main.c';
    src = String(src).replace(/\r\n?/g, '\n');
    const n = src.length;
    const tokens = [], comments = [], errors = [];
    let i = 0, line = 1, lineStart = 0, bol = true, sp = false;
    const err = (msg, l, c) => errors.push({ line: l || line, col: c || (i - lineStart + 1), msg, sev: 'error' });

    while (i < n) {
      const c = src.charCodeAt(i);
      // whitespace / newline / line splice
      if (c === 10) { i++; line++; lineStart = i; bol = true; sp = true; continue; }
      if (c === 32 || c === 9 || c === 11 || c === 12) { i++; sp = true; continue; }
      if (c === 92 && src.charCodeAt(i + 1) === 10) { i += 2; line++; lineStart = i; sp = true; continue; }
      // comments
      if (c === 47) {
        const d = src.charCodeAt(i + 1);
        if (d === 47) {
          const s = i; i += 2;
          while (i < n && src.charCodeAt(i) !== 10) {
            if (src.charCodeAt(i) === 92 && src.charCodeAt(i + 1) === 10) { i += 2; line++; lineStart = i; continue; }
            i++;
          }
          comments.push({ line, text: src.slice(s, i), block: false });
          sp = true; continue;
        }
        if (d === 42) {
          const s = i, sl = line; i += 2;
          let closed = false;
          while (i < n) {
            const ch = src.charCodeAt(i);
            if (ch === 42 && src.charCodeAt(i + 1) === 47) { i += 2; closed = true; break; }
            if (ch === 10) { line++; lineStart = i + 1; }
            i++;
          }
          if (!closed) err('unterminated comment', sl, 1);
          comments.push({ line: sl, endLine: line, text: src.slice(s, i), block: true });
          sp = true; continue;
        }
      }
      const col = i - lineStart + 1;
      const tok = { k: 'punc', v: '', line, col, bol, sp, file };
      bol = false; sp = false;
      // identifier
      if (isIdStart(c)) {
        const s = i; i++;
        while (i < n && isIdChar(src.charCodeAt(i))) i++;
        tok.k = 'id'; tok.v = src.slice(s, i);
        tokens.push(tok); continue;
      }
      // number (pp-number)
      if (isDigit(c) || (c === 46 && isDigit(src.charCodeAt(i + 1)))) {
        const s = i; i++;
        while (i < n) {
          const ch = src.charCodeAt(i);
          if (isIdChar(ch) || ch === 46) { i++; continue; }
          if ((ch === 43 || ch === 45)) {
            const p = src.charCodeAt(i - 1);
            const isHexNum = /^0[xX]/.test(src.slice(s, s + 2));
            if ((!isHexNum && (p === 101 || p === 69)) || (isHexNum && (p === 112 || p === 80))) { i++; continue; }
          }
          break;
        }
        tok.k = 'num'; tok.v = src.slice(s, i);
        tokens.push(tok); continue;
      }
      // string literal
      if (c === 34) {
        const s = i; i++;
        const bytes = [];
        let closed = false;
        while (i < n) {
          const ch = src.charCodeAt(i);
          if (ch === 34) { i++; closed = true; break; }
          if (ch === 10) break;
          if (ch === 92) {
            const r = readEscape(src, i, err, line, lineStart);
            if (r.splice) { i = r.next; line++; lineStart = i; continue; }
            if (r.multi) { for (const x of r.multi) bytes.push(x); } else bytes.push(r.val & 255);
            i = r.next; continue;
          }
          const cp = src.codePointAt(i);
          utf8Push(bytes, cp);
          i += cp > 0xFFFF ? 2 : 1;
        }
        if (!closed) err('missing terminating " character', tok.line, col);
        tok.k = 'str'; tok.v = src.slice(s, i); tok.bytes = bytes;
        tokens.push(tok); continue;
      }
      // char literal
      if (c === 39) {
        const s = i; i++;
        const vals = [];
        let closed = false;
        while (i < n) {
          const ch = src.charCodeAt(i);
          if (ch === 39) { i++; closed = true; break; }
          if (ch === 10) break;
          if (ch === 92) { const r = readEscape(src, i, err, line, lineStart); vals.push(r.val); i = r.next; continue; }
          const cp = src.codePointAt(i);
          const b = []; utf8Push(b, cp);
          for (const x of b) vals.push(x);
          i += cp > 0xFFFF ? 2 : 1;
        }
        if (!closed) err("missing terminating ' character", tok.line, col);
        else if (vals.length === 0) err('empty character constant', tok.line, col);
        let val = 0;
        if (vals.length === 1) val = vals[0] > 127 ? vals[0] - 256 : vals[0];
        else for (const x of vals) val = ((val << 8) | (x & 255)) | 0;
        tok.k = 'chr'; tok.v = src.slice(s, i); tok.val = val;
        tokens.push(tok); continue;
      }
      // punctuators
      const s3 = src.substr(i, 3), s2 = src.substr(i, 2);
      if (PUNCS3.includes(s3)) { tok.v = s3; i += 3; tokens.push(tok); continue; }
      if (PUNCS2.includes(s2)) { tok.v = s2; i += 2; tokens.push(tok); continue; }
      if (PUNCS1.indexOf(src[i]) >= 0) { tok.v = src[i]; i++; tokens.push(tok); continue; }
      // stray character
      err("stray '" + src[i] + "' in program", line, col);
      i++;
    }
    tokens.push({ k: 'eof', v: '', line, col: i - lineStart + 1, bol: true, sp: true, file });
    return { tokens, comments, errors, lineCount: line };
  }

  function readEscape(src, i, err, line, lineStart) {
    // src[i] === '\\'
    const d = src[i + 1];
    const simple = { n: 10, t: 9, r: 13, a: 7, b: 8, f: 12, v: 11, e: 27, '\\': 92, "'": 39, '"': 34, '?': 63 };
    if (d === '\n') return { splice: true, next: i + 2 };
    if (d !== undefined && Object.prototype.hasOwnProperty.call(simple, d)) return { val: simple[d], next: i + 2 };
    if (d === 'x') {
      let j = i + 2, v = 0, cnt = 0;
      while (j < src.length && isHex(src.charCodeAt(j))) { v = (v * 16 + parseInt(src[j], 16)) & 0xFFFFFFFF; j++; cnt++; }
      if (!cnt) err('\\x used with no following hex digits', line, i - lineStart + 1);
      return { val: v & 255, next: j };
    }
    if (d >= '0' && d <= '7') {
      let j = i + 1, v = 0, cnt = 0;
      while (j < src.length && cnt < 3 && src[j] >= '0' && src[j] <= '7') { v = v * 8 + (src.charCodeAt(j) - 48); j++; cnt++; }
      return { val: v & 255, next: j };
    }
    if (d === 'u' || d === 'U') {
      const len = d === 'u' ? 4 : 8;
      const hex = src.substr(i + 2, len);
      if (hex.length === len && /^[0-9a-fA-F]+$/.test(hex)) {
        const out = []; utf8Push(out, parseInt(hex, 16));
        return { val: out[0], multi: out, next: i + 2 + len };
      }
    }
    err("unknown escape sequence: '\\" + (d || '') + "'", line, i - lineStart + 1);
    return { val: d ? d.charCodeAt(0) : 92, next: i + 2 };
  }

  /** parseNumber(text) -> {kind:'int', value:BigInt, base, u, l} | {kind:'float', value, f, l} | {error} */
  function parseNumber(text) {
    let m;
    if ((m = /^0[xX]([0-9a-fA-F]+)([uUlL]*)$/.exec(text))) return intResult(BigInt('0x' + m[1]), 16, m[2], text);
    if ((m = /^0[bB]([01]+)([uUlL]*)$/.exec(text))) return intResult(BigInt('0b' + m[1]), 2, m[2], text);
    if ((m = /^(0[0-7]*)([uUlL]*)$/.exec(text))) return intResult(m[1].length > 1 ? BigInt('0o' + m[1].slice(1)) : 0n, 8, m[2], text);
    if ((m = /^([1-9][0-9]*)([uUlL]*)$/.exec(text))) return intResult(BigInt(m[1]), 10, m[2], text);
    if ((m = /^0[0-7]*([89])[0-9]*[uUlL]*$/.exec(text))) return { error: "invalid digit '" + m[1] + "' in octal constant" };
    if ((m = /^((?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?)([fFlL]?)$/.exec(text))) {
      return { kind: 'float', value: parseFloat(m[1]), f: /f/i.test(m[2]), l: /l/i.test(m[2]) };
    }
    if (/^0[xX]/.test(text) && /[pP]/.test(text)) return { error: 'hexadecimal floating constants are not supported' };
    if ((m = /^[0-9]+([a-zA-Z_][a-zA-Z0-9_]*)$/.exec(text))) return { error: 'invalid suffix "' + m[1] + '" on integer constant' };
    return { error: "invalid number '" + text + "'" };
  }
  function intResult(value, base, suf, text) {
    const s = suf.toLowerCase();
    const u = s.indexOf('u') >= 0;
    const l = (s.match(/l/g) || []).length;
    if (!/^(u?l{0,2}|l{1,2}u)$/.test(s)) return { error: 'invalid suffix "' + suf + '" on integer constant' };
    return { kind: 'int', value, base, u, l };
  }

  CC.lex = lex;
  CC.parseNumber = parseNumber;
  CC.utf8Push = utf8Push;
})(typeof globalThis !== 'undefined' ? globalThis : self);
