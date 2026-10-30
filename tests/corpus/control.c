#include <stdio.h>
int main(void){
  int i, j, n = 0;
  for (i=0;i<5;i++){ if (i==2) continue; if (i==4) break; printf("i=%d ", i); } printf("\n");
  for (i=1;i<=3;i++){ for (j=1;j<=3;j++) printf("%d ", i*j); printf("\n"); }
  i = 10; while (i > 0){ i -= 3; n++; } printf("%d %d\n", i, n);
  do { n--; } while (n > 0); printf("%d\n", n);
  for (i=0;i<6;i++){ switch(i){ case 0: printf("zero "); case 1: printf("one "); break; case 2: case 3: printf("twothree "); break; default: printf("other "); } } printf("\n");
  i = 0; loop: if (i<3){ printf("g%d ", i); i++; goto loop; } printf("\n");
  int x = 7; printf("%s\n", x%2 ? "odd" : "even");
  int k = (1, 2, 3); printf("%d\n", k);
  int cnt = 0; if (cnt++ || cnt++) cnt += 10; printf("%d\n", cnt);
  int a=0,b=0; (a=1) && (b=2); printf("%d %d\n", a, b);
  for (int p=2;p<40;p++){ int ok=1; for (int d=2;d*d<=p;d++) if (p%d==0){ok=0;break;} if (ok) printf("%d ", p); } printf("\n");
  char c; for (c='a'; c<='e'; c++) putchar(c); putchar('\n');
  int tot=0; for (i=0;i<1000;i++) tot += i%7==0 ? i : 0; printf("%d\n", tot);
  switch (3) { case 1: puts("no"); break; default: puts("default"); }
  for (;;) { if (++n > 5) break; } printf("%d\n", n);
  return 0; }
