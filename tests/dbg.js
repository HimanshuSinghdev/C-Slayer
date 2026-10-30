const {CC}=require('./harness.js');
const src=`#include <stdio.h>
#include <stdlib.h>
typedef struct Node { int v; struct Node *next; } Node;
int sq(int x) {
    int r = x * x;
    return r;
}
int main(void) {
    int a[3] = {1, 2, 3};
    char name[8] = "hey";
    Node *n = malloc(sizeof *n);
    n->v = sq(4);
    n->next = NULL;
    for (int i = 0; i < 2; i++) {
        a[i] += n->v;
    }
    printf("%d\\n", a[0]);
    free(n);
    return 0;
}`;
const c=CC.compile(src,{debug:true});
if(!c.ok){console.log(c.errors);process.exit(1)}
const vm=new CC.VM(c.program,{});vm.feedInput('',true);
vm.dbgSet('into',[]);
let steps=0,st;const trace=[];
while((st=vm.run(100000))==='break'&&steps<60){steps++;const s=vm.inspect();trace.push(s.line+':'+s.stack.map(f=>f.fn+'('+f.vars.map(v=>v.name+'='+v.text).join(',')+')').join(' < '));vm.dbgSet('over',[]);}
console.log(trace.join('\n'));console.log(st,vm.exitCode);
const o=vm.drainOutput();console.log(JSON.stringify(o));
