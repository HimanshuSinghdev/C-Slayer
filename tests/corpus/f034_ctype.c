#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){const char*s="aZ5 _\t";for(const char*p=s;*p;p++)printf("%d%d%d%d%d ",!!isalpha(*p),!!isdigit(*p),!!isalnum(*p),!!isspace(*p),!!ispunct(*p));puts("");printf("%c%c\n",toupper('q'),tolower('Q'));return 0;}
