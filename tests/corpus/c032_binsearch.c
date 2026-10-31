#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int bs(const int*a,int n,int k){int lo=0,hi=n-1;while(lo<=hi){int m=lo+(hi-lo)/2;if(a[m]==k)return m;if(a[m]<k)lo=m+1;else hi=m-1;}return -1;}
int main(void){int a[]={1,3,5,7,9,11,13,15};for(int k=0;k<17;k+=4)printf("%d->%d\n",k,bs(a,8,k));return 0;}
