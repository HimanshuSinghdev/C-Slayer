#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){int c,up=0,lo=0,ot=0;while((c=getchar())!=EOF){if(isupper(c))up++;else if(islower(c))lo++;else ot++;}printf("%d %d %d\n",up,lo,ot);return 0;}
