#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){char e[]="23*54*+9-";int st[20],t=0;for(char*p=e;*p;p++){if(isdigit((unsigned char)*p))st[t++]=*p-'0';else{int b=st[--t],a=st[--t];switch(*p){case'+':st[t++]=a+b;break;case'-':st[t++]=a-b;break;case'*':st[t++]=a*b;break;case'/':st[t++]=a/b;break;}}}printf("%d\n",st[0]);return 0;}
