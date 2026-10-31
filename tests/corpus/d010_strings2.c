#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
int main(void){char a[]="abc";char*b="abc";printf("%zu %zu %zu\n",sizeof a,sizeof b,strlen(a));char m[3][6]={"hi","there","you"};for(int i=0;i<3;i++)printf("%s,",m[i]);puts("");printf("%c%c\n","xyz"[1],*(b+2));return 0;}
