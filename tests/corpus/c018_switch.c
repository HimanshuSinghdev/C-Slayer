#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
const char*day(int d){switch(d){case 1:return"Mon";case 2:return"Tue";case 3:return"Wed";case 4:case 5:return"Thu/Fri";default:return"?";}}
int main(void){for(int i=0;i<7;i++)printf("%d:%s\n",i,day(i));return 0;}
