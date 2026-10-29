const assert = require('node:assert/strict');
const fs = require('node:fs');

const runner = fs.readFileSync('api/lib/KraExecutionRunner.php', 'utf8');
const engine = fs.readFileSync('api/lib/KraTaskEngine.php', 'utf8');
const api = fs.readFileSync('api/index.php', 'utf8');
const app = fs.readFileSync('web/app.js', 'utf8');

assert.match(runner, /\?callable\s+\$onProgress/);
assert.match(runner, /'PREPARING'/);
assert.match(runner, /'TARGET'/);
assert.match(runner, /'LINE'/);
assert.match(runner, /'WRITING'/);
assert.match(engine, /function approve\(string \$taskId, string \$user = 'User', \?callable \$onProgress = null\)/);
assert.match(engine, /KraExecutionRunner::execute\(\$task, \$projectRoot, \$onProgress\)/);
assert.match(api, /application\/x-ndjson/);
assert.match(api, /\$_GET\['stream'\].*=== '1'/);
assert.match(api, /'type'\s*=>\s*'done'/);
assert.match(app, /action=approve&stream=1/);
assert.match(app, /getReader\(\)/);
assert.match(app, /JSON\.parse\(line\)/);
assert.match(app, /runnerEventQueue/);

console.log('KRA runner streaming verification passed.');
