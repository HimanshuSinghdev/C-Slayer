#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
struct N{int v;struct N*n;};
int main(void){struct N*h=0,*t=0;int x;while(scanf("%d",&x)==1&&x>=0){struct N*n=malloc(sizeof*n);n->v=x;n->n=0;if(t)t->n=n;else h=n;t=n;}int s=0,c=0;for(struct N*p=h;p;p=p->n){s+=p->v;c++;printf("%d ",p->v);}printf("\nsum=%d count=%d\n",s,c);while(h){struct N*n=h->n;free(h);h=n;}return 0;}
