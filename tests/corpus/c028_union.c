#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
union U{int i;float f;unsigned char b[4];};
int main(void){union U u;u.i=0x41424344;printf("%c%c%c%c\n",u.b[0],u.b[1],u.b[2],u.b[3]);u.f=1.0f;printf("%08x %zu\n",u.i,sizeof u);return 0;}
