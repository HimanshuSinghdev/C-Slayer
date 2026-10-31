#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){int n=3;int*a=calloc(n,sizeof*a);for(int i=0;i<n;i++)a[i]=i+1;a=realloc(a,8*sizeof*a);for(int i=n;i<8;i++)a[i]=(i+1)*10;for(int i=0;i<8;i++)printf("%d ",a[i]);puts("");free(a);return 0;}
