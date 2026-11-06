const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();let bad=0;
for(const w of [320,340,360,375,384,393,412,430,480]){const p=await b.newPage({viewport:{width:w,height:760},deviceScaleFactor:2,hasTouch:true,isMobile:true});
await p.goto('http://localhost:8765/index.html');await p.waitForTimeout(500);
const r=await p.evaluate(()=>{const R=s=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return {l:b.left,r:b.right,w:b.width,disp:getComputedStyle(e).display}};
const word=R('.word'),by=R('.by'),run=R('#btnRun'),brand=R('.brand'),fl=document.querySelector('.files');const kids=[...fl.children].filter(k=>k.offsetParent);
const fr=fl.getBoundingClientRect();const over=kids.some(k=>k.getBoundingClientRect().right>fr.right-1);
return {wordR:word.r,runL:run.l,byShown:by.disp!=='none',byR:by.disp!=='none'?by.r:0,brandR:brand.r,filesOverflow:over,sw:document.documentElement.scrollWidth}});
const ok=r.wordR<=r.runL-4&&(!r.byShown||r.byR<=r.runL-4)&&!r.filesOverflow&&r.sw<=w;if(!ok)bad++;
console.log(w,ok?'ok ':'BAD',JSON.stringify(r));
await p.screenshot({path:`/tmp/hdr${w}.png`,clip:{x:0,y:0,width:w,height:100}});await p.close();}
console.log('bad',bad);await b.close();})()
