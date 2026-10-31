#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
struct S{char c;int i;char d;};
int main(void){struct S s;int a[10];printf("%zu %zu %zu %zu\n",sizeof s,sizeof a,sizeof a/sizeof a[0],sizeof(struct S*));printf("%zu %zu\n",sizeof(long double),sizeof(void*));return 0;}
