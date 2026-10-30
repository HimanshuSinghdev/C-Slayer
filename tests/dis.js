const {CC,run}=require('./harness.js');
const src=require('fs').readFileSync(process.argv[2],'utf8');const c=CC.compile(src,{});if(!c.ok){console.log(c.errors);process.exit(1)}
const inv={};for(const [k,v] of Object.entries(CC.OP))inv[v]=k;const P=c.program;
const f=P.funcs.find(f=>f.name===(process.argv[3]||'main'));let pc=f.entry;const out=[];
for(let i=0;i<(+process.argv[4]||60);i++){const op=P.code[pc];const n=CC.OPARGS[op];out.push(pc+': '+inv[op]+' '+Array.from(P.code.slice(pc+1,pc+1+n)).join(','));pc+=1+n;if(inv[op]==='HALT')break;}
console.log(out.join('\n'));
