#include <stdio.h>
#include <limits.h>
int main(void){
  int a=17,b=5; unsigned u=4000000000u; long long big=1LL<<40; char c='A'; short s=-3;
  printf("%d %d %d %d\n", a+b, a-b, a*b, a/b);
  printf("%d %d %d\n", a%b, -a%b, a%-b);
  printf("%d %d\n", -17/5, 17/-5);
  printf("%u %u\n", u+500000000u, u*2u);
  printf("%lld %lld\n", big, big*3);
  printf("%d %c %d\n", c+1, c+1, c);
  printf("%d %d\n", s*s, (unsigned char)s);
  printf("%d %d %d %d\n", a&b, a|b, a^b, ~a);
  printf("%d %d\n", a<<3, a>>2);
  printf("%d %u\n", -16>>2, (unsigned)-16>>2);
  printf("%d %d\n", INT_MAX, INT_MIN);
  printf("%u\n", (unsigned)INT_MAX+1u);
  printf("%ld %lu\n", LONG_MAX, ULONG_MAX);
  printf("%d\n", (char)200);
  printf("%d\n", (unsigned char)300);
  printf("%d %d\n", 7/2*2, 7/2.0>3);
  printf("%d\n", 1+2*3-4/2);
  printf("%x %X %o %#x %#o\n", 255, 255, 8, 255, 8);
  printf("%d %d %d\n", !5, !0, !!7);
  printf("%d %d\n", 5>3 && 2>1, 5<3 || 2<1);
  long x = 123456789012L; printf("%ld %ld\n", x/1000, x%1000);
  unsigned long long h = 14695981039346656037ULL; for (int i=0;i<10;i++){ h ^= i; h *= 1099511628211ULL; } printf("%llu\n", h);
  printf("%d\n", (int)3.99); printf("%d\n", (int)-3.99);
  printf("%d\n", 10 == 10.0);
  return 0; }
