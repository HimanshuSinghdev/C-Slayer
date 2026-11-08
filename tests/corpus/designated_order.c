#include <stdio.h>
struct P { int x, y; };
int ga[5] = {[3] = 7, [1] = 2};
int gb[3] = {[2] = 2, [0] = 0, [1] = 1};
struct P gp[2] = {[1] = {3, 4}, [0] = {1, 2}};
struct P gq = {.y = 9, .x = 8};
int main(void) {
    int la[5] = {[3] = 7, [1] = 2};
    int lb[3] = {[2] = 2, [0] = 0, [1] = 1};
    struct P lp[2] = {[1] = {3, 4}, [0] = {1, 2}};
    struct P lq = {.y = 9, .x = 8};
    for (int i = 0; i < 5; i++) printf("%d%d ", ga[i], la[i]);
    for (int i = 0; i < 3; i++) printf("%d%d ", gb[i], lb[i]);
    printf("| %d%d %d%d %d%d %d%d | %d%d %d%d\n", gp[0].x, lp[0].x, gp[0].y, lp[0].y, gp[1].x, lp[1].x, gp[1].y, lp[1].y, gq.x, lq.x, gq.y, lq.y);
    return 0;
}
