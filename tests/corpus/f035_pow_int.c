#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
long ip(long b,int e){long r=1;while(e>0){if(e&1)r*=b;b*=b;e>>=1;}return r;}
int main(void){printf("%ld %ld %ld\n",ip(2,10),ip(3,13),ip(7,0));printf("%.0f %.0f\n",pow(2,40),pow(10,15));return 0;}
