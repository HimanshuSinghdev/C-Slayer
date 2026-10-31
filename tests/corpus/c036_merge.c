#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
void ms(int*a,int*t,int l,int r){if(r-l<2)return;int m=(l+r)/2;ms(a,t,l,m);ms(a,t,m,r);int i=l,j=m,k=l;while(i<m&&j<r)t[k++]=a[i]<=a[j]?a[i++]:a[j++];while(i<m)t[k++]=a[i++];while(j<r)t[k++]=a[j++];for(k=l;k<r;k++)a[k]=t[k];}
int main(void){int a[]={5,1,4,2,8,0,3,7,6,9},t[10];ms(a,t,0,10);for(int i=0;i<10;i++)printf("%d ",a[i]);puts("");return 0;}
