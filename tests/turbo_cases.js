const fs=require('fs');const load=require('./load');
const CC=load(['lexer.js','preproc.js','types.js','parser.js','isa.js','vm.js','inspect.js','headers.js','libc.js','cdecl.js','cexpr.js','cstmt.js','cfmt.js','compile.js','turbo.js']);
for(const f of fs.readdirSync(process.argv[2]).filter(f=>f.endsWith('.c'))){
 const c=CC.compile(fs.readFileSync(process.argv[2]+'/'+f,'utf8'),{});if(!c.ok){console.log(f,'COMPILE',c.errors[0]);continue;}
 const res=[];
 for(const m of ['vm','turbo']){const vm=new CC.VM(c.program,{});vm.feedInput('',true);let out='',st;const t=Date.now();
  if(m==='vm'){let g=0;do{st=vm.run(100000);for(const q of vm.drainOutput())out+=q.s;if(++g>300&&st==='yield'){st='timeout';break;}}while(st==='yield');}
  else{const mod=CC.Turbo.build(vm,{tick(){for(const q of vm.drainOutput())out+=q.s;if(Date.now()-t>1500)throw new CC.Turbo.TurboTimeout();}});st=CC.Turbo.run(vm,mod);for(const q of vm.drainOutput())out+=q.s;}
  res.push(JSON.stringify([st,vm.exitCode,out.slice(0,60),vm.error&&vm.error.message,vm.error&&vm.error.line,vm.error&&vm.error.fn]));}
 console.log(res[0]===res[1]?'SAME':'DIFF',f);if(res[0]!==res[1]){console.log(' vm   ',res[0]);console.log(' turbo',res[1]);}
}
