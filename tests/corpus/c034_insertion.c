#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){int a[]={9,8,7,1,2,3,5,4};int n=8;for(int i=1;i<n;i++){int k=a[i],j=i-1;while(j>=0&&a[j]>k){a[j+1]=a[j];j--;}a[j+1]=k;}for(int i=0;i<n;i++)printf("%d ",a[i]);puts("");return 0;}
