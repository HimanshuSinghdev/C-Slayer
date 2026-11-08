#include <stdio.h>

int strlen(char *);

static void count(void) {
    unsigned long left = 2;
    do {
        if (1) printf("left=%ld\n", left);
        else { while (1) printf("never\n"); }
        left--;
    } while (left);
}

int main(void) {
    count();
    char *p = "hello";
    printf("%d\n", strlen(p) - 5);
    if (0) { printf("dead\n"); } else printf("live\n");
    return 0;
}
