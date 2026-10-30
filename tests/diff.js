const fs=require('fs'),path=require('path'),cp=require('child_process');
const {run}=require('./harness.js');
const dir=path.join(__dirname,'corpus'), tmp=process.env.TMPD||'/tmp/cs-diff'; fs.mkdirSync(tmp,{recursive:true});
const only=process.argv[2]; let pass=0,fail=0;
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.c')).sort()){
  if(only&&!f.includes(only))continue;
  const base=f.slice(0,-2), src=fs.readFileSync(path.join(dir,f),'utf8');
  const inF=path.join(dir,base+'.in'), stdin=fs.existsSync(inF)?fs.readFileSync(inF,'utf8'):'';
  const exe=path.join(tmp,base);
  const g=cp.spawnSync('gcc',['-std=gnu11','-w','-o',exe,path.join(dir,f),'-lm']);
  if(g.status){console.log('GCC FAIL',f,g.stderr.toString().slice(0,300));continue;}
  const w=fs.mkdtempSync(path.join(tmp,'w'));
  const r=cp.spawnSync(exe,[],{input:stdin,cwd:w,timeout:10000});
  const want=r.stdout.toString();
  let got,res;
  try{res=run(src,{stdin});got=res.out;}catch(e){console.log('CRASH',f,e.stack.split('\n').slice(0,4).join('\n'));fail++;continue;}
  if(!res.ok){console.log('COMPILE FAIL',f,JSON.stringify(res.errors.filter(e=>e.sev==='error').slice(0,3)));fail++;continue;}
  if(got===want&&res.exit===r.status){pass++;continue;}
  fail++;
  const a=want.split('\n'),b=got.split('\n');
  console.log('DIFF',f,'exit',r.status,'vs',res.exit,res.runError?JSON.stringify(res.runError.message||res.runError):'');
  let n=0;for(let i=0;i<Math.max(a.length,b.length)&&n<4;i++)if(a[i]!==b[i]){console.log('  line',i+1,'\n   gcc :',a[i],'\n   ours:',b[i]);n++;}
}
console.log('pass',pass,'fail',fail);
