const fs=require('fs');const load=require('./load');
const CC=load(['lexer.js','preproc.js','types.js','parser.js','isa.js','vm.js','inspect.js','headers.js','libc.js','cdecl.js','cexpr.js','cstmt.js','cfmt.js','compile.js','turbo.js']);
const src=fs.readFileSync(process.argv[2],'utf8');const c=CC.compile(src,{});if(!c.ok){console.log(c.errors);process.exit(1);}
for(const mode of ['turbo']){const vm=new CC.VM(c.program,{});vm.feedInput('',true);let out='';
 const t=Date.now();const mod=CC.Turbo.build(vm,{tick(){}});const tb=Date.now()-t;const t1=Date.now();const st=CC.Turbo.run(vm,mod);
 for(const q of vm.drainOutput())out+=q.s;console.log(mode,st,'build',tb,'ms run',Date.now()-t1,'ms',JSON.stringify(out.slice(0,80)),vm.error&&vm.error.message);}
{const vm=new CC.VM(c.program,{});vm.feedInput('',true);const t=Date.now();let st;do{st=vm.run(1e6);vm.drainOutput();}while(st==='yield');console.log('vm',st,Date.now()-t,'ms');}
