import { spawn } from 'node:child_process';

const commands = [
  ['API', process.execPath, ['server/index.js']],
  ['WEB', process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'vite:dev']],
];
const children = commands.map(([name, command, args]) => {
  const child = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  child.on('exit', (code) => { if (code && code !== 0) console.error(`${name} stopped with ${code}`); });
  return child;
});
const stop = () => children.forEach((child) => child.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
