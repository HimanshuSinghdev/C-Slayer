const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 393, height: 900 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(800);
  const code = '#include <stdio.h>\n#include <stdlib.h>\ntypedef struct Node { int value; struct Node *next; } Node;\nint main(void) {\n  int x = 5;\n  int *px = &x;\n  Node *a = malloc(sizeof(Node));\n  Node *b = malloc(sizeof(Node));\n  a->value = 1; a->next = b;\n  b->value = 2; b->next = NULL;\n  int *arr = malloc(10 * sizeof(int));\n  free(arr);\n  int *bad;\n  printf("%d\\n", *px);\n  return 0;\n}\n';
  await p.evaluate((c) => document.querySelector('.CodeMirror').CodeMirror.setValue(c), code);
  await p.locator('.CodeMirror-linenumber:visible', { hasText: /^14$/ }).click();
  await p.click('#btnDebug'); await p.waitForTimeout(1500);
  await p.click('#dContinue'); await p.waitForTimeout(1200); await p.click('#dMemBtn'); await p.waitForTimeout(300);
  const info = await p.evaluate(() => ({ rects: document.querySelectorAll('#dMem rect').length, arrows: document.querySelectorAll('#dMem .mv-arrow').length, bad: document.querySelectorAll('#dMem .mv-abad').length, hidden: document.querySelector('#dMem').hidden, vw: document.documentElement.scrollWidth > innerWidth }));
  console.log(info, errs);
  await p.locator('#dMem').screenshot({ path: '/tmp/mem.png' });
  await b.close(); process.exit(info.rects >= 6 && info.arrows >= 3 && !info.vw && !errs.length ? 0 : 1);
})();
