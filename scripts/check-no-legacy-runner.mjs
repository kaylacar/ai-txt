import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const skipDirs = new Set(['.git', 'node_modules', 'dist', 'build', '.next', '.turbo', 'coverage']);
const token = String.fromCharCode(106, 101, 115, 116);
const tokenTs = `ts-${token}`;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}

const matcher = new RegExp(`\\b(?:${escapeRegex(tokenTs)}|${escapeRegex(token)})\\b`, 'i');
const hits = [];

function scanDir(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      scanDir(full);
      continue;
    }
    if (!entry.isFile()) continue;

    let text;
    try {
      text = readFileSync(full, 'utf8');
    } catch {
      continue;
    }

    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      if (matcher.test(lines[i])) {
        hits.push({ file: path.relative(root, full), line: i + 1, snippet: lines[i].trim().slice(0, 180) });
        break;
      }
    }
  }
}

scanDir(root);

if (hits.length > 0) {
  console.error('Legacy test-runner tokens found. Remove them before commit:');
  for (const hit of hits.slice(0, 50)) {
    console.error(`- ${hit.file}:${hit.line} ${hit.snippet}`);
  }
  if (hits.length > 50) {
    console.error(`- ...and ${hits.length - 50} more`);
  }
  process.exit(1);
}

console.log('Legacy runner token check passed.');