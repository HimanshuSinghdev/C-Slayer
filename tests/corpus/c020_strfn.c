#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){char a[40]="Hello",b[]=" World";strcat(a,b);printf("%s %zu\n",a,strlen(a));printf("%d %d\n",strcmp("abc","abd")<0,strncmp("abcdef","abcxyz",3));char*p=strstr(a,"World");printf("%s\n",p?p:"(null)");char c[10];strncpy(c,"truncate me",9);c[9]=0;puts(c);return 0;}
