#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
int cmp(const void*a,const void*b){return strcmp(*(const char**)a,*(const char**)b);}
int main(void){const char*w[]={"pear","apple","fig","banana","cherry"};qsort(w,5,sizeof w[0],cmp);for(int i=0;i<5;i++)printf("%s ",w[i]);puts("");const char*k="fig";const char**r=bsearch(&k,w,5,sizeof w[0],cmp);printf("%d\n",r?(int)(r-w):-1);return 0;}
