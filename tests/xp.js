// XP rules: improving a program earns XP, repeating it earns nothing, streak counts days, levels follow XP
global.localStorage = { d: {}, getItem(k) { return this.d[k] || null; }, setItem(k, v) { this.d[k] = String(v); } };
const XP = require('../js/xp.js'); let bad = 0; const ok = (c, m) => { if (!c) bad++; console.log(c ? 'ok  ' : 'BAD ', m); };
const D = 86400000, t0 = Date.parse('2026-11-23T10:00:00');
let a = XP.award(6, 'code A', t0); ok(a.gained === 60 && a.xp === 60 && a.streak === 1 && a.level.n === 2, 'first grade 6/10 → +60 XP, level 2, streak 1');
a = XP.award(6, 'code A', t0 + 1000); ok(a.gained === 0, 'same code again → +0');
a = XP.award(8.5, 'code A', t0 + 2000); ok(a.gained === 25 && a.xp === 85, 'improved to 8.5 → only the difference (+25)');
a = XP.award(5, 'code B', t0 + D); ok(a.gained === 50 && a.streak === 2 && a.streakUp, 'next day, new code → +50, streak 2');
a = XP.award(9, 'code C', t0 + 3 * D); ok(a.streak === 1, 'a missed day resets the streak');
a = XP.award(10, 'code D', t0 + 3 * D + 5); ok(a.streak === 1 && a.gained === 100, 'same day keeps streak');
ok(XP.levelOf(0).name === 'Rookie' && XP.levelOf(3600).name === 'Legend' && XP.levelOf(299).n === 3, 'level table');
console.log('bad', bad); process.exit(bad ? 1 : 0);
