#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
void show(const void*p,size_t n){const unsigned char*b=p;for(size_t i=0;i<n;i++)printf("%02x",b[i]);puts("");}
int main(void){int x=0x01020304;show(&x,sizeof x);double d=1.0;show(&d,sizeof d);return 0;}
