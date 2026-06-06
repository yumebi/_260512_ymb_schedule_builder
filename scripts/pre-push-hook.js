#!/usr/bin/env node
// git pre-push フックから呼び出されるスクリプト
// patch バージョンを +1 して package.json をコミットする

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

const parts = pkg.version.split('.').map(Number);
parts[2] += 1;
pkg.version = parts.join('.');

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
console.log(`Version bumped → ${pkg.version}`);

try {
  execSync('git add package.json', { stdio: 'inherit' });
  execSync(`git commit -m "chore: v${pkg.version} (auto bump)"`, { stdio: 'inherit' });
} catch (e) {
  console.error('バージョンコミットに失敗しました:', e.message);
  process.exit(1);
}
