#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
void f(void){puts("in f");exit(7);}
int main(void){puts("start");f();puts("never");return 0;}
