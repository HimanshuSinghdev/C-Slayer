#include <stdio.h>
#include <string.h>
#include <stddef.h>
enum Color { RED, GREEN=5, BLUE };
enum { A_FLAG=1, B_FLAG=2, C_FLAG=4 };
typedef struct { char name[16]; int age; double gpa; } Student;
struct Inner { char c; int i; }; struct Outer { struct Inner in; short s; char tag[3]; };
union U { int i; float f; unsigned char b[4]; };
typedef struct { int id; struct { int a, b; } pair; int arr[3]; } Rec;
int main(void){
  Student s[3] = {{"Ann", 20, 3.5}, {"Bob", 22, 3.9}}; strcpy(s[2].name, "Cy"); s[2].age=19; s[2].gpa=3.0;
  double tot=0; for (int i=0;i<3;i++){ printf("%-5s %2d %.1f\n", s[i].name, s[i].age, s[i].gpa); tot+=s[i].gpa; } printf("%.2f\n", tot/3);
  Student *p = &s[1]; p->age++; printf("%d\n", s[1].age);
  printf("%zu %zu %zu\n", sizeof(Student), sizeof(struct Inner), sizeof(struct Outer));
  printf("%zu %zu %zu\n", offsetof(Student, age), offsetof(Student, gpa), offsetof(struct Outer, tag));
  enum Color c = BLUE; printf("%d %d %d\n", RED, GREEN, c);
  int flags = A_FLAG | C_FLAG; printf("%d %d\n", (flags & B_FLAG) != 0, (flags & C_FLAG) != 0);
  union U u; u.f = 1.0f; printf("%08x %d\n", u.i, u.b[3]);
  Rec r = {7, {1,2}, {9,8,7}}; Rec r2 = r; r2.pair.a = 100; printf("%d %d %d %d\n", r.pair.a, r2.pair.a, r2.arr[2], r2.id);
  Student copy = s[0]; copy.age = 99; printf("%d %d\n", s[0].age, copy.age);
  struct Outer o = {{'x', 5}, 3, "ab"}; printf("%c %d %d %s\n", o.in.c, o.in.i, o.s, o.tag);
  Rec arr[2] = {{1,{2,3},{4,5,6}}, {.id=9, .arr={[1]=7}}}; printf("%d %d %d\n", arr[0].pair.b, arr[1].id, arr[1].arr[1]);
  return 0; }
