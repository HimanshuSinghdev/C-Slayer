#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
int main(void){int8_t a=127;a++;uint8_t b=0;b--;int64_t c=INT64_MAX;uint32_t d=0xFFFFFFFFu;printf("%d %u %lld %u\n",a,b,(long long)c,d+1);printf("%zu %zu\n",sizeof(int64_t),sizeof(uint16_t));return 0;}
