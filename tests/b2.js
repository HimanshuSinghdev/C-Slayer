const {run}=require('./harness.js');
const t=Date.now();const r=run('#include <stdio.h>\nint main(){long s=0;for(int i=0;i<5000000;i++){s+=i%7;}printf("%ld\\n",s);return 0;}',{stdin:'',maxSlices:100000});
console.log(r.out.trim(),Date.now()-t,'ms');
const c=r.compile.program;const names=Object.entries(require('./harness.js').CC.OP);
const inv={};for(const [k,v] of names)inv[v]=k;let i=0;const ops=[];
// dump main code
const f=c.funcs.find(f=>f.name==='main');console.log(JSON.stringify(f).slice(0,200));
