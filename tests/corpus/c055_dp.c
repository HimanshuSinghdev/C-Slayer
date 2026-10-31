#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){int w[]={1,3,4,5},v[]={1,4,5,7},W=7,n=4;int dp[8]={0};for(int i=0;i<n;i++)for(int c=W;c>=w[i];c--)if(dp[c-w[i]]+v[i]>dp[c])dp[c]=dp[c-w[i]]+v[i];printf("%d\n",dp[W]);return 0;}
