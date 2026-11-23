#include <stdio.h>
#include <setjmp.h>

static jmp_buf env;
static int depth_reached;

static void descend(int n) {
    int local[4] = {n, n, n, n};
    depth_reached = n;
    if (n == 5) {
        printf("deep enough, jumping out (local sum %d)\n", local[0] + local[3]);
        longjmp(env, 42);
    }
    descend(n + 1);
    printf("never printed\n");
}

static int safe_div(int a, int b, int *out) {
    jmp_buf local;
    int r = setjmp(local);
    if (r == 0) {
        if (b == 0) longjmp(local, 7);
        *out = a / b;
        return 0;
    }
    return r;
}

int main(void) {
    int r = setjmp(env);
    if (r == 0) {
        printf("first pass\n");
        descend(0);
    } else {
        printf("recovered with %d after depth %d\n", r, depth_reached);
    }
    int q = 0;
    int rc = safe_div(10, 2, &q);
    printf("div ok -> %d, q=%d\n", rc, q);
    printf("div by zero -> %d\n", safe_div(1, 0, &q));
    int tries = 0;
    jmp_buf retry;
    volatile int attempts = 0;
    if (setjmp(retry) < 3) { attempts++; tries++; printf("attempt %d\n", attempts); longjmp(retry, attempts); }
    printf("gave up after %d attempts\n", attempts);
    return 0;
}
