#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){const char*t[]={"42","-17","  8x","abc","2147483647","0x1F","3.99"};for(int i=0;i<7;i++){char*e;long v=strtol(t[i],&e,0);printf("%s -> %ld rest=\"%s\" atoi=%d atof=%.2f\n",t[i],v,e,atoi(t[i]),atof(t[i]));}return 0;}
