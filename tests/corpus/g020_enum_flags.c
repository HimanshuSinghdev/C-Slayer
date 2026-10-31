#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdarg.h>
#include <stddef.h>
#include <limits.h>
#include <float.h>
enum{R=1,W=2,X=4};
void show(int m){printf("%c%c%c\n",m&R?'r':'-',m&W?'w':'-',m&X?'x':'-');}
int main(void){show(R|W);show(7);show(0);int m=R|X;m&=~R;show(m);return 0;}
