#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <stdint.h>
int main(void){
  time_t t = 86400L*365*30 + 3600*5 + 61;
  struct tm *g = gmtime(&t); printf("%d-%02d-%02d %02d:%02d:%02d wday=%d yday=%d\n", g->tm_year+1900, g->tm_mon+1, g->tm_mday, g->tm_hour, g->tm_min, g->tm_sec, g->tm_wday, g->tm_yday);
  char buf[100]; strftime(buf, sizeof buf, "%Y/%m/%d %H:%M:%S %a %b %j %p %y", g); printf("%s\n", buf);
  strftime(buf, sizeof buf, "%A, %B %d, %Y %I:%M %p", g); printf("%s\n", buf);
  struct tm m = {0}; m.tm_year = 100; m.tm_mon = 0; m.tm_mday = 32; m.tm_hour = 25; time_t mt = mktime(&m); printf("%ld %d-%d-%d %d\n", (long)mt, m.tm_year, m.tm_mon, m.tm_mday, m.tm_hour);
  printf("%s", asctime(g)); printf("%s", ctime(&t));
  printf("%.0f\n", difftime(t, 0));
  char s[] = "a=1;b=2;c=3"; char *sv; for (char *p = strtok_r(s, ";", &sv); p; p = strtok_r(NULL, ";", &sv)) printf("<%s>", p); printf("\n");
  printf("%zu\n", strnlen("hello", 3));
  printf("%ld\n", (long)INTPTR_MAX == INT64_MAX);
  return 0; }
