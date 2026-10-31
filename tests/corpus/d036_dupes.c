#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
int main(void){int a[]={4,2,4,7,2,9,4,1};int n=8;for(int i=0;i<n;i++){int seen=0;for(int j=0;j<i;j++)if(a[j]==a[i]){seen=1;break;}if(seen)continue;int c=1;for(int j=i+1;j<n;j++)if(a[j]==a[i])c++;printf("%d:%d ",a[i],c);}puts("");return 0;}
