#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
struct D{int v;struct D*p,*n;};
int main(void){struct D*h=0,*t=0;for(int i=1;i<=5;i++){struct D*d=malloc(sizeof*d);d->v=i;d->n=0;d->p=t;if(t)t->n=d;else h=d;t=d;}for(struct D*x=t;x;x=x->p)printf("%d ",x->v);puts("");struct D*m=h->n->n;m->p->n=m->n;m->n->p=m->p;free(m);for(struct D*x=h;x;x=x->n)printf("%d ",x->v);puts("");while(h){struct D*n=h->n;free(h);h=n;}return 0;}
