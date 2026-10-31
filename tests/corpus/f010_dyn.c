#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){int n;scanf("%d",&n);int*a=malloc(n*sizeof*a);for(int i=0;i<n;i++)scanf("%d",a+i);int mx=a[0],mn=a[0];for(int i=1;i<n;i++){if(a[i]>mx)mx=a[i];if(a[i]<mn)mn=a[i];}printf("%d %d\n",mn,mx);free(a);return 0;}
