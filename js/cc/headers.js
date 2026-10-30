/* C-Slayer · standard headers (declarations only) and the part of libc that is written in C itself.
 * Builtin implementations live in libc.js; functions that call back into user code (qsort, bsearch) are plain C here.
 */
(function (g) {
  'use strict';
  const CC = g.CC = g.CC || {};

  const H = {};

  H['stddef.h'] = `
#ifndef _STDDEF_H
#define _STDDEF_H
typedef unsigned long size_t;
typedef long ptrdiff_t;
typedef int wchar_t;
#define NULL ((void*)0)
#define offsetof(t, m) ((size_t)&(((t*)0)->m))
#endif`;

  H['stdbool.h'] = `
#ifndef _STDBOOL_H
#define _STDBOOL_H
#define bool _Bool
#define true 1
#define false 0
#define __bool_true_false_are_defined 1
#endif`;

  H['stdint.h'] = `
#ifndef _STDINT_H
#define _STDINT_H
typedef signed char int8_t; typedef unsigned char uint8_t;
typedef short int16_t; typedef unsigned short uint16_t;
typedef int int32_t; typedef unsigned int uint32_t;
typedef long int64_t; typedef unsigned long uint64_t;
typedef long intptr_t; typedef unsigned long uintptr_t;
typedef long intmax_t; typedef unsigned long uintmax_t;
#define INT8_MIN (-128)
#define INT8_MAX 127
#define UINT8_MAX 255
#define INT16_MIN (-32768)
#define INT16_MAX 32767
#define UINT16_MAX 65535
#define INT32_MIN (-2147483647-1)
#define INT32_MAX 2147483647
#define UINT32_MAX 4294967295U
#define INT64_MIN (-9223372036854775807L-1)
#define INT64_MAX 9223372036854775807L
#define UINT64_MAX 18446744073709551615UL
#define SIZE_MAX 18446744073709551615UL
#endif`;

  H['limits.h'] = `
#ifndef _LIMITS_H
#define _LIMITS_H
#define CHAR_BIT 8
#define SCHAR_MIN (-128)
#define SCHAR_MAX 127
#define UCHAR_MAX 255
#define CHAR_MIN (-128)
#define CHAR_MAX 127
#define SHRT_MIN (-32768)
#define SHRT_MAX 32767
#define USHRT_MAX 65535
#define INT_MIN (-2147483647-1)
#define INT_MAX 2147483647
#define UINT_MAX 4294967295U
#define LONG_MIN (-9223372036854775807L-1)
#define LONG_MAX 9223372036854775807L
#define ULONG_MAX 18446744073709551615UL
#define LLONG_MIN (-9223372036854775807LL-1)
#define LLONG_MAX 9223372036854775807LL
#define ULLONG_MAX 18446744073709551615ULL
#endif`;

  H['float.h'] = `
#ifndef _FLOAT_H
#define _FLOAT_H
#define FLT_MAX 3.40282346638528859812e+38F
#define FLT_MIN 1.17549435082228750797e-38F
#define FLT_EPSILON 1.19209289550781250000e-7F
#define FLT_DIG 6
#define DBL_MAX 1.79769313486231570815e+308
#define DBL_MIN 2.22507385850720138309e-308
#define DBL_EPSILON 2.22044604925031308085e-16
#define DBL_DIG 15
#define LDBL_MAX DBL_MAX
#define LDBL_MIN DBL_MIN
#define LDBL_EPSILON DBL_EPSILON
#endif`;

  H['errno.h'] = `
#ifndef _ERRNO_H
#define _ERRNO_H
extern int errno;
#define EPERM 1
#define ENOENT 2
#define EIO 5
#define EBADF 9
#define ENOMEM 12
#define EACCES 13
#define EEXIST 17
#define EINVAL 22
#define EDOM 33
#define ERANGE 34
#endif`;

  H['stdarg.h'] = `
#ifndef _STDARG_H
#define _STDARG_H
typedef char *va_list;
#endif`;

  H['assert.h'] = `
#ifndef _ASSERT_H
#define _ASSERT_H
void __assert_fail(const char *expr, const char *file, int line, const char *func);
#ifdef NDEBUG
#define assert(e) ((void)0)
#else
#define assert(e) ((e) ? (void)0 : __assert_fail(#e, __FILE__, __LINE__, __func__))
#endif
#endif`;

  H['stdio.h'] = `
#ifndef _STDIO_H
#define _STDIO_H
#include <stddef.h>
typedef struct _IO_FILE { int fd; int flags; int pad0; int pad1; } FILE;
typedef long fpos_t;
extern FILE *stdin;
extern FILE *stdout;
extern FILE *stderr;
#define EOF (-1)
#define BUFSIZ 8192
#define FILENAME_MAX 4096
#define FOPEN_MAX 16
#define SEEK_SET 0
#define SEEK_CUR 1
#define SEEK_END 2
#define _IOFBF 0
#define _IOLBF 1
#define _IONBF 2
int printf(const char *format, ...);
int fprintf(FILE *stream, const char *format, ...);
int sprintf(char *str, const char *format, ...);
int snprintf(char *str, size_t size, const char *format, ...);
int scanf(const char *format, ...);
int fscanf(FILE *stream, const char *format, ...);
int sscanf(const char *str, const char *format, ...);
int puts(const char *s);
int putchar(int c);
int putc(int c, FILE *stream);
int fputc(int c, FILE *stream);
int fputs(const char *s, FILE *stream);
int getchar(void);
int getc(FILE *stream);
int fgetc(FILE *stream);
char *fgets(char *s, int n, FILE *stream);
int ungetc(int c, FILE *stream);
FILE *fopen(const char *path, const char *mode);
int fclose(FILE *stream);
int fflush(FILE *stream);
int feof(FILE *stream);
int ferror(FILE *stream);
void clearerr(FILE *stream);
size_t fread(void *ptr, size_t size, size_t nmemb, FILE *stream);
size_t fwrite(const void *ptr, size_t size, size_t nmemb, FILE *stream);
int fseek(FILE *stream, long offset, int whence);
long ftell(FILE *stream);
void rewind(FILE *stream);
int remove(const char *path);
int rename(const char *from, const char *to);
void perror(const char *s);
void setbuf(FILE *stream, char *buf);
int setvbuf(FILE *stream, char *buf, int mode, size_t size);
#endif`;

  H['stdlib.h'] = `
#ifndef _STDLIB_H
#define _STDLIB_H
#include <stddef.h>
typedef struct { int quot; int rem; } div_t;
typedef struct { long quot; long rem; } ldiv_t;
#define EXIT_SUCCESS 0
#define EXIT_FAILURE 1
#define RAND_MAX 2147483647
void *malloc(size_t size);
void *calloc(size_t nmemb, size_t size);
void *realloc(void *ptr, size_t size);
void free(void *ptr);
void exit(int status);
void _Exit(int status);
void abort(void);
int atexit(void (*func)(void));
int atoi(const char *s);
long atol(const char *s);
long long atoll(const char *s);
double atof(const char *s);
long strtol(const char *s, char **end, int base);
unsigned long strtoul(const char *s, char **end, int base);
long long strtoll(const char *s, char **end, int base);
unsigned long long strtoull(const char *s, char **end, int base);
double strtod(const char *s, char **end);
float strtof(const char *s, char **end);
int abs(int x);
long labs(long x);
long long llabs(long long x);
div_t div(int a, int b);
ldiv_t ldiv(long a, long b);
int rand(void);
void srand(unsigned int seed);
void qsort(void *base, size_t nmemb, size_t size, int (*compar)(const void *, const void *));
void *bsearch(const void *key, const void *base, size_t nmemb, size_t size, int (*compar)(const void *, const void *));
char *getenv(const char *name);
int system(const char *cmd);
#endif`;

  H['string.h'] = `
#ifndef _STRING_H
#define _STRING_H
#include <stddef.h>
size_t strlen(const char *s);
char *strcpy(char *dest, const char *src);
char *strncpy(char *dest, const char *src, size_t n);
char *strcat(char *dest, const char *src);
char *strncat(char *dest, const char *src, size_t n);
int strcmp(const char *a, const char *b);
int strncmp(const char *a, const char *b, size_t n);
int strcasecmp(const char *a, const char *b);
int strncasecmp(const char *a, const char *b, size_t n);
int strcoll(const char *a, const char *b);
char *strchr(const char *s, int c);
char *strrchr(const char *s, int c);
char *strstr(const char *hay, const char *needle);
char *strdup(const char *s);
char *strndup(const char *s, size_t n);
char *strtok(char *s, const char *delim);
size_t strspn(const char *s, const char *accept);
size_t strcspn(const char *s, const char *reject);
char *strpbrk(const char *s, const char *accept);
char *strerror(int errnum);
void *memcpy(void *dest, const void *src, size_t n);
void *memmove(void *dest, const void *src, size_t n);
void *memset(void *s, int c, size_t n);
int memcmp(const void *a, const void *b, size_t n);
void *memchr(const void *s, int c, size_t n);
#endif`;

  H['strings.h'] = `
#ifndef _STRINGS_H
#define _STRINGS_H
#include <string.h>
#endif`;

  H['ctype.h'] = `
#ifndef _CTYPE_H
#define _CTYPE_H
int isalpha(int c);
int isdigit(int c);
int isalnum(int c);
int isspace(int c);
int isupper(int c);
int islower(int c);
int ispunct(int c);
int isprint(int c);
int isgraph(int c);
int iscntrl(int c);
int isxdigit(int c);
int isblank(int c);
int toupper(int c);
int tolower(int c);
#endif`;

  H['time.h'] = `
#ifndef _TIME_H
#define _TIME_H
#include <stddef.h>
typedef long time_t;
typedef long clock_t;
#define CLOCKS_PER_SEC 1000000
time_t time(time_t *t);
clock_t clock(void);
double difftime(time_t a, time_t b);
#endif`;

  H['unistd.h'] = `
#ifndef _UNISTD_H
#define _UNISTD_H
unsigned int sleep(unsigned int seconds);
int usleep(unsigned int usec);
#endif`;

  // math.h is generated from the table in libc.js
  CC.headerTexts = H;

  /** C source for library functions that need to call user code. Each chunk is compiled only when one of `names` is used. */
  CC.preludeChunks = [
    {
      names: ['qsort'],
      src: `
#include <stddef.h>
#include <string.h>
#include <stdlib.h>
static void __msort(char *b, size_t n, size_t s, int (*c)(const void *, const void *), char *tmp) {
  if (n < 2) return;
  size_t n1 = n / 2, n2 = n - n1;
  char *b1 = b, *b2 = b + n1 * s;
  __msort(b1, n1, s, c, tmp);
  __msort(b2, n2, s, c, tmp);
  char *t = tmp;
  while (n1 > 0 && n2 > 0) {
    if (c(b1, b2) <= 0) { memcpy(t, b1, s); b1 += s; n1--; }
    else { memcpy(t, b2, s); b2 += s; n2--; }
    t += s;
  }
  if (n1 > 0) memcpy(t, b1, n1 * s);
  memcpy(b, tmp, (n - n2) * s);
}
void qsort(void *base, size_t nmemb, size_t size, int (*compar)(const void *, const void *)) {
  if (nmemb < 2 || size == 0) return;
  char *tmp = (char *)malloc(nmemb * size);
  if (!tmp) return;
  __msort((char *)base, nmemb, size, compar, tmp);
  free(tmp);
}`
    },
    {
      names: ['bsearch'],
      src: `
#include <stddef.h>
#include <stdlib.h>
void *bsearch(const void *key, const void *base, size_t nmemb, size_t size, int (*compar)(const void *, const void *)) {
  size_t lo = 0, hi = nmemb;
  while (lo < hi) {
    size_t mid = lo + (hi - lo) / 2;
    const char *p = (const char *)base + mid * size;
    int r = compar(key, p);
    if (r == 0) return (void *)p;
    if (r < 0) hi = mid; else lo = mid + 1;
  }
  return NULL;
}`
    },
    {
      names: ['div'],
      src: `
#include <stdlib.h>
div_t div(int a, int b) { div_t r; r.quot = a / b; r.rem = a % b; return r; }`
    },
    {
      names: ['ldiv'],
      src: `
#include <stdlib.h>
ldiv_t ldiv(long a, long b) { ldiv_t r; r.quot = a / b; r.rem = a % b; return r; }`
    }
  ];
})(typeof globalThis !== 'undefined' ? globalThis : self);
