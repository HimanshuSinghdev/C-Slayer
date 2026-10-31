#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int moves=0;void h(int n,char a,char b,char c){if(!n)return;h(n-1,a,c,b);moves++;if(n==3)printf("move disk %d %c->%c\n",n,a,c);h(n-1,b,a,c);}
int main(void){h(5,'A','B','C');printf("%d\n",moves);return 0;}
