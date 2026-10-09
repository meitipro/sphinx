/**
 * Check web/lib/hash.mjs against the shared vectors in tests/vectors.json.
 *
 *   node scripts/check-vectors.mjs
 *
 * The contract hashes with hashlib, the browser with SubtleCrypto. Both must
 * give the same bytes, or a player could seal an answer that can never be
 * opened. tests/test_static.py runs this script.
 */
import fs from 'node:fs';
import path from 'node:path';

import { lockOf, sealOf } from '../lib/hash.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');
const vectors = JSON.parse(fs.readFileSync(path.join(root, 'tests', 'vectors.json'), 'utf8'));
const problems = [];
for (const v of vectors.locks) {
  const got = await lockOf(v.answer, v.notes, v.salt);
  if (got !== v.lock) problems.push(`lock of ${JSON.stringify(v.answer)}: ${got} != ${v.lock}`);
}
for (const v of vectors.seals) {
  const got = await sealOf(v.answer, v.salt, v.address);
  if (got !== v.seal) problems.push(`seal of ${JSON.stringify(v.answer)}: ${got} != ${v.seal}`);
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`vectors ok: ${vectors.locks.length} locks, ${vectors.seals.length} seals`);
