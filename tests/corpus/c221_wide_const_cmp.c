#include <stdio.h>
static unsigned shr_u(unsigned a, unsigned b) { return a >> (b & 31); }
int main(void) {
    int a = 1;
    unsigned x = shr_u(0xFFFF80FFu, (a <= 1492774192309189LL));
    long long big = 5000000000LL;
    int small = 7;
    printf("%u %d %d %d\n", x, small < big, small > 4294967296LL, (int)(big > small));
    return 0;
}
