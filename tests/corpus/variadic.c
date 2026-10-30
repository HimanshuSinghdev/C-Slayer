#include <stdio.h>
#include <stdarg.h>
#include <string.h>
int sum(int n, ...) { va_list ap; va_start(ap, n); int s = 0; for (int i = 0; i < n; i++) s += va_arg(ap, int); va_end(ap); return s; }
double avg(int n, ...) { va_list ap; va_start(ap, n); double t = 0; for (int i = 0; i < n; i++) t += va_arg(ap, double); va_end(ap); return n ? t / n : 0; }
void logf2(const char *tag, const char *fmt, ...) { va_list ap; va_start(ap, fmt); printf("[%s] ", tag); vprintf(fmt, ap); va_end(ap); printf("\n"); }
int maxof(int first, ...) { va_list ap; va_start(ap, first); int m = first, v; while ((v = va_arg(ap, int)) >= 0) if (v > m) m = v; va_end(ap); return m; }
long lsum(int n, ...) { va_list ap; va_start(ap, n); long s = 0; while (n--) s += va_arg(ap, long); va_end(ap); return s; }
void join(char *out, int n, ...) { va_list ap; va_start(ap, n); out[0] = 0; for (int i = 0; i < n; i++) { if (i) strcat(out, ","); strcat(out, va_arg(ap, char *)); } va_end(ap); }
int myfmt(char *buf, size_t sz, const char *fmt, ...) { va_list ap; va_start(ap, fmt); int r = vsnprintf(buf, sz, fmt, ap); va_end(ap); return r; }
int twice(int n, ...) { va_list a, b; va_start(a, n); va_copy(b, a); int s = 0; for (int i = 0; i < n; i++) s += va_arg(a, int); for (int i = 0; i < n; i++) s += va_arg(b, int); va_end(a); va_end(b); return s; }
int main(void) {
  printf("%d %d %d\n", sum(0), sum(3, 1, 2, 3), sum(5, 10, 20, 30, 40, 50));
  printf("%.2f %.2f\n", avg(3, 1.5, 2.5, 4.0), avg(2, 1.0f, 2.0f));
  logf2("INFO", "x=%d y=%s z=%.1f c=%c l=%ld", 42, "hello", 3.14, 'q', 1234567890123L);
  printf("%d\n", maxof(3, 9, 4, 12, 7, -1));
  printf("%ld\n", lsum(3, 1L << 40, 2L, 3L));
  char b[64]; join(b, 3, "a", "bb", "ccc"); printf("%s\n", b);
  char f[40]; int r = myfmt(f, sizeof f, "%05d|%-4s|%x", 42, "ab", 255); printf("%s %d\n", f, r);
  printf("%d\n", twice(3, 1, 2, 3));
  return 0; }
