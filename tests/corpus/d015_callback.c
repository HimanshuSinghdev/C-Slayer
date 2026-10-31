#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
void each(int*a,int n,void(*f)(int)){for(int i=0;i<n;i++)f(a[i]);}
void pr(int x){printf("<%d>",x);}
int tot;void ac(int x){tot+=x;}
int main(void){int a[]={4,5,6};each(a,3,pr);each(a,3,ac);printf(" %d\n",tot);return 0;}
