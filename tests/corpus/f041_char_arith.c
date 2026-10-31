#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){char s[]="abcxyz";for(int i=0;s[i];i++)s[i]=(s[i]-'a'+13)%26+'a';puts(s);int sum=0;for(char c='0';c<='9';c++)sum+=c-'0';printf("%d\n",sum);return 0;}
