const {CC}=require('./harness.js');
const calls={
 'stdio.h':'printf fprintf sprintf snprintf scanf fscanf sscanf puts fputs putchar putc fputc getc fgetc getchar fgets ungetc fopen fclose fread fwrite fseek ftell rewind fflush feof ferror clearerr remove rename perror setbuf setvbuf tmpfile vprintf vfprintf vsprintf vsnprintf getline fileno freopen fgetpos fsetpos',
 'stdlib.h':'malloc calloc realloc free exit abort atexit atoi atol atoll atof strtol strtoll strtoul strtoull strtod strtof abs labs llabs div ldiv rand srand qsort bsearch getenv system _Exit aligned_alloc',
 'string.h':'strlen strcpy strncpy strcat strncat strcmp strncmp strchr strrchr strstr strtok strtok_r strdup strndup memcpy memmove memset memcmp memchr strspn strcspn strpbrk strerror strcoll strxfrm strnlen strlcpy',
 'ctype.h':'isalpha isdigit isalnum isspace isupper islower ispunct isprint iscntrl isgraph isxdigit toupper tolower isblank',
 'math.h':'sqrt cbrt pow exp exp2 expm1 log log2 log10 log1p sin cos tan asin acos atan atan2 sinh cosh tanh asinh acosh atanh floor ceil round trunc rint nearbyint lround llround fabs fmod fmin fmax fdim hypot copysign remainder ldexp frexp modf isnan isinf isfinite signbit fma erf tgamma lgamma',
 'time.h':'time clock difftime localtime gmtime mktime strftime asctime ctime',
 'assert.h':'assert','stdarg.h':'va_start va_arg va_end va_copy','unistd.h':'sleep usleep','errno.h':'errno',
 'stdint.h':'INT8_MAX UINT64_MAX INTPTR_MAX SIZE_MAX',
 'limits.h':'CHAR_BIT INT_MAX UINT_MAX LONG_MIN ULONG_MAX LLONG_MAX SHRT_MAX UCHAR_MAX SCHAR_MIN',
 'float.h':'DBL_MAX DBL_MIN DBL_EPSILON FLT_MAX FLT_EPSILON DBL_DIG',
 'stdio.h ':'EOF BUFSIZ NULL stdin stdout stderr SEEK_SET FILENAME_MAX',
 'stdlib.h ':'RAND_MAX EXIT_SUCCESS EXIT_FAILURE',
 'math.h ':'M_PI M_E INFINITY NAN HUGE_VAL M_SQRT2 M_LN2',
 'time.h ':'CLOCKS_PER_SEC','stdbool.h':'true false'
};
const missing=[];
for(const [h,names] of Object.entries(calls)){
 for(const n of names.split(' ')){
  const isMacro=/^[A-Z_0-9]+$/.test(n)||n.startsWith('va_')||n==='assert'||n==='errno';
  const src='#include <'+h.trim()+'>\n#include <stdio.h>\nint main(void){ '+(isMacro?'(void)('+(n.startsWith('va_')||n==='assert'?'0':n)+');':'void *p = (void*)'+n+'; (void)p;')+' return 0; }\n';
  const c=CC.compile(src,{});
  if(!c.ok) missing.push(h.trim()+':'+n+' -> '+c.errors.filter(e=>e.sev==='error')[0].msg.slice(0,50));
 }}
console.log(missing.join('\n')||'none');
