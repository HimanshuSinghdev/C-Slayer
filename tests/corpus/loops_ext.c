#include <stdio.h>

int main(void) {
    int n = 1000000000;
    long long s = 0;
    int i = 1;
    while (i <= n) { s += i; i++; }
    printf("while sum %lld i=%d\n", s, i);

    long long t = 0; int j;
    for (j = 5; j < 2000000000; j++) t += 3;
    printf("ext for %lld j=%d\n", t, j);

    int k = 10; long long u = 0;
    while (k < 5) { u += k; k++; }
    printf("never %lld k=%d\n", u, k);

    int m = 0; long long v = 0;
    for (; m <= 100000; ++m) v += m;
    printf("noinit %lld m=%d\n", v, m);

    int c = 0, q = 7;
    while (q < 1000000) { c++; q += 1; }
    printf("count %d q=%d\n", c, q);

    int w = 3; int z = 0;
    while (w < 8) { z += w; w++; }
    printf("small %d %d\n", z, w);

    int a2 = 2, b2 = 0;
    for (a2 = 4; a2 <= 12; a2++) b2 += a2;
    printf("init-expr %d %d\n", b2, a2);
    return 0;
}
