#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){int r=4,c=6;int**m=malloc(r*sizeof*m);for(int i=0;i<r;i++){m[i]=calloc(c,sizeof**m);for(int j=0;j<c;j++)m[i][j]=(i+1)*(j+1);}for(int i=0;i<r;i++){for(int j=0;j<c;j++)printf("%3d",m[i][j]);puts("");}for(int i=0;i<r;i++)free(m[i]);free(m);return 0;}
