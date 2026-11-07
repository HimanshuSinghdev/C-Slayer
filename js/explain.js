/* C-Slayer · plain-English explanations for compiler messages and runtime errors. Pure data, no eval. */
(function (g) {
  'use strict';
  const CC = g.CC = g.CC || {};
  // [regex on the message, why, how to fix]. First match wins.
  const RULES = [
    [/^expected ';' before '(.*)'/, "C needs a semicolon at the end of a statement. The compiler only noticed it was missing when it reached '$1'.", 'Add ; at the end of the line just above (usually the previous line, not the line shown).'],
    [/^expected '\}' before end of input/, 'A { was opened but never closed, so the file ended too early.', 'Count your { and }: each { needs a matching }. Check the last function you wrote; auto-indent helps spot the gap.'],
    [/^expected '\)' before/, 'A ( was opened but the matching ) is missing (or an extra token is in the way).', 'Check the parentheses on this line and the line above.'],
    [/^expected expression before '(.*)'/, "The compiler expected a value (like 5, x or a+b) but found '$1'.", 'Look for a missing operand, a doubled operator (like ++ + ) or an extra comma or semicolon.'],
    [/^'(.+)' undeclared \(first use in this function\)/, "You used the name '$1' but never declared it in this function.", "Declare it before use (for example int $1;), fix a spelling/capital-letter mistake, or add the missing #include."],
    [/^implicit declaration of function '(.+?)'/, "You called '$1' before the compiler knew what it is. Normally this means a missing #include.", 'Add the right header (the message tells you which, e.g. #include <stdio.h> for printf) or declare/define the function above main.'],
    [/^undefined reference to 'main'/, 'Every C program starts in a function called main, and there is none.', 'Add int main(void) { ... return 0; }'],
    [/^undefined reference to '(.+?)'/, "'$1' is called but its body was never written (or the name is misspelled).", 'Define the function, or check the spelling against its declaration.'],
    [/^too few arguments to function '(.+?)'/, "You called '$1' with fewer values than it needs.", 'Match the number and order of the parameters in its definition.'],
    [/^too many arguments to function '(.+?)'/, "You called '$1' with more values than it accepts.", 'Remove the extra values, or add parameters to the function.'],
    [/^conflicting types for '(.+?)'/, "'$1' is declared twice with different types (return type or parameters).", 'Make the declaration and the definition identical.'],
    [/^redefinition of '(.+?)'/, "'$1' is defined more than once.", 'Remove or rename the duplicate.'],
    [/^assignment to expression with array type/, 'An array name is a fixed location; you cannot assign a whole array with =.', 'Copy element by element, use strcpy for strings, or memcpy for other arrays.'],
    [/^lvalue required/, 'The left side of = must be something you can store into, like a variable, not a value like 5 or x+1.', 'Check for = vs == and for stray operators on the left side.'],
    [/^assignment of read-only variable '(.+?)'/, "'$1' was declared const, so it cannot change.", 'Remove const, or use a different variable.'],
    [/^control reaches end of non-void function/, 'A function that promises to return a value can finish without returning one.', 'Add a return statement on every path (including after if/else).'],
    [/^'(.+?)' is used uninitialized/, "Variable '$1' is read before it was ever given a value, so it holds garbage.", "Give it a value when you declare it (int $1 = 0;) or assign before using it."],
    [/^unused variable '(.+?)'/, "'$1' is declared but never used.", 'Delete it, or use it. Unused variables usually mean a typo elsewhere.'],
    [/^variable '(.+?)' set but not used/, "You store a value in '$1' but never read it.", 'Use the value (print/return/compare it) or remove the variable.'],
    [/^format '%(.*?)' expects argument of type '(.+?)', but argument (\d+) has type '(.+?)'/, "The printf/scanf format %$1 wants a '$2' but you passed a '$4'. Mismatches print garbage or crash.", 'Use %d for int, %ld for long, %lld for long long, %f for double, %c for char, %s for strings, %zu for sizeof/size_t. For scanf, use & on non-array variables.'],
    [/^format '%(.*?)' expects a matching/, 'The format string has more % conversions than the values you gave.', 'Give one value for every % in the format string.'],
    [/^too many arguments for format/, 'You gave more values than the format string uses.', 'Add the missing % conversions or remove the extra values.'],
    [/^suggest parentheses around assignment used as truth value/, 'if (x = 5) assigns 5 to x (always true). You probably meant to compare.', 'Use == to compare: if (x == 5).'],
    [/makes pointer from integer without a cast/, 'A plain number was used where an address (pointer) is needed.', 'Use & to take an address, or a pointer variable; for strings use "..." or a char array.'],
    [/makes integer from pointer without a cast/, 'An address was used where a number is needed (for example "a" is a string, but \'a\' is a single character).', "Use single quotes for one character ('a') and double quotes for strings (\"abc\")."],
    [/incompatible pointer type/, 'The pointer types do not match (for example int* given where char* is expected).', 'Pass the right kind of pointer, or fix the declaration.'],
    [/^array subscript (-?\d+) is (above|below) array bounds/, 'You index beyond the end of an array. Valid indexes run from 0 to size-1.', 'Check the loop condition (< size, not <= size) and the array size.'],
    [/returning address of local variable/, 'A local variable disappears when the function returns, so its address becomes invalid.', 'Return the value instead, or use malloc / a static variable / a caller-provided buffer.'],
    [/^'else' without a previous 'if'/, 'else must come directly after an if (and its block).', 'Check for a stray ; after the if condition or a missing/extra brace.'],
    [/^break statement not within loop or switch/, 'break only works inside a loop or switch.', 'Use return to leave a function, or move the break inside the loop.'],
    [/^continue statement not within a loop/, 'continue only works inside a loop.', 'Move it inside a for/while/do loop.'],
    [/^missing terminating " character/, 'A string literal was opened with " but never closed on the same line.', 'Add the closing " (use \\n for a newline inside the string, not a real line break).'],
    [/^storage size of '(.+?)' isn't known/, "The type of '$1' is not defined (struct or typedef missing).", 'Define the struct before using it, or fix the type name.'],
    [/^request for member '(.+?)' in something not a structure/, "You used .$1 on something that is not a struct.", 'Use -> for pointers to structs, . for struct variables; check the variable type.'],
    [/^invalid type argument of '->'/, '-> is only for pointers to structs.', 'Use . when you have the struct itself, not a pointer.'],
    [/^void value not ignored/, 'You are using the result of a function that returns nothing (void).', 'Do not assign or print it; or change the function to return a value.'],
    [/^initializer element is not constant/, 'A global variable can only be initialised with constants, not with other variables or function calls.', 'Initialise it inside main (or another function) instead.'],
    [/^size of array '(.+?)' is negative/, 'An array size must be positive.', 'Check the number in the brackets.'],
    [/^the 'gets' function is dangerous/, 'gets cannot limit how much it reads, so it can overflow your buffer (and has been removed from C).', 'Use fgets(buf, sizeof buf, stdin).'],
    [/^defining variadic/, 'Variadic functions are supported; this message should not appear.', ''],
    [/^statement with no effect/, 'This line computes a value and throws it away.', 'Did you mean an assignment (=) or a function call?'],
    [/misleading indentation/, 'The indentation suggests a statement belongs to an if/loop, but without braces it does not.', 'Add { } around the body, or fix the indentation.'],
    [/^switch quantity not an integer/, 'switch only works on integers and characters, not strings or floats.', 'Use if / else if with strcmp for strings.'],
    [/^duplicate case value/, 'Two case labels have the same value.', 'Remove or change one of them.'],
    [/^expected declaration specifiers/, 'The compiler expected a type (like int) here. This often means a parenthesis/brace mistake above.', 'Check the previous lines for a missing ) or }.']
  ];
  const RUNTIME = {
    'heap-overflow': ['You wrote (or read) past the end of memory you got from malloc.', 'Allocate enough bytes (n * sizeof(type)), and keep loop indexes below n. Remember C strings need one extra byte for the final \\0.'],
    'use-after-free': ['You used memory after free() had already given it back.', 'Do not touch a pointer after freeing it; set it to NULL right after free.'],
    'double-free': ['free() was called twice on the same memory.', 'Free each malloc exactly once; set the pointer to NULL after freeing.'],
    'invalid-free': ['free() was given something that did not come from malloc.', 'Only free pointers returned by malloc/calloc/realloc, exactly as returned.'],
    'segv': ['The program touched memory it must not (NULL pointer, uninitialised pointer, or a read-only string literal).', 'Check pointers for NULL before using them, initialise them, and copy string literals into char arrays before modifying.'],
    'stack-overflow': ['The program used up its stack: usually infinite recursion or a huge local array.', 'Make sure recursion has a base case that stops, or move big arrays to the heap (malloc) or make them static.'],
    'stack-overflow-array': ['You wrote outside a local array.', 'Array indexes go from 0 to size-1. Check the loop limits.'],
    'global-overflow': ['You wrote outside a global array.', 'Array indexes go from 0 to size-1. Check the loop limits.'],
    'sigfpe': ['Integer division (or %) by zero.', 'Check the divisor is not 0 before dividing.'],
    'timeout': ['The program ran too long; most likely an infinite loop.', 'Check that the loop condition can become false and that the loop variable changes. You can raise the limit in the Tests tab.'],
    'output-limit': ['The program printed far too much output, probably in an endless loop.', 'Check the loop that contains printf.'],
    'abort': ['abort() was called.', 'Look for the line that calls abort or a failing assert.'],
    'assert': ['An assert() condition was false.', 'The condition shows what the program assumed; find out why it was not true.']
  };
  function fill(t, m) { return t.replace(/\$(\d)/g, (x, i) => (m[+i] !== undefined ? m[+i] : '')); }
  CC.explainRules = RULES; CC.explainRuntimeTable = RUNTIME;
  // lang: 'en' (default) or 'hi' (Hinglish, from explain_hi.js). Falls back to English if a line has no translation.
  CC.lang = 'en';
  CC.explain = function (msg) {
    msg = String(msg);
    const HI = CC.lang === 'hi' && CC.explainHi;
    for (let i = 0; i < RULES.length; i++) {
      const [re, why, fix] = RULES[i]; const m = re.exec(msg);
      if (m) { const h = HI && HI.rules[i]; return { why: fill(h ? h[0] : why, m), fix: fill(h ? h[1] : fix, m) }; }
    }
    return null;
  };
  CC.explainRuntime = function (kind) { const h = CC.lang === 'hi' && CC.explainHi && CC.explainHi.runtime[kind]; const r = h || RUNTIME[kind]; return r ? { why: r[0], fix: r[1] } : null; };
})(typeof globalThis !== 'undefined' ? globalThis : self);
