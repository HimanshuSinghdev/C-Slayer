#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){int a[]={5,2,9,1,5,6,-3,0,12,7};int n=10;for(int i=0;i<n-1;i++)for(int j=0;j<n-1-i;j++)if(a[j]>a[j+1]){int t=a[j];a[j]=a[j+1];a[j+1]=t;}for(int i=0;i<n;i++)printf("%d ",a[i]);printf("\n");return 0;}
