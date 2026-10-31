#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
void rev(int*a,int n){int*i=a,*j=a+n-1;while(i<j){int t=*i;*i++=*j;*j--=t;}}
int main(void){int a[]={1,2,3,4,5,6};rev(a,6);for(int i=0;i<6;i++)printf("%d ",a[i]);puts("");return 0;}
