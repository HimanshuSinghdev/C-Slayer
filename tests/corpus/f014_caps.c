#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){char s[200];while(fgets(s,sizeof s,stdin)){int nl=1;for(char*p=s;*p;p++){if(nl&&isalpha((unsigned char)*p)){*p=toupper((unsigned char)*p);nl=0;}else if(*p=='.'||*p=='!'||*p=='?')nl=1;}fputs(s,stdout);}return 0;}
