const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 393, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(800);
  await p.selectOption('#samples', 'p3'); await p.waitForTimeout(300);
  const out = await p.textContent('#out'); console.log(out.trim().split('\n').slice(0, 3).join(' | '));
  await p.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.setValue('#include <stdio.h>\n// n-th Fibonacci number\nint main(void) {\n    int n;\n    if (scanf("%d", &n) != 1) return 1;\n    long long a = 0, b = 1;\n    for (int i = 0; i < n; i++) { long long t = a + b; a = b; b = t; }\n    printf("%lld\\n", a);\n    return 0;\n}\n'));
  await p.click('[role=tab]:has-text("Tests")'); await p.waitForTimeout(200);
  const locked = await p.locator('.tcase.locked').count(); const leave = await p.isVisible('#endProblem');
  await p.click('#btnScore'); await p.waitForTimeout(2500);
  await p.click('[role=tab]:has-text("Score")'); await p.waitForTimeout(500);
  const txt = await p.textContent('.score'); const m = /(\d+(\.\d)?)\/10/.exec(txt);
  console.log('locked', locked, 'leave button', leave, 'score text', (m && m[0]), 'tests line', /(\d+) of (\d+) test cases passed/.exec(txt)?.[0], errs);
  await b.close(); process.exit(locked >= 4 && leave && /6 of 6/.test(txt) && !errs.length ? 0 : 1);
})();
