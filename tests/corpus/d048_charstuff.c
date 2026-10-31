#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
int main(void){char c='a';c+=2;printf("%c %d %c\n",c,c,c-32);for(char x='a';x<='e';x++)putchar(x);puts("");printf("%d\n",'9'-'0');return 0;}
