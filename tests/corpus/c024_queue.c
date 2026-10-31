#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
struct Q{int a[5];int h,t,n;};
int enq(struct Q*q,int v){if(q->n==5)return 0;q->a[q->t]=v;q->t=(q->t+1)%5;q->n++;return 1;}
int deq(struct Q*q,int*v){if(!q->n)return 0;*v=q->a[q->h];q->h=(q->h+1)%5;q->n--;return 1;}
int main(void){struct Q q={{0},0,0,0};for(int i=0;i<7;i++)printf("%d ",enq(&q,i));int v;deq(&q,&v);deq(&q,&v);enq(&q,99);while(deq(&q,&v))printf("[%d]",v);printf("\n");return 0;}
