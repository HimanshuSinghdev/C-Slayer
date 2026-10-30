#include <stdio.h>
int n = 0; int next(void){ return ++n; }
int f(int a, int b, int c){ return a*100 + b*10 + c; }
void show(const char *s, int a, int b){ printf("%s %d %d\n", s, a, b); }
int main(void){
  int i = 5; printf("%d %d %d\n", i++, i++, i);
  int j = 1; printf("%d %d\n", j, j++);
  printf("%d %d %d\n", next(), next(), next());
  printf("%d\n", f(next(), next(), next()));
  int k = 0; show("x", k++, k++); show("y", ++k, k);
  int a[3] = {0}; int m = 0; a[m++] = m; printf("%d %d %d %d\n", a[0], a[1], a[2], m);
  printf("%d %d\n", (i = 10), i);
  double d = 1.5; int q = 2; printf("%.1f %d\n", d * q++, q);
  return 0; }
