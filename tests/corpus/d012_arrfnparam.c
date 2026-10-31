#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
int sum(int a[],int n){int s=0;for(int i=0;i<n;i++)s+=a[i];return s;}
void fill(int(*m)[3],int r){for(int i=0;i<r;i++)for(int j=0;j<3;j++)m[i][j]=i+j;}
int main(void){int a[]={1,2,3,4};int m[2][3];fill(m,2);printf("%d %d %d\n",sum(a,4),m[1][2],sum(m[1],3));return 0;}
