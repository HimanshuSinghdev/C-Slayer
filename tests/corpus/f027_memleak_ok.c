#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){for(int i=0;i<1000;i++){char*p=malloc(1000);memset(p,i,1000);free(p);}puts("done");return 0;}
