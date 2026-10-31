#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdarg.h>
#include <stddef.h>
#include <limits.h>
#include <float.h>
struct S{char a;int b;double c;char d;};
int main(void){printf("%zu %zu %zu %zu %zu\n",offsetof(struct S,a),offsetof(struct S,b),offsetof(struct S,c),offsetof(struct S,d),sizeof(struct S));return 0;}
