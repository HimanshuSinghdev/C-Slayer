#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
int main(void){char b[3][3]={{'X','O','X'},{'O','X','O'},{'O','X','X'}};int w=0;for(int i=0;i<3;i++){if(b[i][0]==b[i][1]&&b[i][1]==b[i][2])w=b[i][0];if(b[0][i]==b[1][i]&&b[1][i]==b[2][i])w=b[0][i];}if(b[0][0]==b[1][1]&&b[1][1]==b[2][2])w=b[0][0];printf("%c\n",w?w:'-');return 0;}
