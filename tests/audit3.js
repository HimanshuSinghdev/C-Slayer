const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();let issues=[];
for(const w of [320,360,412]){const p=await b.newPage({viewport:{width:w,height:740},deviceScaleFactor:2,isMobile:true,hasTouch:true});
p.on('pageerror',e=>issues.push(w+' pageerror '+e));p.on('dialog',d=>d.accept());
await p.goto('http://localhost:8765/index.html');await p.waitForTimeout(600);
const scan=async(tag)=>{const r=await p.evaluate(()=>{const out=[];const vw=innerWidth;
 for(const e of document.querySelectorAll('body *')){if(!e.offsetParent&&getComputedStyle(e).position!=='fixed')continue;const b=e.getBoundingClientRect();if(!b.width)continue;
  const cs=getComputedStyle(e);if(b.right>vw+1&&!e.closest('.CodeMirror,.tabs,.keys,.CodeMirror-hints'))out.push('overflowX '+(e.id||e.className||e.tagName)+' '+Math.round(b.right));
  if((e.tagName==='BUTTON'||e.tagName==='SELECT')&&(b.height<34||b.width<30)&&!e.closest('.CodeMirror'))out.push('small '+(e.id||e.className||e.textContent.slice(0,10))+' '+Math.round(b.width)+'x'+Math.round(b.height));
  if(e.scrollWidth>e.clientWidth+2&&cs.overflowX==='visible'&&e.children.length===0&&e.clientWidth>0)out.push('textclip '+(e.id||e.className||e.tagName)+' '+e.scrollWidth+'>'+e.clientWidth);}
 return [...new Set(out)];});r.forEach(x=>issues.push(w+' '+tag+' '+x));};
await scan('console');
await p.evaluate(()=>document.querySelector('.CodeMirror').CodeMirror.setValue('#include <stdio.h>\nint main(){int a[3];a[5]=1;int x;printf("%d\\n",x);return 0;}'));
await p.click('#btnRun');await p.waitForTimeout(1500);await scan('after-run');
for(const t of ['problems','tests','score','console']){await p.click('[data-tab='+t+']');await p.waitForTimeout(200);await scan(t);
 if(w===360)await p.screenshot({path:'/tmp/tab_'+t+'.png'});}
await p.click('#btnScore');await p.waitForTimeout(2500);await scan('graded');if(w===360)await p.screenshot({path:'/tmp/tab_graded.png'});
await p.close();}
console.log(issues.length?issues.join('\n'):'no issues');await b.close();})()
