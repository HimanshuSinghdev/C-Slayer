#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
void rev(char*s){int n=strlen(s);for(int i=0;i<n/2;i++){char t=s[i];s[i]=s[n-1-i];s[n-1-i]=t;}}
int main(void){char s[]="Hello, World!";rev(s);puts(s);char t[]="a";rev(t);puts(t);char e[]="";rev(e);puts(e);return 0;}
