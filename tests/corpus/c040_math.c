#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){printf("%.4f %.4f %.4f %.4f\n",sqrt(2.0),pow(2,0.5),sin(1.0),cos(1.0));printf("%.3f %.3f %.0f %.0f %.0f\n",log(10.0),exp(1.0),floor(-2.5),ceil(-2.5),round(2.5));printf("%d %d %.2f %.2f\n",abs(-5),(int)fabs(-3.7),fmod(7.5,2),hypot(3,4));return 0;}
