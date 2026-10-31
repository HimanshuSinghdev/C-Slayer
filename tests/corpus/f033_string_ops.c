#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){char s[]="hello world";char*p=strchr(s,'o');char*q=strrchr(s,'o');printf("%ld %ld\n",(long)(p-s),(long)(q-s));printf("%zu %zu\n",strspn(s,"hel"),strcspn(s," "));char*t=strdup(s);t[0]='J';puts(t);free(t);return 0;}
