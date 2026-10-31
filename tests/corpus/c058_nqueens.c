#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int n=6,c[6],cnt=0;int ok(int r,int k){for(int i=0;i<r;i++)if(c[i]==k||abs(c[i]-k)==r-i)return 0;return 1;}
void solve(int r){if(r==n){cnt++;return;}for(int k=0;k<n;k++)if(ok(r,k)){c[r]=k;solve(r+1);}}
int main(void){solve(0);printf("%d\n",cnt);return 0;}
