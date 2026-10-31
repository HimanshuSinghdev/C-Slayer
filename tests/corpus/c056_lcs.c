#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){const char*a="AGGTAB",*b="GXTXAYB";int n=strlen(a),m=strlen(b);int d[8][8]={0};for(int i=1;i<=n;i++)for(int j=1;j<=m;j++)d[i][j]=a[i-1]==b[j-1]?d[i-1][j-1]+1:(d[i-1][j]>d[i][j-1]?d[i-1][j]:d[i][j-1]);printf("%d\n",d[n][m]);return 0;}
