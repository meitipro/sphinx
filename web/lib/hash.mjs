/**
 * Locks, seals and salts, byte for byte the contract's (contracts/sphinx.py
 * lock_of and seal_of). Plain JavaScript so the site, the Node scripts and the
 * vector check run this exact file.
 *
 *   lock = sha256(UTF-8 "answer|notes|salt")
 *   seal = sha256(UTF-8 "answer|salt|address"), the address in lower case
 *
 * tests/vectors.json holds the shared test vectors; scripts/check-vectors.mjs
 * checks this file against them and tests/test_static.py runs that check.
 */

/** Lower-case hex sha256 of a string's UTF-8 bytes, with SubtleCrypto (browser and Node alike). */
export async function sha256Hex(text) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function lockOf(answer, notes, salt) {
  return sha256Hex(`${answer}|${notes}|${salt}`);
}

export function sealOf(answer, salt, address) {
  return sha256Hex(`${answer}|${salt}|${String(address).toLowerCase()}`);
}

/** A fresh salt: a random UUID, 36 letters, digits and dashes, inside the contract's 8 to 80. */
export function newSalt() {
  return globalThis.crypto.randomUUID();
}

/** Why a text cannot be an answer the contract will open, or an empty string. */
export function answerProblem(text, max = 80) {
  if (text.includes('|')) return 'An answer cannot contain a bar, |.';
  if (text.length > max) return `At most ${max} characters.`;
  return '';
}
