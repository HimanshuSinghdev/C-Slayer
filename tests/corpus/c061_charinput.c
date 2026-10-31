#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){char s[]="Mix3d Case 99!";for(char*p=s;*p;p++){putchar(isupper((unsigned char)*p)?tolower((unsigned char)*p):toupper((unsigned char)*p));}puts("");int d=0,a=0,o=0;for(char*p=s;*p;p++){if(isdigit((unsigned char)*p))d++;else if(isalpha((unsigned char)*p))a++;else o++;}printf("%d %d %d\n",d,a,o);return 0;}
