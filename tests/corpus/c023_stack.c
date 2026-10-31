#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#define MAX 8
int st[MAX],top=-1;
int push(int v){if(top==MAX-1)return 0;st[++top]=v;return 1;}
int pop(int*v){if(top<0)return 0;*v=st[top--];return 1;}
int main(void){for(int i=1;i<=10;i++)if(!push(i*3))printf("full at %d\n",i);int v;while(pop(&v))printf("%d ",v);printf("\n");return 0;}
