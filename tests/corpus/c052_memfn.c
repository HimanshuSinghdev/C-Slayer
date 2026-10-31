#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){int a[5]={1,2,3,4,5},b[5];memcpy(b,a,sizeof a);memmove(a+1,a,4*sizeof(int));for(int i=0;i<5;i++)printf("%d/%d ",a[i],b[i]);puts("");printf("%d\n",memcmp(a,b,sizeof a)!=0);char z[8];memset(z,'x',7);z[7]=0;puts(z);return 0;}
