#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){int i=0;loop:if(i>=5)goto done;printf("%d ",i++);goto loop;done:puts("end");return 0;}
