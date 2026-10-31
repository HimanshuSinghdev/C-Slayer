#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
int main(void){double s=0;for(int i=1;i<=20;i++)s+=1.0/i;printf("%.6f\n",s);double pi=0;for(int i=0;i<1000;i++)pi+=(i%2?-4.0:4.0)/(2*i+1);printf("%.6f\n",pi);double e=1,t=1;for(int i=1;i<15;i++){t/=i;e+=t;}printf("%.9f\n",e);return 0;}
