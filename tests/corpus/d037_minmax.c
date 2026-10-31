#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
int main(void){int a[]={3,-8,12,0,7,-2};int mn=a[0],mx=a[0];for(int i=1;i<6;i++){if(a[i]<mn)mn=a[i];if(a[i]>mx)mx=a[i];}printf("%d %d\n",mn,mx);double s=0;for(int i=0;i<6;i++)s+=a[i];printf("%.3f\n",s/6);return 0;}
