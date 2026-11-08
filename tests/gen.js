// Random, UB-free C program generator (Csmith-style, much smaller). Every program prints a checksum of all its state, so
// any difference between gcc and C-Slayer shows up as different output. Signed overflow, division by zero, over-wide shifts,
// out-of-range indices and unspecified evaluation order are all avoided by construction (helpers, masks, calls only as statements).
'use strict';
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const TY = [
  { n: 'sc', c: 'signed char', bits: 8, s: true }, { n: 'uc', c: 'unsigned char', bits: 8, s: false },
  { n: 'ss', c: 'short', bits: 16, s: true }, { n: 'us', c: 'unsigned short', bits: 16, s: false },
  { n: 'i', c: 'int', bits: 32, s: true }, { n: 'u', c: 'unsigned', bits: 32, s: false },
  { n: 'll', c: 'long long', bits: 64, s: true }, { n: 'ull', c: 'unsigned long long', bits: 64, s: false }
];
module.exports = function gen(seed) {
  const R = rng(seed), ri = (n) => Math.floor(R() * n), pick = (a) => a[ri(a.length)], chance = (p) => R() < p;
  const out = [];
  const P = (s) => out.push(s);
  P('#include <stdio.h>\n#include <string.h>\n');
  P('static unsigned long long fuel = 400000ULL;');
  for (const t of TY) {
    const T = t.c, N = t.n, W = t.bits, mask = W - 1;
    const guard = t.s ? 'if (b == 0 || b == -1) return ' : 'if (b == 0) return ';
    P(`static ${T} add_${N}(${T} a, ${T} b) { return (${T})((unsigned long long)a + (unsigned long long)b); }`);
    P(`static ${T} sub_${N}(${T} a, ${T} b) { return (${T})((unsigned long long)a - (unsigned long long)b); }`);
    P(`static ${T} mul_${N}(${T} a, ${T} b) { return (${T})((unsigned long long)a * (unsigned long long)b); }`);
    P(`static ${T} neg_${N}(${T} a) { return (${T})(0ULL - (unsigned long long)a); }`);
    P(`static ${T} div_${N}(${T} a, ${T} b) { ${guard}a; return (${T})(a / b); }`);
    P(`static ${T} mod_${N}(${T} a, ${T} b) { ${guard}${t.s ? '0' : 'a'}; return (${T})(a % b); }`);
    P(`static ${T} shl_${N}(${T} a, ${T} b) { return (${T})((unsigned long long)a << ((unsigned)b & ${mask})); }`);
    P(`static ${T} shr_${N}(${T} a, ${T} b) { return (${T})(a >> ((unsigned)b & ${mask})); }`);
  }
  P('static int d2i(double d) { if (d > 1e9) d = 1e9; if (d < -1e9) d = -1e9; return (int)d; }');
  P('struct S { int a; unsigned char b; long long c; short d; };');
  const GN = 4 + ri(4), AN = 2 + ri(3), DN = 2, FN = 1;
  const gl = [], arrs = [], dbl = [], flt = [];
  for (let i = 0; i < GN; i++) { const t = pick(TY); gl.push({ n: 'g' + i, t }); }
  for (let i = 0; i < AN; i++) { const t = pick(TY), size = pick([4, 8, 16]); arrs.push({ n: 'a' + i, t, size }); }
  for (let i = 0; i < DN; i++) dbl.push('db' + i);
  for (let i = 0; i < FN; i++) flt.push('fl' + i);
  const lit = (t) => { const v = pick([0, 1, 2, 3, 7, 255, 256, 65535, 65536, 12345, 2147483647, 4294967295, 123456789, -1, -2, -128, -32768, 1000000007]); const big = chance(0.15); if (t.bits === 64 && (big || v > 2147483647)) return (t.s ? '' : '') + String(ri(2147483647) * 1000003 + ri(97)) + (t.s ? 'LL' : 'ULL'); return v < 0 ? `((${t.c})(${v}))` : `((${t.c})${v}${v > 2147483647 ? 'U' : ''})`; };
  const idx = (e, size) => `((unsigned)(${e}) & ${size - 1}u)`;
  function expr(d, vars, T) {
    // a call-free, side-effect-free expression; result is implicitly converted by its user
    const leaf = () => {
      const r = R();
      if (r < 0.25) return lit(T || pick(TY));
      if (r < 0.55 && vars.length) return pick(vars).n;
      if (r < 0.7) { const a = pick(arrs); return `${a.n}[${idx(vars.length ? pick(vars).n : '1', a.size)}]`; }
      if (r < 0.78) return `gs.${pick(['a', 'b', 'c', 'd'])}`;
      if (r < 0.84) return `d2i(${pick(dbl)})`;
      if (r < 0.88) return `d2i(${pick(flt)})`;
      return vars.length ? pick(vars).n : '3';
    };
    if (d <= 0) return leaf();
    const t = T || pick(TY), r = R();
    const sub = (tt) => expr(d - 1, vars, tt || pick(TY));
    if (r < 0.40) return `${pick(['add', 'sub', 'mul', 'div', 'mod', 'shl', 'shr'])}_${t.n}(${sub()}, ${sub()})`;
    if (r < 0.46) return `${pick(['neg'])}_${t.n}(${sub()})`;
    if (r < 0.54) return `(${sub()} ${pick(['&', '|', '^'])} ${sub()})`;
    if (r < 0.60) return `(~${sub()})`;
    if (r < 0.70) return `(${sub()} ${pick(['<', '<=', '>', '>=', '==', '!='])} ${sub()})`;
    if (r < 0.76) return `(${sub()} ${pick(['&&', '||'])} ${sub()})`;
    if (r < 0.80) return `(!${sub()})`;
    if (r < 0.88) return `(${sub()} ? ${sub(t)} : ${sub(t)})`;
    if (r < 0.95) return `((${pick(TY).c})${sub()})`;
    return leaf();
  }
  const sc = { loops: 0 };
  function stmts(depth, vars, n, inLoop, fnIdx) {
    const ss = [];
    for (let i = 0; i < n; i++) ss.push(stmt(depth, vars, inLoop, fnIdx));
    return ss.join('\n');
  }
  const lv = (vars) => pick(vars);
  function stmt(depth, vars, inLoop, fnIdx) {
    const r = R(), E = (dd) => expr(dd === undefined ? 2 : dd, vars);
    if (r < 0.26) { const v = lv(vars); return `${v.n} = ${E()};`; }
    if (r < 0.34) { const v = lv(vars); return `${v.n} = ${pick(['add', 'sub', 'mul', 'div', 'mod', 'xor'])}_${v.t.n}(${v.n}, ${E()});`.replace('xor_' + v.t.n + '(', 'add_' + v.t.n + '('); }
    if (r < 0.43) { const a = pick(arrs); return `${a.n}[${idx(E(1), a.size)}] = ${E()};`; }
    if (r < 0.48) { const a = pick(arrs); const v = lv(vars); return `{ ${a.t.c} *p = &${a.n}[${idx(E(1), a.size)}]; *p = add_${a.t.n}(*p, ${E()}); ${v.n} = *p; }`; }
    if (r < 0.52) { const d = pick(dbl); return `${d} = (${d} + (double)(${E()})) * 0.5;`; }
    if (r < 0.55) { const f = pick(flt); return `${f} = ${f} * 0.5f + (float)(short)(${E()});`; }
    if (r < 0.60) return `gs.${pick(['a', 'b', 'c', 'd'])} = ${E()};`;
    if (r < 0.64) return `{ struct S t = gs; t.a = (int)(${E()}); gs = t; }`;
    if (r < 0.68) { const v = lv(vars); return `${v.n} = (${v.t.c})mk(${E()}, ${E()}).${pick(['a', 'b', 'c', 'd'])};`; }
    if (r < 0.71) { const v = lv(vars); return `${v.n} = (${v.t.c})sumS(gs);`; }
    if (r < 0.75 && fnIdx > 0) { const v = lv(vars); const j = ri(fnIdx); return `${v.n} = (${v.t.c})fn${j}(${fnArgs(j, vars)});`; }
    if (r < 0.80 && depth > 0) return `if (${E()}) {\n${stmts(depth - 1, vars, 1 + ri(2), inLoop, fnIdx)}\n} else {\n${stmts(depth - 1, vars, 1 + ri(2), inLoop, fnIdx)}\n}`;
    if (r < 0.88 && depth > 0 && sc.loops < 3) { sc.loops++; const k = 2 + ri(5), iv = 'i' + sc.loops + '_' + ri(1000);
      const body = stmts(depth - 1, vars.concat([{ n: iv, t: TY[4] }]), 1 + ri(3), true, fnIdx) + (chance(0.3) ? `\nif (${expr(1, vars)}) ${chance(0.5) ? 'break' : 'continue'};` : '');
      sc.loops--; const kind = ri(3);
      if (kind === 0) return `for (int ${iv} = 0; ${iv} < ${k}; ${iv}++) {\nif (fuel == 0) break; fuel--;\n${body}\n}`;
      if (kind === 1) return `{ int ${iv} = ${k}; while (${iv} > 0) {\nif (fuel == 0) break; fuel--;\n${iv}--;\n${body.replace(/continue;/g, 'continue;')}\n} }`;
      return `{ int ${iv} = 0; do {\nif (fuel == 0) break; fuel--;\n${body}\n${iv}++; } while (${iv} < ${k}); }`.replace(/continue;/g, `{ ${iv}++; continue; }`);
    }
    if (r < 0.93 && depth > 0) { const k = 2 + ri(3); let cs = ''; for (let c = 0; c < k; c++) cs += `case ${c}: ${stmts(0, vars, 1, inLoop, fnIdx)}${chance(0.7) ? ' break;' : ''}\n`; return `switch ((unsigned)(${E(1)}) & ${k}u) {\n${cs}default: ${stmts(0, vars, 1, inLoop, fnIdx)} break;\n}`; }
    if (r < 0.96) { const a = pick(arrs); return `for (int q = 0; q < ${a.size}; q++) { ${a.n}[q] = add_${a.t.n}(${a.n}[q], (${a.t.c})(q * ${1 + ri(7)})); }`; }
    return `{ ${vars[0] ? '' : ''}chk((unsigned long long)(${E()})); }`;
  }
  const fns = [];
  function fnArgs(j, vars) { return fns[j].params.map(p => `(${p.c})(${expr(1, vars)})`).join(', '); }
  // helpers shared by all functions
  P('static unsigned long long H = 1469598103934665603ULL;');
  P('static void chk(unsigned long long v) { H = (H ^ v) * 1099511628211ULL; }');
  for (const g of gl) P(`static ${g.t.c} ${g.n} = ${lit(g.t)};`);
  for (const a of arrs) P(`static ${a.t.c} ${a.n}[${a.size}] = {${Array.from({ length: a.size }, () => lit(a.t)).slice(0, 1 + ri(a.size)).join(', ')}};`);
  for (const d of dbl) P(`static double ${d} = ${((ri(2000) - 1000) / 8).toFixed(3)};`);
  for (const f of flt) P(`static float ${f} = ${((ri(200) - 100) / 4).toFixed(2)}f;`);
  P('static struct S gs = { 1, 2, 3, 4 };');
  P('static struct S mk(int a, long long c) { struct S r; r.a = a; r.b = (unsigned char)c; r.c = c * 3; r.d = (short)(a ^ (int)c); return r; }');
  P('static long long sumS(struct S s) { return (long long)s.a + s.b + s.c + s.d; }');
  const NF = 3 + ri(3);
  for (let k = 0; k < NF; k++) {
    const np = 1 + ri(3), params = Array.from({ length: np }, () => pick(TY)), rt = pick(TY);
    const locs = Array.from({ length: 2 + ri(3) }, (_, i) => ({ n: 'l' + i, t: pick(TY) }));
    const vars = gl.map(g => g).concat(params.map((p, i) => ({ n: 'p' + i, t: p }))).concat(locs);
    fns.push({ params });
    const head = `static ${rt.c} fn${k}(${params.map((p, i) => p.c + ' p' + i).join(', ')}) {`;
    const decl = locs.map(l => `${l.t.c} ${l.n} = ${lit(l.t)};`).join(' ');
    sc.loops = 0;
    P(`${head}\n${decl}\nif (fuel == 0) return 0; fuel--;\n${stmts(3, vars, 4 + ri(5), false, k)}\nreturn (${rt.c})(${expr(2, vars)});\n}`);
  }
  // main
  const mv = gl.slice();
  let m = 'int main(void) {\n';
  for (let k = 0; k < 3 + ri(3); k++) { const j = ri(fns.length), v = pick(mv); m += `${v.n} = (${v.t.c})fn${j}(${fnArgs(j, mv)});\n`; sc.loops = 0; m += stmts(2, mv, 2 + ri(3), false, fns.length) + '\n'; }
  for (const g of gl) m += `printf("${g.n}=%${g.t.s ? 'lld' : 'llu'}\\n", (${g.t.s ? 'long long' : 'unsigned long long'})${g.n});\n`;
  for (const a of arrs) m += `{ unsigned long long s = 0; for (int q = 0; q < ${a.size}; q++) s = s * 31 + (unsigned long long)${a.n}[q]; printf("${a.n}=%llu\\n", s); }\n`;
  m += 'printf("gs=%d %d %lld %d\\n", gs.a, gs.b, gs.c, gs.d);\n';
  for (const d of dbl) m += `printf("${d}=%.3f\\n", ${d});\n`;
  for (const f of flt) m += `printf("${f}=%.2f\\n", (double)${f});\n`;
  m += 'printf("H=%llu fuel=%llu\\n", H, fuel);\nreturn 0;\n}\n';
  P(m);
  return out.join('\n');
};
