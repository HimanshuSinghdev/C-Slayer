#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
void cat(char*d,const char*s){while(*d)d++;while((*d++=*s++));}
int main(void){char a[50]="Good ";cat(a,"morning");cat(a,", all");puts(a);printf("%zu\n",strlen(a));return 0;}
