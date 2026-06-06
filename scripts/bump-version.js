#!/usr/bin/env node
// ビルド前に自動実行されるバージョンインクリメントスクリプト
// patch バージョン (x.y.Z) を +1 する

const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

const parts = pkg.version.split('.').map(Number);
parts[2] += 1;
pkg.version = parts.join('.');

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
console.log(`Version bumped → ${pkg.version}`);
