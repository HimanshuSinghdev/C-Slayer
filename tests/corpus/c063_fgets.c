#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){char l[100];int ln=0;while(fgets(l,sizeof l,stdin)){ln++;size_t n=strlen(l);if(n&&l[n-1]=='\n')l[--n]=0;printf("%d:%zu:[%s]\n",ln,n,l);}return 0;}
