const fs=require('fs'),path=require('path'),vm=require('vm');
const msgs=[];const base=path.join(__dirname,'../js');
const sandbox={console,setTimeout,performance,TextEncoder,TextDecoder,importScripts:(...f)=>{for(const x of f)vm.runInContext(fs.readFileSync(path.join(base,x),'utf8'),ctx,{filename:x});},postMessage:m=>msgs.push(m)};
sandbox.self=sandbox;sandbox.globalThis=sandbox;const ctx=vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(base,'worker.js'),'utf8'),ctx);
const send=m=>ctx.self.onmessage({data:m});const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 send({type:'debug',id:1,breakpoints:[6],src:'#include <stdio.h>\nint f(int x){\n int y=x+1;\n return y;\n}\nint main(void){\n int a=f(2);\n printf("%d\\n",a);\n return 0;\n}\n'});
 await wait(300);let p=msgs.filter(m=>m.type==='paused');console.log('paused',p.length,p[p.length-1].snap.line);
 for(const mode of ['into','into','out','over','run']){send({type:'dstep',id:1,mode,breakpoints:[6]});await wait(150);const q=msgs.filter(m=>m.type==='paused');const l=q[q.length-1];console.log(mode,'->',l&&l.snap.line,l&&l.snap.stack.map(f=>f.fn+':'+f.vars.map(v=>v.name+'='+v.text)).join(' < '));}
 console.log(msgs.filter(m=>m.type==='end'||m.type==='out').map(m=>m.type+':'+JSON.stringify(m.s||m.status)).join(' '));
 process.exit(0);})();
