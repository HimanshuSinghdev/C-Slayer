#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){char s[100];fgets(s,sizeof s,stdin);int up=0,lo=0,di=0,sp=0,ot=0;for(int i=0;s[i];i++){unsigned char c=s[i];if(isupper(c))up++;else if(islower(c))lo++;else if(isdigit(c))di++;else if(isspace(c))sp++;else ot++;}printf("%d %d %d %d %d\n",up,lo,di,sp,ot);return 0;}
