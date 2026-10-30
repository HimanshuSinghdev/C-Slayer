#include <stdio.h>
#include <string.h>
#include <ctype.h>
#include <stdlib.h>
void rev(char *s){ int n=strlen(s); for(int i=0;i<n/2;i++){ char t=s[i]; s[i]=s[n-1-i]; s[n-1-i]=t; } }
int main(void){
  char a[50] = "Hello", b[50];
  strcpy(b, a); strcat(b, ", World"); printf("%s %zu\n", b, strlen(b));
  printf("%d %d %d\n", strcmp("abc","abd")<0, strcmp("b","a")>0, strcmp("x","x"));
  printf("%d\n", strncmp("hello","help",3));
  char *p = strstr(b, "World"); printf("%s %ld\n", p, (long)(p-b));
  printf("%s %s\n", strchr(b, 'o'), strrchr(b, 'o'));
  rev(a); printf("%s\n", a);
  char up[20]; strcpy(up, "mixed Case 123"); for (int i=0; up[i]; i++) up[i] = toupper((unsigned char)up[i]); printf("%s\n", up);
  char line[] = "one,two;three four"; for (char *t = strtok(line, ",; "); t; t = strtok(NULL, ",; ")) printf("[%s]", t); printf("\n");
  char out[64]; sprintf(out, "%d-%s-%.2f", 42, "x", 3.14159); printf("%s\n", out);
  int x, y; char w[20]; int n = sscanf("12 34 word", "%d %d %19s", &x, &y, w); printf("%d %d %d %s\n", n, x, y, w);
  printf("%d %ld %.1f\n", atoi("  -77abc"), strtol("0x1f", NULL, 16), atof("2.5e2"));
  char *dup = strdup("duplicate"); printf("%s\n", dup); free(dup);
  printf("%d%d%d%d\n", isalpha('a')!=0, isdigit('5')!=0, isspace(' ')!=0, ispunct('!')!=0);
  char pal[] = "racecar"; int ok=1; for (int i=0,j=strlen(pal)-1;i<j;i++,j--) if (pal[i]!=pal[j]) ok=0; printf("%d\n", ok);
  char cnt[26] = {0}; const char *txt = "the quick brown fox"; for (int i=0;txt[i];i++) if (isalpha((unsigned char)txt[i])) cnt[txt[i]-'a']++; for (int i=0;i<26;i++) if (cnt[i]>1) printf("%c=%d ", 'a'+i, cnt[i]); printf("\n");
  char buf[10]; strncpy(buf, "abcdefghijklmnop", 9); buf[9]=0; printf("%s\n", buf);
  printf("%s|%10s|%-10s|%.3s|\n", "abc", "abc", "abc", "abcdef");
  char m[20]; memset(m, 'x', 5); m[5]=0; printf("%s\n", m);
  char c1[5] = "abcd", c2[5]; memcpy(c2, c1, 5); printf("%s %d\n", c2, memcmp(c1, c2, 5));
  printf("%zu\n", strspn("aabbcc", "ab")); printf("%zu\n", strcspn("hello world", " "));
  printf("%c%c\n", "abc"[1], *"xyz");
  return 0; }
