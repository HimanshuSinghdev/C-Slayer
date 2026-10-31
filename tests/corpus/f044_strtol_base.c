#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){printf("%ld %ld %ld %ld\n",strtol("ff",0,16),strtol("0777",0,0),strtol("1010",0,2),strtol("zz",0,36));return 0;}
