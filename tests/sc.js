const fs=require('fs');const {CC,run}=require('./harness.js');
for(const f of process.argv.slice(2)){
  const src=fs.readFileSync(f,'utf8');const r=run(src,{stdin:'',maxSlices:30});
  const s=CC.score({compile:r.compile,run:{runError:r.runError,exit:r.exit,leaks:r.leaks,noInput:true,hadStderr:!!(r.err&&r.err.length)}});
  console.log(f.split('/').pop(),s.score,s.grade);for(const p of s.parts)console.log('  ',p.name,p.got+'/'+p.max,p.notes.filter(n=>n.delta<0).map(n=>n.text.slice(0,70)).join(' | '));
}
