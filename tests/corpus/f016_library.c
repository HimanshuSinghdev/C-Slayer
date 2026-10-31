#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
struct B{int id;char t[30];int q;};
struct B lib[5]={{1,"C Primer",3},{2,"K&R",1},{3,"Algorithms",0},{4,"SICP",2},{5,"TAOCP",5}};
int main(void){int id;while(scanf("%d",&id)==1){int f=0;for(int i=0;i<5;i++)if(lib[i].id==id){f=1;if(lib[i].q>0){lib[i].q--;printf("issued %s (%d left)\n",lib[i].t,lib[i].q);}else printf("%s unavailable\n",lib[i].t);}if(!f)printf("no book %d\n",id);}return 0;}
