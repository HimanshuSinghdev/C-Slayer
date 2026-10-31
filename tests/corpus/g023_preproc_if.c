#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdarg.h>
#include <stddef.h>
#include <limits.h>
#include <float.h>
#define VER 3
#if VER>=3 && defined(VER)
#define MSG "new"
#elif VER==2
#define MSG "mid"
#else
#define MSG "old"
#endif
#undef VER
#ifndef VER
#define OK 1
#endif
int main(void){puts(MSG);printf("%d\n",OK);return 0;}
