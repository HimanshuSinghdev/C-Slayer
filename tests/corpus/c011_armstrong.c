#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){for(int n=100;n<1000;n++){int s=0,m=n;while(m){int d=m%10;s+=d*d*d;m/=10;}if(s==n)printf("%d ",n);}printf("\n");return 0;}
