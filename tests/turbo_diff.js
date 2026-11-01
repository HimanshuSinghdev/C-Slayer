// differential: VM vs Turbo on every corpus program (stdout, exit code, error kind)
const fs=require('fs'),path=require('path');
const load=require('./load');
const CC=load(['lexer.js','preproc.js','types.js','parser.js','isa.js','vm.js','inspect.js','headers.js','libc.js','cdecl.js','cexpr.js','cstmt.js','cfmt.js','compile.js','turbo.js']);
const dir=path.join(__dirname,'corpus');
const only=process.argv[2];
let ok=0,bad=0,unsup=0,over=0;
function runVM(c,stdin){const vm=new CC.VM(c.program,{});vm.feedInput(stdin,true);let out='',err='';
 for(let g=0;g<100000;g++){const st=vm.run(100000);for(const q of vm.drainOutput()){if(q.fd===2)err+=q.s;else out+=q.s;}
  if(st==='done')return{out,exit:vm.exitCode};if(st==='error')return{out,err:vm.error.kind,line:vm.error.line};if(st==='wait')vm.feedInput('',true);}return{out,err:'timeout'};}
function runT(c,stdin){const vm=new CC.VM(c.program,{});vm.feedInput(stdin,true);let out='';
 const mod=CC.Turbo.build(vm,{tick(){for(const q of vm.drainOutput())if(q.fd!==2)out+=q.s;}});
 const st=CC.Turbo.run(vm,mod);for(const q of vm.drainOutput())if(q.fd!==2)out+=q.s;
 if(st==='done')return{out,exit:vm.exitCode};if(st==='error')return{out,err:vm.error.kind,line:vm.error.line,msg:vm.error.message};return{out,err:st};}
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.c')).sort()){
 if(only&&!f.includes(only))continue;
 const src=fs.readFileSync(path.join(dir,f),'utf8');const inf=path.join(dir,f.replace(/\.c$/,'.in'));
 const stdin=fs.existsSync(inf)?fs.readFileSync(inf,'utf8'):'';
 const c=CC.compile(src,{});if(!c.ok)continue;
 const a=runVM(c,stdin);let b;
 try{b=runT(c,stdin);}catch(e){if(e instanceof CC.Turbo.Unsupported){unsup++;if(only)console.log(f,'UNSUP',e.message);else console.log('UNSUP',f,e.message);continue;}console.log('EXC',f,e.stack.split('\n').slice(0,3).join(' | '));bad++;continue;}
 if(b.err==='overflow'){over++;continue;}
 if(b.err==='internal'&&process.env.MSG)console.log(f,b.msg);if(a.out===b.out&&a.exit===b.exit&&a.err===b.err&&(a.line===b.line))ok++;else{bad++;console.log('DIFF',f,JSON.stringify([a.exit,a.err,a.line]),JSON.stringify([b.exit,b.err,b.line]));if(only){console.log(a.out.slice(0,300));console.log('---');console.log(b.out.slice(0,300));}}
}
console.log({ok,bad,unsup,over});
