#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){char n[5][20];int c;scanf("%d",&c);for(int i=0;i<c;i++)scanf("%19s",n[i]);for(int i=0;i<c-1;i++)for(int j=0;j<c-1-i;j++)if(strcmp(n[j],n[j+1])>0){char t[20];strcpy(t,n[j]);strcpy(n[j],n[j+1]);strcpy(n[j+1],t);}for(int i=0;i<c;i++)puts(n[i]);return 0;}
