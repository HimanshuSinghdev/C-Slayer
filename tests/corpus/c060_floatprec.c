#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){float f=0.1f;double d=0.1;printf("%.10f %.10f %d\n",f,d,f==d);printf("%g %g %g %g\n",100000.0,1000000.0,1e-5,0.0001);printf("%.3g %10.4e|%-10.2f|\n",1234.5678,1234.5678,3.14159);return 0;}
