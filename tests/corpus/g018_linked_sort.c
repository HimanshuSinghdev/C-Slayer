#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdarg.h>
#include <stddef.h>
#include <limits.h>
#include <float.h>
struct N{int v;struct N*n;};
struct N*ins(struct N*h,int v){struct N**p=&h;while(*p&&(*p)->v<v)p=&(*p)->n;struct N*n=malloc(sizeof*n);n->v=v;n->n=*p;*p=n;return h;}
int main(void){struct N*h=0;int a[]={5,1,4,2,3,9,0};for(int i=0;i<7;i++)h=ins(h,a[i]);for(struct N*p=h;p;p=p->n)printf("%d ",p->v);puts("");while(h){struct N*t=h->n;free(h);h=t;}return 0;}
