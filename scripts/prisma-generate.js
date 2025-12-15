#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const schemaPath = resolve('prisma', 'schema.prisma');
let schema = '';
try {
  schema = readFileSync(schemaPath, 'utf8');
} catch (error) {
  console.warn(`[prisma-generate] Schema not found at ${schemaPath}; skipping prisma generate.`);
  process.exit(0);
}

const hasModel = schema
  .split(/\r?\n/u)
  .some((line) => /^\s*model\s+\w+/u.test(line));

if (!hasModel) {
  console.log('[prisma-generate] No Prisma models detected. Skipping prisma generate.');
  process.exit(0);
}

console.log('[prisma-generate] Models detected. Running `prisma generate`...');
const result = spawnSync('npx', ['prisma', 'generate'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error('[prisma-generate] Failed to run `prisma generate`:', result.error);
  process.exit(result.status ?? 1);
}

process.exit(result.status ?? 0);
