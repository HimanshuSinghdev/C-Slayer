#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){for(int c=32;c<127;c+=1){printf("%c",c);if((c-31)%32==0)puts("");}puts("");return 0;}
