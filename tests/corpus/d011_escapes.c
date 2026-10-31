#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
int main(void){printf("tab[\t] nl[\\n] q[\"] sq[\'] bs[\\] oct[\101] hex[\x41] nul-%d\n",(int)strlen("a\0b"));printf("%%d %5.1f%%\n",99.5);return 0;}
