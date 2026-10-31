#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){int t[10][10]={0};for(int i=0;i<10;i++){t[i][0]=1;for(int j=1;j<=i;j++)t[i][j]=t[i-1][j-1]+(j<i?t[i-1][j]:0);}for(int i=0;i<10;i++){printf("%*s",(10-i)*2,"");for(int j=0;j<=i;j++)printf("%4d",t[i][j]);printf("\n");}return 0;}
