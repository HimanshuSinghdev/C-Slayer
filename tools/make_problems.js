// Builds js/problems.js: expected outputs come from gcc running the reference solutions (never from our own compiler).
const fs = require('fs'), cp = require('child_process'), os = require('os'), path = require('path');
const H = '#include <stdio.h>\n';
const P = [
  { id: 'sum2', title: 'Sum of two numbers', en: 'Read two integers a and b. Print a + b.', hi: 'Do integers a aur b padho. a + b print karo.',
    starter: H + '\nint main(void) {\n    // read a and b, print their sum\n    return 0;\n}\n',
    ref: H + 'int main(void){long long a,b; if(scanf("%lld %lld",&a,&b)!=2) return 1; printf("%lld\\n",a+b); return 0;}',
    tests: [['3 4', 0], ['-5 5', 0], ['0 0', 0], ['2000000000 2000000000', 1], ['-1000000000000 7', 1]] },
  { id: 'evenodd', title: 'Even or odd', en: 'Read an integer n. Print "Even" or "Odd".', hi: 'Ek integer n padho. "Even" ya "Odd" print karo.',
    starter: H + '\nint main(void) {\n    return 0;\n}\n',
    ref: H + 'int main(void){long long n; if(scanf("%lld",&n)!=1) return 1; puts(n%2==0?"Even":"Odd"); return 0;}',
    tests: [['4', 0], ['7', 0], ['0', 1], ['-3', 1], ['-8', 1]] },
  { id: 'fact', title: 'Factorial', en: 'Read n (0 to 20). Print n! (fits in long long).', hi: 'n padho (0 se 20). n! print karo (long long mein aata hai).',
    starter: H + '\nint main(void) {\n    return 0;\n}\n',
    ref: H + 'int main(void){int n; if(scanf("%d",&n)!=1) return 1; long long f=1; for(int i=2;i<=n;i++) f*=i; printf("%lld\\n",f); return 0;}',
    tests: [['5', 0], ['1', 0], ['0', 1], ['10', 1], ['20', 1]] },
  { id: 'fib', title: 'Fibonacci', en: 'Read n (0 to 90). Print the n-th Fibonacci number (F0=0, F1=1). It must be fast for n = 90.', hi: 'n padho (0 se 90). n-th Fibonacci number print karo (F0=0, F1=1). n = 90 par bhi tez chalna chahiye.',
    starter: H + '\nint main(void) {\n    int n;\n    scanf("%d", &n);\n    return 0;\n}\n',
    ref: H + 'int main(void){int n; if(scanf("%d",&n)!=1) return 1; long long a=0,b=1; for(int i=0;i<n;i++){long long t=a+b;a=b;b=t;} printf("%lld\\n",a); return 0;}',
    tests: [['10', 0], ['1', 1], ['0', 1], ['2', 1], ['50', 1], ['90', 1]] },
  { id: 'prime', title: 'Prime check', en: 'Read n. Print "Prime" or "Not prime". Remember 0 and 1 are not prime. n can be up to 1000000007.', hi: 'n padho. "Prime" ya "Not prime" print karo. Yaad rakho 0 aur 1 prime nahi hain. n 1000000007 tak ho sakta hai.',
    starter: H + '\nint main(void) {\n    return 0;\n}\n',
    ref: H + 'int main(void){long long n; if(scanf("%lld",&n)!=1) return 1; int p=n>=2; for(long long i=2;i*i<=n;i++) if(n%i==0){p=0;break;} puts(p?"Prime":"Not prime"); return 0;}',
    tests: [['7', 0], ['10', 0], ['2', 1], ['1', 1], ['0', 1], ['1000000007', 1], ['999999937', 1], ['-7', 1]] },
  { id: 'digits', title: 'Sum of digits', en: 'Read a non-negative integer. Print the sum of its digits.', hi: 'Ek non-negative integer padho. Uske digits ka sum print karo.',
    starter: H + '\nint main(void) {\n    return 0;\n}\n',
    ref: H + 'int main(void){long long n; if(scanf("%lld",&n)!=1) return 1; int s=0; while(n>0){s+=n%10;n/=10;} printf("%d\\n",s); return 0;}',
    tests: [['123', 0], ['9', 0], ['0', 1], ['1000000', 1], ['987654321012', 1]] },
  { id: 'gcd', title: 'GCD', en: 'Read two positive integers. Print their greatest common divisor.', hi: 'Do positive integers padho. Unka GCD (greatest common divisor) print karo.',
    starter: H + '\nint main(void) {\n    return 0;\n}\n',
    ref: H + 'int main(void){long long a,b; if(scanf("%lld %lld",&a,&b)!=2) return 1; while(b){long long t=a%b;a=b;b=t;} printf("%lld\\n",a); return 0;}',
    tests: [['12 18', 0], ['17 5', 0], ['7 7', 1], ['1 1000000000000', 1], ['600851475143 6857', 1]] },
  { id: 'maxn', title: 'Largest of n numbers', en: 'First read n (n >= 1), then n integers. Print the largest. Numbers may be negative.', hi: 'Pehle n padho (n >= 1), phir n integers. Sabse bada print karo. Numbers negative ho sakte hain.',
    starter: H + '\nint main(void) {\n    return 0;\n}\n',
    ref: H + 'int main(void){int n; if(scanf("%d",&n)!=1) return 1; long long m,x; for(int i=0;i<n;i++){ if(scanf("%lld",&x)!=1) return 1; if(i==0||x>m) m=x;} printf("%lld\\n",m); return 0;}',
    tests: [['5\n3 9 2 7 1', 0], ['3\n-5 -2 -9', 0], ['1\n42', 1], ['4\n-1 -1 -1 -1', 1], ['6\n1 2 3 4 5 2147483648', 1]] },
  { id: 'palin', title: 'Palindrome word', en: 'Read one word (no spaces, at most 100 letters). Print "Yes" if it reads the same backwards, else "No".', hi: 'Ek word padho (spaces nahi, 100 letters tak). Agar ulta padhne par bhi wahi ho to "Yes", warna "No" print karo.',
    starter: H + '#include <string.h>\n\nint main(void) {\n    char s[101];\n    return 0;\n}\n',
    ref: H + '#include <string.h>\nint main(void){char s[101]; if(scanf("%100s",s)!=1) return 1; int n=strlen(s),ok=1; for(int i=0;i<n/2;i++) if(s[i]!=s[n-1-i]) ok=0; puts(ok?"Yes":"No"); return 0;}',
    tests: [['level', 0], ['hello', 0], ['a', 1], ['abba', 1], ['abca', 1], ['racecar', 1]] },
  { id: 'vowels', title: 'Count vowels', en: 'Read one line (up to 200 characters, spaces allowed). Print how many vowels (a, e, i, o, u, either case) it has.', hi: 'Ek line padho (200 characters tak, spaces ho sakte hain). Usme kitne vowels (a, e, i, o, u, chhote ya bade) hain print karo.',
    starter: H + '\nint main(void) {\n    char line[256];\n    return 0;\n}\n',
    ref: H + 'int main(void){char s[256]; if(!fgets(s,sizeof s,stdin)){puts("0");return 0;} int c=0; for(char*p=s;*p;p++){char d=*p|32; if(d==\'a\'||d==\'e\'||d==\'i\'||d==\'o\'||d==\'u\') c++;} printf("%d\\n",c); return 0;}',
    tests: [['Hello World', 0], ['rhythm', 0], ['AEIOU aeiou', 1], ['', 1], ['The quick brown fox jumps over the lazy dog', 1]] }
];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prob-'));
const out = P.map(p => {
  const c = path.join(tmp, p.id + '.c'), x = path.join(tmp, p.id);
  fs.writeFileSync(c, p.ref); cp.execFileSync('gcc', ['-O1', '-o', x, c]);
  fs.writeFileSync(path.join(__dirname, 'problems', p.id + '.c'), p.ref.replace(/;/g, ';\n').replace(/\{/g, '{\n'));
  const tests = p.tests.map(([inp, hidden], i) => {
    const input = inp + '\n';
    const exp = cp.execFileSync(x, { input }).toString();
    return { name: hidden ? 'Hidden test ' + (i + 1) : 'Example ' + (i + 1), input, expected: exp, hidden: !!hidden };
  });
  return { id: p.id, title: p.title, en: p.en, hi: p.hi, starter: p.starter, tests };
});
fs.writeFileSync(path.join(__dirname, '..', 'js', 'problems.js'), '/* Practice problems (generated by tools/make_problems.js; expected outputs come from gcc). */\nwindow.PROBLEMS = ' + JSON.stringify(out, null, 1) + ';\n');
console.log('problems', out.length, 'tests', out.reduce((a, p) => a + p.tests.length, 0));
