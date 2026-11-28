import { exec } from './cli.mjs';

const steps = [
  'lint',
  'typecheck',
  'test',
  'db:test',
  'build',
  'e2e'
];

for (const step of steps) {
  exec('npm', ['run', step]);
}