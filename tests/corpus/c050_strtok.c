#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){char s[]="a,b;;c d,,e";for(char*t=strtok(s,",; ");t;t=strtok(NULL,",; "))printf("[%s]",t);puts("");return 0;}
