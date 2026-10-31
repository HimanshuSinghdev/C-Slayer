#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){char s[100];fgets(s,100,stdin);char st[100];int t=0,ok=1;for(char*p=s;*p&&ok;p++){if(strchr("([{",*p))st[t++]=*p;else if(strchr(")]}",*p)){if(!t){ok=0;break;}char o=st[--t];if((*p==')'&&o!='(')||(*p==']'&&o!='[')||(*p=='}'&&o!='{'))ok=0;}}puts(ok&&!t?"balanced":"unbalanced");return 0;}
