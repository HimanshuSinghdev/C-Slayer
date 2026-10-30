const {run,CC}=require('./harness.js');
function t(name,src){const s=Date.now();const r=run(src,{stdin:'',maxSlices:100000});console.log(name.padEnd(10),JSON.stringify(r.out.trim()),Date.now()-s,'ms',r.runError&&r.runError.kind);return r;}
t('int5M','#include <stdio.h>\nint main(){int s=0;for(int i=0;i<5000000;i++){s+=i%7;}printf("%d\\n",s);return 0;}');
t('empty5M','int main(){for(int i=0;i<5000000;i++){}return 0;}');
t('long5M','#include <stdio.h>\nint main(){long s=0;for(int i=0;i<5000000;i++){s+=i;}printf("%ld\\n",s);return 0;}');
t('dbl5M','#include <stdio.h>\nint main(){double s=0;for(int i=0;i<5000000;i++){s+=i;}printf("%f\\n",s);return 0;}');
