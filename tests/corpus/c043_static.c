#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int cnt(void){static int c=0;return ++c;}
int main(void){for(int i=0;i<5;i++)printf("%d ",cnt());puts("");return 0;}
