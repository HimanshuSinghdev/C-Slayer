const { run } = require('./harness');
const r = run('#include <stdio.h>\nint main(void){ printf("Hello, %s! %d\\n", "world", 6*7); return 0; }');
console.log(JSON.stringify({ok:r.ok, errors:r.errors, out:r.out, exit:r.exit, runError:r.runError && (r.runError.kind+': '+r.runError.message)}, null, 1));
