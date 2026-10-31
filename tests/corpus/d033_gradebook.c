#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
int main(void){int m[]={91,78,66,55,42,100,0};for(int i=0;i<7;i++){char g=m[i]>=90?'A':m[i]>=75?'B':m[i]>=60?'C':m[i]>=50?'D':'F';printf("%3d %c\n",m[i],g);}return 0;}
