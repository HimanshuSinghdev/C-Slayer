#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
struct N{int v;struct N*next;};
struct N*push(struct N*h,int v){struct N*n=malloc(sizeof *n);n->v=v;n->next=h;return n;}
struct N*rev(struct N*h){struct N*p=NULL;while(h){struct N*n=h->next;h->next=p;p=h;h=n;}return p;}
int main(void){struct N*h=NULL;for(int i=1;i<=6;i++)h=push(h,i*i);for(struct N*p=h;p;p=p->next)printf("%d ",p->v);printf("\n");h=rev(h);for(struct N*p=h;p;p=p->next)printf("%d ",p->v);printf("\n");while(h){struct N*n=h->next;free(h);h=n;}return 0;}
