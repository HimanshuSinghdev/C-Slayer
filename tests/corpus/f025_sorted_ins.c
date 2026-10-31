#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){int a[20],n=0,x;while(scanf("%d",&x)==1&&n<20){int i=n-1;while(i>=0&&a[i]>x){a[i+1]=a[i];i--;}a[i+1]=x;n++;for(int j=0;j<n;j++)printf("%d ",a[j]);puts("");}return 0;}
