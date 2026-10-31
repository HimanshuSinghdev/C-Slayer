#include <stdio.h>
#include <string.h>
struct Date { unsigned day:5, month:4; unsigned year:12; };
struct Flags { unsigned char a:1, b:1, c:2; unsigned char d:4; };
struct Mixed { char c; int x:10; int y:6; short s; unsigned z:3; };
struct Wide { long big:40; unsigned long ub:20; int pad:3; };
struct Z { int a:3; int :0; int b:3; };
union U { unsigned raw; struct { unsigned lo:8, mid:8, hi:16; } p; };
struct Date g = {17, 11, 2024};
struct Flags gf = {1, 0, 3, 9};
int main(void) {
  struct Date d = {31, 12, 1999};
  printf("%u/%u/%u size=%zu\n", d.day, d.month, d.year, sizeof d);
  d.day++; d.month += 5; d.year -= 2000;
  printf("%u/%u/%u\n", d.day, d.month, d.year);
  printf("%u/%u/%u\n", g.day, g.month, g.year);
  printf("%d %d %d %d size=%zu\n", gf.a, gf.b, gf.c, gf.d, sizeof gf);
  struct Mixed m = {'x', -5, 20, 7, 5};
  printf("%c %d %d %d %u size=%zu\n", m.c, m.x, m.y, m.s, m.z, sizeof m);
  m.x = 600; m.y = -40; m.z = 12;
  printf("%d %d %u\n", m.x, m.y, m.z);
  struct Wide w; memset(&w, 0, sizeof w);
  w.big = -123456789012L; w.ub = 1048575; w.pad = 3;
  printf("%ld %lu %d size=%zu\n", w.big, w.ub, w.pad, sizeof w);
  w.ub += 2; w.big *= 2;
  printf("%ld %lu\n", w.big, w.ub);
  struct Z z = {3, -2}; printf("%d %d size=%zu\n", z.a, z.b, sizeof z);
  union U u; u.raw = 0xAABBCCDDu;
  printf("%x %x %x\n", u.p.lo, u.p.mid, u.p.hi);
  u.p.mid = 0x12; printf("%x\n", u.raw);
  struct Date arr[3] = {{1, 1, 2000}, {2, 2, 2001}, {3, 3, 2002}};
  int s = 0; for (int i = 0; i < 3; i++) s += arr[i].day + arr[i].month + arr[i].year;
  printf("%d\n", s);
  struct Date copy = arr[1]; copy.day = 30; printf("%u %u\n", arr[1].day, copy.day);
  struct Date *pd = &arr[2]; pd->month = 15; pd->day--; printf("%u %u %u\n", pd->day, pd->month, pd->year);
  int r = (pd->day = 40); printf("%d\n", r);
  unsigned t = d.year > 5 ? d.year : 0; printf("%u\n", t);
  printf("%d\n", (int)(sizeof(struct Date)));
  return 0;
}
