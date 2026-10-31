#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){int a[]={64,25,12,22,11,90,-5};int n=7;for(int i=0;i<n-1;i++){int m=i;for(int j=i+1;j<n;j++)if(a[j]<a[m])m=j;int t=a[m];a[m]=a[i];a[i]=t;}for(int i=0;i<n;i++)printf("%d ",a[i]);puts("");return 0;}
