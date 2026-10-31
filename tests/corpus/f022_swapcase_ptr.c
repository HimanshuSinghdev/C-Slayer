#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
void f(char*s){while(*s){*s=islower((unsigned char)*s)?toupper((unsigned char)*s):tolower((unsigned char)*s);s++;}}
int main(void){char b[50];scanf("%49[^\n]",b);f(b);puts(b);return 0;}
