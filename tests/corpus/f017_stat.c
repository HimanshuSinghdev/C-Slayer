#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){int n;scanf("%d",&n);double a[50],s=0;for(int i=0;i<n;i++){scanf("%lf",&a[i]);s+=a[i];}double m=s/n,v=0;for(int i=0;i<n;i++)v+=(a[i]-m)*(a[i]-m);v/=n;for(int i=0;i<n-1;i++)for(int j=0;j<n-1-i;j++)if(a[j]>a[j+1]){double t=a[j];a[j]=a[j+1];a[j+1]=t;}double med=n%2?a[n/2]:(a[n/2-1]+a[n/2])/2;printf("mean %.3f var %.3f sd %.3f med %.3f\n",m,v,sqrt(v),med);return 0;}
