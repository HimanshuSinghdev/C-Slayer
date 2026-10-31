#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
void rv(char*a,char*b){for(b--;a<b;a++,b--){char t=*a;*a=*b;*b=t;}}
int main(void){char s[]="one two three four";rv(s,s+strlen(s));char*w=s;for(char*p=s;;p++){if(*p==' '||!*p){rv(w,p);w=p+1;if(!*p)break;}}puts(s);return 0;}
