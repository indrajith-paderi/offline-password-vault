const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const moduleDir = path.join(root, 'modules/secure-native');
const vectors = JSON.parse(fs.readFileSync(path.join(moduleDir, 'test-vectors/aes-gcm.json'), 'utf8')).vectors;

const FIELDS = ['name', 'key', 'nonce', 'aad', 'plaintext', 'ciphertext', 'tag'];

const targets = {
  kotlin: path.join(moduleDir, 'android/src/test/java/dev/offlinevault/securenative/TestVectors.kt'),
  swift: path.join(moduleDir, 'ios/Tests/SecureNativeCoreTests/TestVectors.swift'),
};

function kotlin() {
  const rows = vectors
    .map((v) => `    GcmVector(${FIELDS.map((f) => `"${v[f]}"`).join(', ')}),`)
    .join('\n');
  return `package dev.offlinevault.securenative

data class GcmVector(
  val name: String,
  val key: String,
  val nonce: String,
  val aad: String,
  val plaintext: String,
  val ciphertext: String,
  val tag: String,
)

object TestVectors {
  val gcm = listOf(
${rows}
  )
}
`;
}

function swift() {
  const rows = vectors
    .map((v) => `    GcmVector(${FIELDS.map((f) => `${f}: "${v[f]}"`).join(', ')}),`)
    .join('\n');
  return `struct GcmVector {
  let name: String
  let key: String
  let nonce: String
  let aad: String
  let plaintext: String
  let ciphertext: String
  let tag: String
}

enum TestVectors {
  static let gcm: [GcmVector] = [
${rows}
  ]
}
`;
}

const render = () => ({ [targets.kotlin]: kotlin(), [targets.swift]: swift() });

module.exports = { render };

if (require.main === module) {
  for (const [file, content] of Object.entries(render())) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  process.stdout.write(`${vectors.length} vectors written for Kotlin and Swift\n`);
}
