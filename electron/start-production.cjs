const { spawn } = require('node:child_process');
const electron = require('electron');

if (typeof electron !== 'string') {
  throw new Error('Electron runtime is missing. Install project dependencies, then retry.');
}

const child = spawn(electron, ['.'], {
  env: { ...process.env, STREAMBOXX_LOAD_DIST: '1' },
  stdio: 'inherit',
  windowsHide: false,
});

child.on('error', (error) => {
  process.stderr.write(`Could not start the StreamBoXx desktop preview: ${error.message}\n`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
