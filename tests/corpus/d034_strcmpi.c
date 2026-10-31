#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
int ci(const char*a,const char*b){while(*a&&tolower((unsigned char)*a)==tolower((unsigned char)*b)){a++;b++;}return tolower((unsigned char)*a)-tolower((unsigned char)*b);}
int main(void){printf("%d %d %d\n",ci("Hello","hELLO")==0,ci("a","b")<0,ci("b","a")>0);return 0;}
