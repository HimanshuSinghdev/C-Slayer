#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){const char*s="  the quick  brown\tfox\njumps ";int w=0,in=0;for(const char*p=s;*p;p++){if(isspace((unsigned char)*p))in=0;else if(!in){in=1;w++;}}printf("%d\n",w);return 0;}
