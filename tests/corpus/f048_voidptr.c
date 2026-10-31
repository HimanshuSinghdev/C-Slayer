#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
void*mc(void*d,const void*s,size_t n){char*dd=d;const char*ss=s;while(n--)*dd++=*ss++;return d;}
int main(void){double a[3]={1.5,2.5,3.5},b[3];mc(b,a,sizeof a);printf("%.1f %.1f %.1f\n",b[0],b[1],b[2]);return 0;}
