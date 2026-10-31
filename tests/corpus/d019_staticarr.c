#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
int tbl[5]={1,2,3};
static char buf[16];
int main(void){for(int i=0;i<5;i++)printf("%d",tbl[i]);printf(" %d %zu\n",buf[3],sizeof buf);strcpy(buf,"hello");printf("%s\n",buf);return 0;}
