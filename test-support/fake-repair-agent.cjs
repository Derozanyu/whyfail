const fs = require('node:fs');
const path = require('node:path');

let prompt = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { prompt += chunk; });
process.stdin.on('end', () => {
  const target = path.join(process.cwd(), 'app.js');
  fs.writeFileSync(target, 'console.log("fixed by fake agent");\n', 'utf8');
  process.stdout.write(JSON.stringify({
    ok: true,
    receivedUserInstruction: prompt.includes('keep the output readable'),
    sawEnvironmentFile: fs.existsSync(path.join(process.cwd(), '.env')),
    sawNodeModules: fs.existsSync(path.join(process.cwd(), 'node_modules'))
  }));
});
