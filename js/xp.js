// XP, levels and a daily streak. Earn XP by raising the grade of a program (grading the same code again earns nothing).
// Everything lives in localStorage on this phone; switch it off in the menu (Progress: on/off).
(function (g) {
  'use strict';
  const CC = g.CC = g.CC || {};
  const LEVELS = [[0, 'Rookie'], [50, 'Coder'], [150, 'Debugger'], [300, 'Compiler'], [500, 'Optimizer'], [800, 'Pointer Pro'], [1200, 'Memory Master'], [1800, 'Bug Slayer'], [2600, 'C Sensei'], [3600, 'Legend']];
  const KEY = 'cs.xpdata';
  function load() { try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d && typeof d.xp === 'number') return d; } catch (e) { /* private mode */ } return { xp: 0, best: {}, streak: 0, last: '', graded: 0 }; }
  function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ } }
  function day(t) { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function levelOf(xp) { let i = 0; while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1][0]) i++; const lo = LEVELS[i][0], hi = LEVELS[i + 1] ? LEVELS[i + 1][0] : null; return { n: i + 1, name: LEVELS[i][1], lo, hi, pct: hi === null ? 100 : Math.round(100 * (xp - lo) / (hi - lo)) }; }

  // award(score, code) -> { gained, xp, level, prevLevel, streak, streakUp, firstToday }
  function award(score, code, now) {
    const d = load(), t = now || Date.now(), today = day(t), before = levelOf(d.xp).n;
    const k = hash(String(code || '')), old = d.best[k] || 0, gain = Math.max(0, Math.round((score - old) * 10));
    if (score > old) d.best[k] = score;
    const keys = Object.keys(d.best); if (keys.length > 300) delete d.best[keys[0]];
    d.xp += gain; d.graded++;
    let streakUp = false, firstToday = false;
    if (d.last !== today) {
      firstToday = true;
      d.streak = d.last === day(t - 86400000) ? d.streak + 1 : 1; streakUp = d.streak > 1; d.last = today;
    }
    save(d);
    return { gained: gain, xp: d.xp, level: levelOf(d.xp), prevLevel: before, streak: d.streak, streakUp, firstToday };
  }
  function status() { const d = load(); return { xp: d.xp, level: levelOf(d.xp), streak: d.last === day(Date.now()) || d.last === day(Date.now() - 86400000) ? d.streak : 0 }; }
  CC.xp = { award, status, levelOf, LEVELS };
  if (typeof module !== 'undefined') module.exports = CC.xp;
})(typeof self !== 'undefined' ? self : globalThis);
