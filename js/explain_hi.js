/* C-Slayer · Hinglish (Roman Hindi) explanations. Same order as RULES in explain.js; '$1' etc. are filled from the message. */
(function (g) {
  'use strict';
  const CC = g.CC = g.CC || {};
  const rules = [
    ["C mein har statement ke end mein semicolon (;) lagta hai. Compiler ko tab pata chala jab wo '$1' tak pahunch gaya.", 'Upar wali line ke end mein ; laga do (aksar pichli line mein hi bhool hoti hai, jis line pe error dikh rahi hai uspe nahi).'],
    ['Ek { khola gaya tha par kabhi band (}) nahi hua, isliye file bich mein hi khatam ho gayi.', 'Apne { aur } gino: har { ka ek } hona chahiye. Aakhri function check karo; auto-indent se gap dikh jata hai.'],
    ['Ek ( khola tha par uska ) nahi hai (ya beech mein koi extra cheez aa gayi).', 'Is line aur upar wali line ke brackets check karo.'],
    ["Compiler ko yahan value chahiye thi (jaise 5, x ya a+b) par '$1' mil gaya.", 'Dekho koi operand missing to nahi, koi operator double (jaise ++ +) to nahi, ya extra comma / semicolon to nahi.'],
    ["Aapne '$1' naam use kiya par is function mein kabhi declare nahi kiya.", "Use karne se pehle declare karo (jaise int $1;), spelling ya capital/small letter ki galti dekho, ya sahi #include lagao."],
    ["Aapne '$1' ko call kiya par compiler ko pata hi nahi ye kya hai. Aksar #include bhool gaye hote ho.", 'Sahi header lagao (message batata hai kaunsa, jaise #include <stdio.h>).'],
    ['Har C program main naam ke function se start hota hai, aur yahan main hai hi nahi.', 'Ye likho: int main(void) { ... return 0; }'],
    ["'$1' ko call kiya gaya par uski body kabhi likhi nahi (ya naam ki spelling galat hai).", 'Function define karo, ya declaration se spelling match karke dekho.'],
    ["Aapne '$1' ko zaroorat se kam values ke saath call kiya.", 'Function definition ke parameters ki ginti aur order se match karo.'],
    ["Aapne '$1' ko zaroorat se zyada values ke saath call kiya.", 'Extra values hata do, ya function mein parameters badha do.'],
    ["'$1' do baar alag-alag type ke saath declare hua hai (return type ya parameters alag).", 'Declaration aur definition bilkul ek jaise rakho.'],
    ["'$1' ek se zyada baar define ho gaya hai.", 'Duplicate hata do ya uska naam badal do.'],
    ['Array ka naam ek fixed jagah hota hai; poora array = se assign nahi kar sakte.', 'Ek-ek element copy karo, string ke liye strcpy, ya baaki arrays ke liye memcpy use karo.'],
    ['= ke left side pe aisi cheez honi chahiye jisme value store ho sake (variable), 5 ya x+1 jaisi value nahi.', '= aur == ka farak dekho, aur left side pe koi extra operator to nahi.'],
    ["'$1' const declare hua tha, isliye badal nahi sakta.", 'const hata do, ya koi dusra variable use karo.'],
    ['Jo function value return karne ka vaada karta hai wo bina return kiye khatam ho sakta hai.', 'Har rasta (if/else ke baad bhi) return statement pe khatam hona chahiye.'],
    ["Variable '$1' ko value mile bina hi padh liya gaya, isliye usme kachra (garbage) hai.", 'Declare karte time value do (int $1 = 0;) ya use karne se pehle assign karo.'],
    ["'$1' declare hua par kabhi use nahi hua.", 'Hata do ya use karo. Unused variable aksar kahin aur typo ka sanket hota hai.'],
    ["Aap '$1' mein value store karte ho par kabhi padhte nahi.", 'Value ko print/return/compare karo, ya variable hata do.'],
    ["printf/scanf ka format %$1 ko '$2' chahiye par aapne '$4' diya. Mismatch se garbage print hota hai ya crash.", 'int ke liye %d, long ke liye %ld, float/double ke liye %f (scanf mein double ke liye %lf), char ke liye %c, string ke liye %s.'],
    ['Format string mein % zyada hain, values kam di gayi hain.', 'Har % ke liye ek value do.'],
    ['Aapne format string se zyada values de di.', 'Missing % lagao ya extra values hata do.'],
    ['if (x = 5) x mein 5 daal deta hai (hamesha true). Shayad aap compare karna chahte the.', 'Compare ke liye == use karo: if (x == 5).'],
    ['Jahan address (pointer) chahiye tha wahan simple number de diya.', 'Address ke liye & lagao, ya pointer variable do; string ke liye "..." ya char array use karo.'],
    ['Jahan number chahiye tha wahan address de diya (jaise "a" string hai, par \'a\' ek akshar).', "Ek akshar ke liye single quotes ('a'), string ke liye double quotes (\"abc\") use karo."],
    ['Pointer ke types match nahi karte (jaise char* chahiye tha aur int* de diya).', 'Sahi type ka pointer do ya declaration theek karo.'],
    ['Aap array ke end ke aage index kar rahe ho. Valid index 0 se size-1 tak hote hain.', 'Loop condition dekho (< size, <= size nahi) aur array ka size check karo.'],
    ['Local variable function khatam hote hi gayab ho jata hai, isliye uska address invalid ho jata hai.', 'Value return karo, ya malloc / static variable / caller ka buffer use karo.'],
    ['else hamesha if (aur uske block) ke turant baad aana chahiye.', 'if ki condition ke baad extra ; ya missing/extra brace dekho.'],
    ['break sirf loop ya switch ke andar chalta hai.', 'Function se nikalne ke liye return use karo, ya break ko loop ke andar rakho.'],
    ['continue sirf loop ke andar chalta hai.', 'Ise for/while/do loop ke andar rakho.'],
    ['String " se shuru hui par usi line mein band nahi hui.', 'Closing " laga do (string ke andar nayi line ke liye \\n use karo, asli line break nahi).'],
    ["'$1' ka type define nahi hai (struct ya typedef missing).", 'Use karne se pehle struct define karo, ya type ka naam theek karo.'],
    ["Aapne .$1 aisi cheez pe use kiya jo struct nahi hai.", 'Struct ke pointer ke liye -> aur struct variable ke liye . use karo; variable ka type check karo.'],
    ['-> sirf struct ke pointer ke liye hota hai.', 'Jab aapke paas pointer nahi balki khud struct ho to . use karo.'],
    ['Aap aise function ka result use kar rahe ho jo kuch return hi nahi karta (void).', 'Use assign ya print mat karo; ya function ko value return karne wala bana do.'],
    ['Global variable sirf constants se initialise ho sakta hai, doosre variables ya function call se nahi.', 'Use main (ya kisi aur function) ke andar initialise karo.'],
    ["Array ka size positive hona chahiye.", 'Brackets ke andar ka number check karo.'],
    ['gets ye limit nahi kar sakta ki kitna padhna hai, isliye buffer overflow ho sakta hai (aur C se hata diya gaya hai).', 'fgets(buf, sizeof buf, stdin) use karo.'],
    ['Variadic functions supported hain; ye message nahi aana chahiye.', ''],
    ['Ye line ek value nikalti hai aur fenk deti hai.', 'Kya aap assignment (=) ya function call karna chahte the?'],
    ['Indentation se lagta hai ki statement if/loop ka hissa hai, par braces ke bina nahi hota.', 'Body ke around { } lagao, ya indentation theek karo.'],
    ['switch sirf integer aur character pe chalta hai, string ya float pe nahi.', 'String ke liye if / else if ke saath strcmp use karo.'],
    ['Do case labels ki value ek jaisi hai.', 'Ek ko hata do ya badal do.'],
    ['Compiler ko yahan type (jaise int) chahiye tha. Aksar upar kisi ) ya } ki galti hoti hai.', 'Pichli lines mein missing ) ya } dhundo.']
  ];
  const runtime = {
    'heap-overflow': ['Aapne malloc se mili memory ke end ke aage likha (ya padha).', 'Poori memory maango (n * sizeof(type)) aur loop index n se chhota rakho. C string ko aakhri \\0 ke liye ek extra byte chahiye.'],
    'use-after-free': ['free() ke baad wo memory dobara use kar li.', 'Free karne ke baad pointer ko mat chhuo; free ke turant baad use NULL kar do.'],
    'double-free': ['Ek hi memory pe free() do baar chal gaya.', 'Har malloc ko sirf ek baar free karo; free ke baad pointer NULL kar do.'],
    'invalid-free': ['free() ko aisi cheez mili jo malloc se aayi hi nahi thi.', 'Sirf malloc/calloc/realloc se mile pointer ko, jaisa mila waisa hi, free karo.'],
    'segv': ['Program ne aisi memory chhui jo nahi chhuni thi (NULL pointer, bina value wala pointer, ya read-only string literal).', 'Use se pehle pointer NULL check karo, initialise karo, aur string literal ko badalne se pehle char array mein copy karo.'],
    'stack-overflow': ['Program ka stack khatam ho gaya: aksar kabhi na rukne wali recursion ya bahut bada local array.', 'Recursion mein base case rakho jo ruk sake, ya bade arrays ko malloc / static bana do.'],
    'stack-overflow-array': ['Aapne local array ke bahar likha.', 'Array index 0 se size-1 tak hota hai. Loop ki limits dekho.'],
    'global-overflow': ['Aapne global array ke bahar likha.', 'Array index 0 se size-1 tak hota hai. Loop ki limits dekho.'],
    'sigfpe': ['Integer ko 0 se divide (ya %) kiya.', 'Divide karne se pehle check karo ki divisor 0 nahi hai.'],
    'timeout': ['Program bahut der chala; sabse zyada chance infinite loop ka hai.', 'Dekho loop ki condition kabhi false ho sakti hai ya nahi, aur loop variable badal raha hai ya nahi. Tests tab mein limit badha sakte ho.'],
    'output-limit': ['Program ne bahut zyada output print kiya, shayad kabhi na rukne wale loop mein.', 'Jis loop mein printf hai use check karo.'],
    'abort': ['abort() call hua.', 'Wo line dhundo jo abort call karti hai ya jo assert fail hua.'],
    'assert': ['Ek assert() ki condition false thi.', 'Condition dikhati hai ki program ne kya maana tha; dekho wo sach kyun nahi tha.']
  };

  // ---- score report: Hinglish text + tiny before/after fixes (fixes are code, so shown in both languages) ----
  const FIX = {
    uninit: ['int next;            // random garbage\nprintf("%d", next);', 'int next = 0;        // always give a start value\nprintf("%d", next);'],
    slow: ['int fib(int n) {      // calls itself twice: 2^n work\n  return n<2 ? n : fib(n-1)+fib(n-2);\n}', 'long long a=0, b=1;  // one loop: n steps\nfor (int i=2; i<=n; i++) { long long t=a+b; a=b; b=t; }'],
    leak: ['int *a = malloc(n * sizeof(int));\n/* ... use a ... */      // never freed', 'int *a = malloc(n * sizeof(int));\n/* ... use a ... */\nfree(a);               // give it back'],
    scanfret: ['scanf("%d", &n);', 'if (scanf("%d", &n) != 1) return 1;'],
    strcpy: ['strcpy(dst, src);', 'snprintf(dst, sizeof dst, "%s", src);'],
    scanfs: ['scanf("%s", name);', 'scanf("%31s", name);   // width = size - 1'],
    gets: ['gets(buf);', 'fgets(buf, sizeof buf, stdin);'],
    atoi: ['int n = atoi(s);', 'char *end; long n = strtol(s, &end, 10);\nif (*end != 0) /* not a number */;'],
    mallocnull: ['int *p = malloc(40);\np[0] = 1;', 'int *p = malloc(40);\nif (p == NULL) return 1;\np[0] = 1;'],
    comments: ['int main() { ... }', '// Prints the n-th Fibonacci number.\nint main() { ... }'],
    magic: ['if (x > 86400) ...', '#define SECONDS_PER_DAY 86400\nif (x > SECONDS_PER_DAY) ...'],
    globals: ['int total;            // global\nvoid add(int x){ total += x; }', 'int add(int total, int x){ return total + x; }'],
    split: ['int main() { /* 80 lines */ }', 'int readInput(void);\nint solve(int n);\nint main() { return solve(readInput()); }'],
    nest: ['if (a) { if (b) { if (c) { ... } } }', 'if (!a || !b || !c) return;\n...'],
    goto: ['goto done;', 'break;   // or return; or a flag'],
    exit: ['int main() { ... return 1; }', 'int main() { ... return 0; }   // 0 = success'],
    stack: ['int f(int n){ return f(n-1); }', 'int f(int n){ if (n == 0) return 0; return f(n-1); }']
  };
  // [english regex, hinglish builder, fix key]
  const SC = [
    [/^Ran out of time/, () => 'Program time khatam hone tak chalta raha: shayad infinite loop ya bahut slow algorithm.', 'slow'],
    [/^Too slow: input (\S+)/, (m) => 'Bahut slow: input ' + m[1] + ' par program time pe khatam nahi hua. Algorithm bahut tezi se bada hota hai (exponential/quadratic). Loop ya memoisation use karo.', 'slow'],
    [/^Hung on input (\S+)/, (m) => 'Input ' + m[1] + ' par program atak gaya.', 'slow'],
    [/^Crashed on input (\S+): (.*)/, (m) => 'Input ' + m[1] + ' par crash hua: ' + m[2], null],
    [/^Printed garbage for input (\S+)/, (m) => 'Input ' + m[1] + ' par kachra (garbage) print hua: koi variable set hone se pehle padha ja raha hai (uninitialised).', 'uninit'],
    [/^Printed an enormous amount/, () => 'Bahut zyada output print hua (loop kabhi rukta nahi?).', null],
    [/^Stack overflow/, () => 'Stack overflow: recursion ka base case kaam nahi kar raha, ya local array bahut bada hai.', 'stack'],
    [/^Program aborted: (.*)/, (m) => 'Program abort ho gaya: ' + m[1], null],
    [/^Memory\/arithmetic error at runtime: (.*)/, (m) => 'Runtime pe memory/arithmetic error: ' + m[1], null],
    [/^main\(\) exited with status (\d+)/, (m) => 'main() ne status ' + m[1] + ' ke saath exit kiya (0 ka matlab sab theek).', 'exit'],
    [/^Memory leak: (\d+) block\w* \((\d+) bytes\) never freed/, (m) => 'Memory leak: ' + m[1] + ' block (' + m[2] + ' bytes) kabhi free nahi hua. Score 7 se upar nahi ja sakta.', 'leak'],
    [/^Leaked memory keeps/, () => 'Memory leak ki wajah se jawab sahi hone par bhi score 7 pe ruk jata hai.', 'leak'],
    [/^A warning \(wrong printf\/scanf type/, () => 'Warning (printf/scanf ka galat type ya uninitialised variable) ka matlab hai ki output shayad galat hai.', 'uninit'],
    [/^Negative input is accepted silently/, () => 'Negative input chup-chaap accept ho jata hai; usse validate karne par vichar karo.', 'scanfret'],
    [/^Edge-case probes .* all ran cleanly/, () => 'Edge-case checks (0, 1, negative, bada number) sab theek chale.', null],
    [/^No test cases were provided/, () => 'Koi test case nahi diya gaya, isliye sirf ek clean run se sahi hone ka andaza lagaya hai. Sahi grade ke liye test cases add karo.', null],
    [/^No warnings/, () => 'Koi warning nahi: clean build.', null],
    [/^Ran to completion/, () => 'Program poora chala, exit status 0.', null],
    [/^Program was not run/, () => 'Program chalaya hi nahi gaya.', null],
    [/^(\d+) of (\d+) test cases passed/, (m) => m[2] + ' mein se ' + m[1] + ' test case pass hue.', null],
    [/^Failed: (.*)/, (m) => 'Fail hua: ' + m[1], null],
    [/^strcpy\/strcat\/sprintf do not check/, () => 'strcpy/strcat/sprintf destination ka size check nahi karte; length ke saath strncpy/snprintf use karo.', 'strcpy'],
    [/^scanf\("%s"\) without a width/, () => 'scanf("%s") bina width ke buffer overflow kar sakta hai; "%31s" jaisa width do.', 'scanfs'],
    [/^gets\(\) is unsafe/, () => 'gets() unsafe hai aur C se hata diya gaya hai. fgets use karo.', 'gets'],
    [/^atoi\(\) cannot report errors/, () => 'atoi() galti nahi bata sakta; strtol() bata sakta hai.', 'atoi'],
    [/^The return value of scanf is ignored/, () => 'scanf ki return value ignore ho rahi hai: check karo ki jitna chahiye tha utna padha ya nahi.', 'scanfret'],
    [/^malloc\/calloc result '(.*)' is never checked for NULL/, (m) => "malloc/calloc ka result '" + m[1] + "' kabhi NULL ke liye check nahi hua.", 'mallocnull'],
    [/^No comments at all/, () => 'Koi comment nahi hai: program ka maksad aur mushkil hisse samjhao.', 'comments'],
    [/^Very few comments/, () => 'Itne code ke hisaab se comments bahut kam hain.', 'comments'],
    [/^Tabs and spaces are mixed/, () => 'Indentation mein tab aur space mix hain. Format button dabao.', null],
    [/^Indentation does not follow the block structure in (\d+) lines/, (m) => m[1] + ' lines mein indentation block ke hisaab se nahi hai. Format button dabao.', null],
    [/^Lines longer than 100 characters \((\d+)\)/, (m) => '100 se zyada characters wali ' + m[1] + ' lines hain; unhe tod do.', null],
    [/^Non-descriptive names: (.*)/, (m) => 'Naam samajh nahi aate: ' + m[1] + ' Aise naam rakho jo batayen variable kya hai.', null],
    [/^Mixed naming styles/, () => 'Naam rakhne ke tarike mix hain (camelCase aur snake_case). Ek hi style rakho.', null],
    [/^Several unexplained numeric constants/, () => 'Kai numbers ka matlab nahi pata: unhe #define ya const se naam do.', 'magic'],
    [/^Function '(.*)' is (\d+) lines long/, (m) => "Function '" + m[1] + "' " + m[2] + ' lines lamba hai; chhote functions mein baanto.', 'split'],
    [/^Function '(.*)' nests (\d+) levels deep/, (m) => "Function '" + m[1] + "' " + m[2] + ' level gehra hai; early return ya helper functions use karo.', 'nest'],
    [/^Everything is in main\(\)/, () => 'Sab kuch main() mein hai; kaam ko functions mein baanto.', 'split'],
    [/^goto makes control flow/, () => 'goto se code ka flow samajhna mushkil hota hai.', 'goto'],
    [/^Several mutable global variables \((\d+)\)/, (m) => 'Kai global variables hain (' + m[1] + '); data parameters se bhejo.', 'globals'],
    [/^Well-sized functions/, () => 'Functions sahi size ke hain, nesting kam hai.', null],
    [/^Consistent, readable layout/, () => 'Layout saaf aur ek jaisa hai.', null],
    [/^No risky library calls/, () => 'Koi risky library call nahi mili.', null]
  ];
  const WORDS = {
    'Outstanding': 'Shandaar', 'Excellent': 'Bahut badhiya', 'Good': 'Accha', 'Fair': 'Theek-thaak', 'Needs work': 'Mehnat chahiye', 'Not yet': 'Abhi nahi',
    'Quick wins — points you can win back': 'Jaldi jeetne wale: ye points wapas mil sakte hain',
    'Compiles cleanly': 'Compile', 'Safe coding practices': 'Surakshit coding', 'Fix': 'Theek karo', 'Show fix': 'Fix dekho'
  };
  CC.scoreText = function (text) {
    for (const [re, fn, fx] of SC) {
      const m = re.exec(text);
      if (m) return { text: CC.lang === 'hi' ? fn(m) : text, fix: fx ? FIX[fx] : null };
    }
    return { text, fix: null };
  };
  CC.scoreWord = function (w) { return CC.lang === 'hi' && WORDS[w] ? WORDS[w] : w; };
  CC.scoreSummary = function (t) {
    if (CC.lang !== 'hi') return t;
    if (/^Clean build, clean run/.test(t)) return 'Clean build, clean run, saaf code. Sudharne ko kuch nahi.';
    const m = /^Biggest gains available in: (.*?)\./.exec(t);
    return m ? 'Sabse zyada faida yahan: ' + m[1] + '.' + (/crashing program is capped at 6/.test(t) ? ' Crash hone wala program 6 pe ruk jata hai.' : '') : t;
  };
  CC.scoreFixes = FIX; CC.scoreRules = SC;
  CC.explainHi = { rules: rules, runtime: runtime };
})(typeof globalThis !== 'undefined' ? globalThis : self);
