#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
void qs(int*a,int l,int r){if(l>=r)return;int p=a[(l+r)/2],i=l,j=r;while(i<=j){while(a[i]<p)i++;while(a[j]>p)j--;if(i<=j){int t=a[i];a[i]=a[j];a[j]=t;i++;j--;}}qs(a,l,j);qs(a,i,r);}
int main(void){int a[]={38,27,43,3,9,82,10,3,-1};qs(a,0,8);for(int i=0;i<9;i++)printf("%d ",a[i]);puts("");return 0;}
