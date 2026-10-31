#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
struct T{int k;struct T*l,*r;};
struct T*ins(struct T*t,int k){if(!t){t=calloc(1,sizeof*t);t->k=k;return t;}if(k<t->k)t->l=ins(t->l,k);else t->r=ins(t->r,k);return t;}
void in(struct T*t){if(!t)return;in(t->l);printf("%d ",t->k);in(t->r);}
int h(struct T*t){if(!t)return 0;int a=h(t->l),b=h(t->r);return 1+(a>b?a:b);}
void fr(struct T*t){if(!t)return;fr(t->l);fr(t->r);free(t);}
int main(void){struct T*r=NULL;int k[]={50,30,70,20,40,60,80,35,45};for(int i=0;i<9;i++)r=ins(r,k[i]);in(r);printf("\nheight %d\n",h(r));fr(r);return 0;}
