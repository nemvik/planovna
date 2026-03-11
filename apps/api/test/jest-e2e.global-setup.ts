import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

export default async function globalSetup(): Promise<void> {
  execFileSync('npm', ['run', 'prisma:migrate:deploy'], {
    cwd: resolve(__dirname, '..'),
    env: process.env,
    stdio: 'inherit',
  });
}
