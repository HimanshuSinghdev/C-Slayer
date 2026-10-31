#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
int main(void){srand(42);int a=rand(),b=rand();srand(42);printf("%d\n",a==rand()&&b==rand());srand(1);for(int i=0;i<5;i++)printf("%d ",rand()%100);puts("");return 0;}
