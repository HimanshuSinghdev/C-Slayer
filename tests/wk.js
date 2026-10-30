const fs=require('fs'),path=require('path'),vm=require('vm');
const msgs=[];const base=path.join(__dirname,'../js');
const sandbox={console,setTimeout,performance,TextEncoder,TextDecoder,
  importScripts:(...fs_)=>{for(const f of fs_)vm.runInContext(fs.readFileSync(path.join(base,f),'utf8'),ctx,{filename:f});},
  postMessage:m=>msgs.push(m)};
sandbox.self=sandbox;sandbox.globalThis=sandbox;
const ctx=vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(base,'worker.js'),'utf8'),ctx);
const send=m=>ctx.self.onmessage({data:m});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  send({type:'run',id:1,src:'#include <stdio.h>\nint main(){int n;printf("n? ");scanf("%d",&n);printf("sq=%d\\n",n*n);return 0;}'});
  await wait(300);console.log(msgs.map(m=>m.type+(m.s?':'+JSON.stringify(m.s):'')).join(' '));
  send({type:'stdin',id:1,text:'7\n',eof:false});await wait(300);
  console.log(msgs.slice(-3).map(m=>JSON.stringify(m)).join('\n'));
  msgs.length=0;
  send({type:'score',id:2,src:'#include <stdio.h>\nint main(){int n;scanf("%d",&n);printf("%d\\n",n*2);return 0;}',stdin:'',tests:[{input:'4',expected:'8'},{input:'5',expected:'11'}]});
  await wait(500);const r=msgs.find(m=>m.type==='score-result');console.log(r.result.score,r.tests.map(t=>t.pass));
  msgs.length=0;
  send({type:'run',id:3,src:'int main(){for(;;);}'});await wait(1500);send({type:'stop',id:3});await wait(100);console.log(msgs.map(m=>m.type+':'+m.status).join(' '));
  process.exit(0);
})();
