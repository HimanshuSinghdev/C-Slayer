// Motion layer: switch works and persists, zero layout shift (boxes identical with fx on and off), tab bar follows the active tab,
// output fades in, menu and toast fade out instead of vanishing, reduced-motion turns everything off.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); let bad = 0; const ck = (ok, m) => { if (!ok) { bad++; console.log('FAIL', m); } };
  const ctx = await b.newContext({ viewport: { width: 393, height: 780 }, deviceScaleFactor: 2 }), p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(600);
  const boxes = () => p.evaluate(() => [...document.querySelectorAll('header .btn, nav.files > *:not(.menu):not(input), .tabs button, .conrow > *, .pane')].filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)].join(','); }).join('|'));
  ck(await p.evaluate(() => document.documentElement.classList.contains('fx')), 'fx on by default');
  const onBoxes = await boxes();
  await p.click('#btnMore'); await p.waitForTimeout(300);
  ck(/on/.test(await p.textContent('#fxLbl')), 'label says on');
  await p.click('#btnFx'); await p.waitForTimeout(300);
  ck(!(await p.evaluate(() => document.documentElement.classList.contains('fx'))), 'switch turns fx off');
  await p.click('#btnMore').catch(() => {}); await p.waitForTimeout(300);
  const offBoxes = await boxes(); ck(onBoxes === offBoxes, 'layout identical with fx on and off');
  await p.reload(); await p.waitForTimeout(600);
  ck(!(await p.evaluate(() => document.documentElement.classList.contains('fx'))), 'choice persists');
  await p.click('#btnMore'); await p.click('#btnFx'); await p.waitForTimeout(300);
  ck(await p.evaluate(() => document.documentElement.classList.contains('fx')), 'switch turns fx back on');
  // tab bar follows the active tab
  const ind = async () => p.evaluate(() => { const i = document.querySelector('.fx-ind'), t = document.querySelector('.tabs button.on'); return i ? { x: new DOMMatrix(getComputedStyle(i).transform).m41, left: t.offsetLeft } : null; });
  await p.click('.tabs button[data-tab=score]'); await p.waitForTimeout(400);
  const a = await ind(); ck(a && Math.abs(a.x - a.left) < 1, 'indicator under Score ' + JSON.stringify(a));
  await p.click('.tabs button[data-tab=console]'); await p.waitForTimeout(400);
  const c = await ind(); ck(c && Math.abs(c.x - c.left) < 1 && c.x < a.x, 'indicator back under Console');
  // output
  await p.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.setValue('#include <stdio.h>\nint main(){printf("hi\\n");printf("there");return 0;}'));
  await p.click('#btnRun'); await p.waitForTimeout(900);
  const o = await p.evaluate(() => ({ txt: document.querySelector('#out').textContent, anim: [...document.querySelectorAll('#out > span')].map(s => getComputedStyle(s).animationName) }));
  ck(/hi\nthere/.test(o.txt) && /exited with status 0/.test(o.txt), 'output text intact ' + JSON.stringify(o.txt));
  ck(o.anim.every(n => n === 'fx-line'), 'output lines animate ' + o.anim);
  // toast fades rather than vanishes
  await p.click('#btnClearOut'); await p.waitForTimeout(100);
  const t = await p.evaluate(async () => { const t = document.querySelector('#toast'); document.querySelector('#btnFormat').click(); await new Promise(r => setTimeout(r, 400)); const shown = getComputedStyle(t).opacity; await new Promise(r => setTimeout(r, 2500)); return { shown, hidden: getComputedStyle(t).visibility }; });
  ck(t.shown === '1' && t.hidden === 'hidden', 'toast in then out ' + JSON.stringify(t));
  // grade reveal: armed, then drawn, ends fully visible; light mode shows the same end state with no stroke animation
  const fs = require('fs');
  await p.evaluate(src => document.querySelector('.CodeMirror').CodeMirror.setValue(src), fs.readFileSync(__dirname + '/students/fib2.c', 'utf8'));
  await p.click('#btnScore'); await p.waitForSelector('.grade.fx-go', { timeout: 30000 }); await p.waitForTimeout(1300);
  const gr = await p.evaluate(() => { const g = document.querySelector('.grade'); return { off: getComputedStyle(g.querySelector('path')).strokeDashoffset, op: getComputedStyle(g.querySelector('.num')).opacity }; });
  ck(parseFloat(gr.off) === 0 && gr.op === '1', 'grade ends fully drawn ' + JSON.stringify(gr));
  await p.evaluate(() => document.documentElement.classList.add('fx-lite'));
  const lite = await p.evaluate(() => getComputedStyle(document.querySelector('.grade path')).animationName);
  ck(lite === 'none', 'light mode drops the stroke animation');
  await p.click('#btnMore'); await p.waitForTimeout(250); await p.click('#btnFx'); await p.waitForTimeout(150);
  await p.click('#btnMore'); await p.waitForTimeout(250); await p.click('#btnFx'); await p.waitForTimeout(200);
  ck(await p.evaluate(() => document.documentElement.classList.contains('fx') && !document.documentElement.classList.contains('fx-lite')), 'turning animations back on clears light mode');
  ck(!errs.length, 'page errors ' + errs);
  await ctx.close();
  // reduced motion
  const rc = await b.newContext({ viewport: { width: 393, height: 780 }, reducedMotion: 'reduce' }), q = await rc.newPage();
  await q.goto('http://localhost:8765/index.html'); await q.waitForTimeout(500);
  ck(!(await q.evaluate(() => document.documentElement.classList.contains('fx'))), 'reduced motion: fx off');
  await b.close(); console.log(bad ? 'motion: ' + bad + ' failed' : 'motion ok'); process.exit(bad ? 1 : 0);
})();
