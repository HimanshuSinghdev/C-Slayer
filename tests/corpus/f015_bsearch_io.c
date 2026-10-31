#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){int a[]={2,4,6,8,10,12,14,16},n=8,k;while(scanf("%d",&k)==1){int lo=0,hi=n-1,f=-1;while(lo<=hi){int m=(lo+hi)/2;if(a[m]==k){f=m;break;}if(a[m]<k)lo=m+1;else hi=m-1;}if(f>=0)printf("%d at %d\n",k,f);else printf("%d not found\n",k);}return 0;}
