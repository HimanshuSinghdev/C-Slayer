// Loads the engine modules (browser-style IIFEs) into Node for testing.
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', 'js', 'cc');
function load(files) {
  for (const f of files) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    vm.runInThisContext(code, { filename: f });
  }
  return globalThis.CC;
}
module.exports = load;
