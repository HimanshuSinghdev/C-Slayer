#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
void sw(int*a,int*b){int t=*a;*a=*b;*b=t;}
int main(void){int x=3,y=9;sw(&x,&y);printf("%d %d\n",x,y);return 0;}
