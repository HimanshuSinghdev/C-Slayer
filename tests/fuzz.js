const {CC,run}=require('./harness.js');
const t0=Date.now();let thrown=0,n=0;
const frag=['int','char','*','(',')','{','}',';','[',']','=','+','-','<','>','&','x','y','main','__proto__','constructor','toString','struct','union','enum','typedef','if','else','for','while','return','1','0','"s"',"'c'",',','.','->','sizeof','#define A A A','#include <stdio.h>','#if','#endif','goto','L:','case','switch','void','printf','malloc','++','?',':','/*','//','\\','"','1e999','0x','...'];
let seed=12345;const rnd=()=>(seed=(seed*1103515245+12345)&0x7fffffff)/0x7fffffff;
for(let i=0;i<4000;i++){let s='';const len=1+Math.floor(rnd()*60);for(let j=0;j<len;j++)s+=frag[Math.floor(rnd()*frag.length)]+(rnd()<.2?'\n':' ');
  try{const c=CC.compile(s,{});n++;if(c.ok){const vm=new CC.VM(c.program,{});vm.feedInput('',true);for(let k=0;k<5;k++){const st=vm.run(20000);vm.drainOutput();if(st!=='yield')break;}}}catch(e){thrown++;if(thrown<6)console.log('THROW',JSON.stringify(s).slice(0,160),e.message);}}
console.log('fuzz',n,'thrown',thrown,(Date.now()-t0)+'ms');
const bombs={
 deepParen:'int main(){return '+'('.repeat(5000)+'1'+')'.repeat(5000)+';}',
 deepBlock:'int main(){'+'{'.repeat(5000)+'}'.repeat(5000)+'}',
 deepIf:'int main(){'+'if(1)'.repeat(5000)+';}',
 macroExp:'#define A B B\n#define B C C\n#define C D D\n#define D E E\n#define E F F\n#define F G G\n#define G H H\n#define H I I\n#define I J J\n#define J K K\n#define K L L\n#define L M M\n#define M N N\n#define N O O\n#define O P P\n#define P Q Q\n#define Q R R\n#define R S S\n#define S T T\n#define T U U\n#define U 1\nint main(){return A;}',
 recMacro:'#define X X+1\nint main(){return X;}',
 incl:'#include "x.h"\nint main(){return 0;}',
 bigArr:'int a[1000000000];int main(){return 0;}',
 bigLocal:'int main(){char a[100000000];a[0]=1;return a[0];}',
 hugeLine:'int main(){return '+'1+'.repeat(100000)+'1;}',
 protoNames:'int main(){int __proto__=1;int constructor=2;int hasOwnProperty=3;struct __proto__2{int toString;};return __proto__+constructor+hasOwnProperty;}',
 protoFn:'int constructor(void){return 4;}int main(){return constructor();}',
 allocBomb:'#include <stdlib.h>\nint main(){for(int i=0;i<100000;i++)malloc(1000000);return 0;}',
 fmtBomb:'#include <stdio.h>\nint main(){printf("%1000000d\\n",1);return 0;}',
 pctn:'#include <stdio.h>\nint main(){int x=1;printf("%n",&x);printf("%d\\n",x);return 0;}',
};
for(const [k,s] of Object.entries(bombs)){const t=Date.now();let r;try{r=run(s,{stdin:'',maxSlices:20});}catch(e){console.log(k,'THROW',e.message.slice(0,100));continue;}
 console.log(k.padEnd(10),'ok='+r.ok,'exit='+r.exit,'rt='+(r.runError&&r.runError.kind),'e0='+(r.errors[0]&&r.errors[0].msg.slice(0,60)),(Date.now()-t)+'ms');}
