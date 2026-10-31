#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){char s[40];while(scanf("%39s",s)==1){long v=0;int ok=1;for(char*p=s;*p;p++){if(*p!='0'&&*p!='1'){ok=0;break;}v=v*2+(*p-'0');}if(ok)printf("%s = %ld\n",s,v);else printf("%s invalid\n",s);}return 0;}
