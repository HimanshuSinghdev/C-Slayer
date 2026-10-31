#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdarg.h>
#include <stddef.h>
#include <limits.h>
#include <float.h>
int main(void){printf("[%5d][%-5d][%05d][%+5d][% d]\n",42,42,42,42,42);printf("[%8.3f][%-8.1f][%08.2f][%.0f]\n",3.14159,2.5,-1.5,0.5);printf("[%10s][%-10s][%.3s]\n","abc","abc","abcdef");printf("[%c][%5c][%-3c]\n",'x','y','z');printf("[%x][%#X][%#o][%lu]\n",255,255,8,123456789012UL);return 0;}
