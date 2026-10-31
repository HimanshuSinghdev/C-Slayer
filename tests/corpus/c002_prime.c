#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int isp(int n){if(n<2)return 0;for(int i=2;i*i<=n;i++)if(n%i==0)return 0;return 1;}
int main(void){int c=0;for(int i=0;i<200;i++)if(isp(i)){printf("%d ",i);c++;}printf("\ncount=%d\n",c);return 0;}
