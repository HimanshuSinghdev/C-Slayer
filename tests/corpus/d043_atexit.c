#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
void bye(void){puts("bye");}
int main(void){atexit(bye);puts("main");return 0;}
