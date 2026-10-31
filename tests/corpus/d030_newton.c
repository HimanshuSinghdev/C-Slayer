#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
int main(void){double x=10,g=1;for(int i=0;i<20;i++)g=(g+x/g)/2;printf("%.10f %.10f\n",g,sqrt(x));return 0;}
