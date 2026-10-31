#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
int main(void){for(int i=1;i<=30;i++){if(i%15==0)puts("FizzBuzz");else if(i%3==0)puts("Fizz");else if(i%5==0)puts("Buzz");else printf("%d\n",i);}return 0;}
