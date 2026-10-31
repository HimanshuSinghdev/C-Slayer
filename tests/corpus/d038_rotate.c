#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
void rot(int*a,int n,int k){k%=n;int t[16];for(int i=0;i<n;i++)t[(i+k)%n]=a[i];memcpy(a,t,n*sizeof*a);}
int main(void){int a[]={1,2,3,4,5,6,7};rot(a,7,3);for(int i=0;i<7;i++)printf("%d ",a[i]);puts("");return 0;}
