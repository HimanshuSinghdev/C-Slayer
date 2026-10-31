#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){int m[4][5];int s=0;for(int i=0;i<4;i++)for(int j=0;j<5;j++){m[i][j]=i*5+j;s+=m[i][j];}printf("%d\n",s);int rs[4]={0};for(int i=0;i<4;i++)for(int j=0;j<5;j++)rs[i]+=m[i][j];for(int i=0;i<4;i++)printf("%d ",rs[i]);printf("\n");return 0;}
