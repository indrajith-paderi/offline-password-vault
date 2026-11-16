const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'src/legal/licenses.json');

const EXTRA = [
  {
    name: 'libsodium',
    version: '1.0.21',
    license: 'ISC',
    url: 'https://libsodium.org',
    text: `ISC License

Copyright (c) 2013-2025
Frank Denis <j at pureftpd dot org>

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
`,
  },
];

function resolvePkg(name, fromDir) {
  let dir = fromDir;
  for (;;) {
    const candidate = path.join(dir, 'node_modules', name, 'package.json');
    if (fs.existsSync(candidate)) return path.dirname(candidate);
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function licenseText(dir) {
  const file = fs
    .readdirSync(dir)
    .find((f) => /^(licen[cs]e|copying|notice)(\.(md|txt|markdown))?$/i.test(f));
  return file ? fs.readFileSync(path.join(dir, file), 'utf8').trim() : null;
}

const MIT = (holder) => `MIT License

Copyright (c) ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

function holder(pkg) {
  const a = typeof pkg.author === 'string' ? pkg.author : pkg.author && pkg.author.name;
  if (a) return a.replace(/\s*[<(].*$/, '').trim();
  if (pkg.name.startsWith('@react-native/') || pkg.name.startsWith('@react-native-community/')) {
    return 'Meta Platforms, Inc. and affiliates.';
  }
  return `the ${pkg.name} authors`;
}

function fallbackText(pkg, license) {
  if (license === 'MIT' || license.startsWith('(MIT OR') || license.startsWith('MIT OR')) return MIT(holder(pkg));
  return null;
}

function licenseName(pkg) {
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license && pkg.license.type) return pkg.license.type;
  if (Array.isArray(pkg.licenses)) return pkg.licenses.map((l) => l.type || l).join(' OR ');
  return 'UNKNOWN';
}

function repoUrl(pkg) {
  const r = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository && pkg.repository.url;
  if (!r) return pkg.homepage || null;
  return r.replace(/^git\+/, '').replace(/\.git$/, '').replace(/^git:\/\//, 'https://').replace(/^github:/, 'https://github.com/');
}

const app = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const seen = new Map();
const queue = Object.keys(app.dependencies || {}).map((name) => [name, root]);

while (queue.length) {
  const [name, from] = queue.shift();
  const dir = resolvePkg(name, from);
  if (!dir) continue;
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const key = `${pkg.name}@${pkg.version}`;
  if (seen.has(key) || pkg.private || pkg.os || pkg.cpu) continue;
  const license = licenseName(pkg);
  seen.set(key, {
    name: pkg.name,
    version: pkg.version,
    license,
    url: repoUrl(pkg),
    text: licenseText(dir) || fallbackText(pkg, license),
  });
  for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies })) {
    queue.push([dep, dir]);
  }
}

const texts = {};
const FONTS = [
  ['Plus Jakarta Sans (font)', '@expo-google-fonts/plus-jakarta-sans', 'https://github.com/tokotype/PlusJakartaSans'],
  ['JetBrains Mono (font)', '@expo-google-fonts/jetbrains-mono', 'https://github.com/JetBrains/JetBrainsMono'],
].map(([name, pkgName, url]) => {
  const dir = path.join(root, 'node_modules', pkgName);
  return {
    name,
    version: require(path.join(dir, 'package.json')).version,
    license: 'OFL-1.1',
    url,
    text: fs.readFileSync(path.join(dir, 'LICENSE_FONT'), 'utf8'),
  };
});

const packages = [...seen.values(), ...EXTRA, ...FONTS]
  .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))
  .map(({ text, ...rest }) => {
    if (!text) return { ...rest, textId: null };
    const id = crypto.createHash('sha1').update(text).digest('hex').slice(0, 10);
    texts[id] = text;
    return { ...rest, textId: id };
  });

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ packages, texts }) + '\n');
const missing = packages.filter((p) => !p.textId).length;
process.stdout.write(`${packages.length} packages, ${Object.keys(texts).length} unique texts, ${missing} without a license file\n`);
