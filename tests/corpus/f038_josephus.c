#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){int n=7,k=3;int a[7];for(int i=0;i<n;i++)a[i]=i+1;int idx=0,left=n;while(left){idx=(idx+k-1)%left;printf("%d ",a[idx]);for(int j=idx;j<left-1;j++)a[j]=a[j+1];left--;}puts("");return 0;}
