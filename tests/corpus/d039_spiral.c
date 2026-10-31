#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
int main(void){int n=4,m[4][4],v=1,t=0,b=n-1,l=0,r=n-1;while(t<=b&&l<=r){for(int i=l;i<=r;i++)m[t][i]=v++;t++;for(int i=t;i<=b;i++)m[i][r]=v++;r--;for(int i=r;i>=l&&t<=b;i--)m[b][i]=v++;b--;for(int i=b;i>=t&&l<=r;i--)m[i][l]=v++;l++;}for(int i=0;i<n;i++){for(int j=0;j<n;j++)printf("%3d",m[i][j]);puts("");}return 0;}
