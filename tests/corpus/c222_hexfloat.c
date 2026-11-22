#include <stdio.h>
int main(void) {
    double v[] = {1.0, 0.5, 3.14, 255.5, 1.0/3, 0.0, -2.75, 1e300, 5e-324, 1e-310, 0.1, 15.9999};
    for (int i = 0; i < 12; i++) printf("%a|%A|%.0a|%.1a|%.3a|%12a|%-14a|%#.0a|%+a\n", v[i], v[i], v[i], v[i], v[i], v[i], v[i], v[i], v[i]);
    printf("%010a|% a\n", 2.5, 2.5);
    return 0;
}
