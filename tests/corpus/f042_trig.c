#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){for(int d=0;d<=90;d+=30){double r=d*3.14159265358979/180;printf("%2d %.4f %.4f %.4f\n",d,sin(r),cos(r),d==90?0.0:tan(r));}printf("%.4f %.4f\n",atan2(1,1)*4,acos(-1.0));return 0;}
