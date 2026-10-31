#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){int r,c;scanf("%d %d",&r,&c);int m[5][5];for(int i=0;i<r;i++)for(int j=0;j<c;j++)scanf("%d",&m[i][j]);int s=0;for(int i=0;i<r;i++){int rs=0;for(int j=0;j<c;j++)rs+=m[i][j];printf("row %d: %d\n",i,rs);s+=rs;}printf("total %d\n",s);return 0;}
