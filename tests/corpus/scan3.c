#include <stdio.h>
int main(void){ int c, w=0, l=0, ch=0, inw=0; while ((c = getchar()) != EOF) { ch++; if (c=='\n') l++; if (c==' '||c=='\n'||c=='\t') inw=0; else if (!inw){ inw=1; w++; } } printf("%d %d %d\n", l, w, ch); return 0; }
