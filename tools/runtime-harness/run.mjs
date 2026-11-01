import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime, useHostFilesystem } from '@php-wasm/node';
import fs from 'node:fs';

import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const cfgPath = ROOT + '/api/config.json';
const tasksPath = ROOT + '/.temp/tasks.json';
const hadCfg = fs.existsSync(cfgPath);
const hadTasks = fs.existsSync(tasksPath);
const tasksBackup = hadTasks ? fs.readFileSync(tasksPath) : null;
if (!hadCfg) {
  fs.writeFileSync(cfgPath, JSON.stringify({
    defaultProvider: 'ollama',
    providers: { ollama: { baseUrl: 'http://127.0.0.1:11434/v1', model: 'llama3.1', apiKeyEnv: '', healthUrl: 'http://127.0.0.1:11434/v1/models' } },
  }, null, 2));
}
try {
  const php = new PHP(await loadNodeRuntime('8.3'));
  useHostFilesystem(php);
  const code = fs.readFileSync(process.argv[2] || new URL('./test.php', import.meta.url), 'utf8').split('__KRA_ROOT__').join(ROOT);
  const out = await php.runStream({ code });
  console.log(await out.stdoutText);
  const err = (await out.stderrText).trim();
  if (err) console.error('--- stderr ---\n' + err.slice(0, 3000));
} finally {
  if (!hadCfg) fs.rmSync(cfgPath, { force: true });
  if (!hadTasks) fs.rmSync(tasksPath, { force: true });
  else fs.writeFileSync(tasksPath, tasksBackup);
  fs.rmSync('/tmp/kra-test-config', { recursive: true, force: true });
  fs.rmSync('/tmp/naskah.md', { force: true });
  process.exit(0);
}
