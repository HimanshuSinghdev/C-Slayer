# C·Slayer

A C compiler, runner and **1–10 grader** that lives entirely in your browser. No server, no install — host the folder on GitHub Pages and it works on a phone, offline (PWA).

## How it works
`lexer → preprocessor → parser → type-checked bytecode compiler → sandboxed virtual machine` (running in a Web Worker).
The VM is a sanitizer: out-of-bounds reads/writes, use-after-free, double free, stack overflow, null dereference, divide-by-zero, runaway loops/output and memory leaks are all caught and reported with the offending line. Programs can read the keyboard live (`scanf`, `fgets`, `getchar`) and use an in-memory file system (`fopen`…).

Compiler diagnostics mimic `gcc -Wall`: implicit declarations, format-string mismatches, uninitialised or unused variables, missing returns, returning addresses of locals, constant out-of-bounds indexes, and more.

## Features at a glance
* **Fast:** a JIT (bytecode → JavaScript) runs loops and recursion at near-native speed; dead loops, constant `if`s and closed-form sum loops are optimised away.
* **Debugger:** step into/over/out, breakpoints, live variables, call stack and heap view.
* **Interactive input:** `scanf`/`fgets` ask for input live, also on the fast engine.
* **Format code:** the **⇥ Format** button (or Alt+Shift+F) re-indents by block structure and tidies spacing; only whitespace changes, and Ctrl+Z undoes it.
* **Explanations in Hinglish:** tap **EN / हिं** in the file bar; every compiler error and runtime crash is explained in simple Hinglish, with how to fix it.
* **Share link:** copy a link that opens your program on any phone. Themes, text size, autocomplete, installable PWA that works offline.

## Hinglish guide (students ke liye)
* **Run** dabao: program compile hoke chalta hai. Galti ho to **Problems** tab mein line number ke saath dikhegi, aur neeche seedhi bhasha mein likha hoga *kya hua* aur *kaise theek karein*.
* **EN / हिं** button se explanations English ya Hinglish mein badlo (yaad rehta hai).
* **⇥ Format** se code apne aap saaf-suthra ho jata hai (indentation + spacing). Galti ho jaye to Ctrl+Z.
* **Grade** (✓) dabao: program ko 1–10 mein score milta hai. Score sirf ek run se nahi, balki hidden edge inputs (0, 1, -1, 45) se bhi tay hota hai: agar program kachra (garbage) print kare, crash ho, ya bahut slow ho (jaise exponential recursion), to score kat jata hai. Memory leak pe score 7 se upar nahi jata.
* **Debug** se line-by-line chalao aur dekho variables kaise badalte hain.

## The score (1–10)
| Part | Points |
|---|---|
| Runs without crashing (no memory errors, timeouts, leaks) | 3 |
| Correct output (teacher/student test cases; otherwise estimated from a clean run) | 2.5 |
| Compiler warnings | 1.5 |
| Safe practices (unchecked `malloc`/`scanf`, unbounded `strcpy`/`%s`, `gets`) | 1 |
| Style (indentation, comments, naming, line length) | 1 |
| Structure (function size, nesting depth, `goto`, globals) | 1 |

A program that does not compile scores 1–2; a program that crashes is capped at 6.
Programs that read input are also re-run on hidden edge inputs (0, 1, -1 and 45) with no reference answer needed: garbage output (an uninitialised variable) or a crash caps the score at 5, running out of time on a moderately large input (exponential recursion, say) caps it at 4, and a memory leak caps it at 7. Calibration programs live in `tests/students/` (`fib1.c`–`fib4.c` score 4, 5, 7, 10). Add test cases in the **Tests** tab for an exact correctness grade.

## Security
* No `eval`, no `new Function`, no network calls, no third-party requests: everything (CodeMirror, fonts) is vendored.
* Strict Content-Security-Policy (`script-src 'self'`; no inline scripts or styles).
* Student code never runs as JavaScript — it is compiled to bytecode and interpreted in a Worker with hard limits: time budget (30 s default, adjustable), 64 MB heap by default (up to 256 MB), 8 MB stack, 4 MB output, 400 KB source, bounded preprocessor expansion and nesting depth.
* All program output is inserted with `textContent` (no HTML injection). Compiler tables are `Map`s (no prototype pollution). `%n` is ignored.
* Tested with fuzzing (random token soup, deep nesting, macro bombs, huge allocations).

"Zero vulnerabilities" can't be promised by anyone for any software; this design removes the usual classes (code injection, XSS, server-side attacks) by having no server and no dynamic JS execution. Please report anything you find.

## Language support
Full C11 core: all types and operators, structs/unions/enums/typedefs, function pointers, VLAs, designated initialisers, `goto`, `switch`, `static`, user-defined variadic functions (`va_list`), `#include "file.h"` from your other editor tabs, and the common standard library (stdio, stdlib, string, ctype, math, time, assert, stdarg, limits, stdint, ...).
Call arguments with side effects are evaluated right to left, like gcc (so `printf("%d %d", i++, i++)` prints what gcc prints).
The local time zone is UTC.

## Not supported (yet)
`long double` precision beyond `double`, threads, `fork`/sockets, `fgetpos`/`freopen`, `erf`/`gamma` math functions, struct-by-value arguments to variadic functions.

## Deploy
Upload the folder to a GitHub repo → Settings → Pages → branch `main`, root. Open the URL on your phone and "Add to Home screen".

## Develop
`node tests/diff.js` compares output with real `gcc` on `tests/corpus/*.c`; `node tests/rt.js` checks runtime-error detection; `node tests/fuzz.js` runs the fuzzers; `node tests/scoring.js` checks the score bands; `node tests/format.js` proves the formatter keeps behaviour and is idempotent.
