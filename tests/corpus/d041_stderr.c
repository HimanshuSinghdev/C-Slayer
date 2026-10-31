#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
int main(void){fprintf(stderr,"err line\n");fputs("out line\n",stdout);fprintf(stdout,"%d\n",5);return 3;}
