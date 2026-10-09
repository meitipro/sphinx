/**
 * Walk the reviewer's path on the live site from accounts that have never
 * touched the contract, through the site's own code: the faucet route of the
 * deployed site, lib/hash.mjs for the lock and the seals, and
 * lib/genlayer-core.mjs for every write (the file the browser runs), signed
 * by a stand-in EIP-1193 wallet.
 *
 *   node scripts/reviewer-path.mjs [run name]     # run or resume; waits out the one-hour windows
 *
 * faucet -> host a riddle -> refusals (the host plays, a wrong fee, an early
 * host reveal) -> two players seal -> sealing closes -> host reveals -> players
 * reveal -> the window ends -> judge -> the winner claims -> finality -> the
 * balances are reconciled to the wei from every transaction's own fee
 * accounting. Every step is written to docs/reviewer-path.studio-next.json
 * before it is printed; keys never leave ~/.sphinx/accounts.json.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { CONTRACT, EXPLORER, outcomeOf, readClient, submit, waitDecided, waitFinal, walletClient } from '../lib/genlayer-core.mjs';
import { lockOf, sealOf } from '../lib/hash.mjs';
import { balanceOf, ensureAccount, rpc, standinWallet } from './standin-wallet.mjs';

const SITE = process.env.SPHINX_SITE ?? 'https://sphinx-genlayer.vercel.app';
const run = process.argv[2] ?? 'rp1';
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const RECORD = path.join(here, '..', '..', 'docs', 'reviewer-path.studio-next.json');
const GEN = 10n ** 18n;
const MARGIN = 45;

const RIDDLE = {
  text: "I'm tall when I'm young and short when I'm old. What am I?",
  answer: 'A candle',
  notes: 'Any candle, in any language. A match is close: it burns down too, but it is never tall. A tree is wrong.',
  prize: 10n * GEN,
  fee: GEN / 2n,
};
const PLAYS = { alice: 'una vela', bob: 'a matchstick' };

const record = fs.existsSync(RECORD) ? JSON.parse(fs.readFileSync(RECORD, 'utf8')) : { runs: {} };
const log = (record.runs[run] ??= { site: SITE, contract: CONTRACT, started_at: new Date().toISOString(), accounts: {}, steps: [], secrets_local: true });
const save = () => fs.writeFileSync(RECORD, JSON.stringify(record, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2) + '\n');

// Salts stay on this machine until their reveal; the public record gets them once the contract has made them public.
const secretFile = path.join(process.env.USERPROFILE ?? process.env.HOME ?? '.', '.sphinx', `${run}-tickets.json`);
const secrets = fs.existsSync(secretFile) ? JSON.parse(fs.readFileSync(secretFile, 'utf8')) : {};
const saveSecrets = () => fs.writeFileSync(secretFile, JSON.stringify(secrets, null, 2) + '\n', { mode: 0o600 });

const who = {};
for (const name of ['host', 'alice', 'bob']) {
  const address = ensureAccount(`${run}_${name}`);
  who[name] = { name: `${run}_${name}`, address };
  log.accounts[name] = address;
}
save();

const reader = readClient();
async function view(method, args) {
  for (let i = 1; ; i++) {
    try {
      return JSON.parse(String(await reader.readContract({ address: CONTRACT, functionName: method, args })));
    } catch (error) {
      if (i >= 6) throw error;
      await new Promise((r) => setTimeout(r, 4000 * i));
    }
  }
}

function done(key) {
  return log.steps.find((s) => s.key === key);
}

async function step(key, name, method, args, value = 0n, expectRefusal = false) {
  const found = done(key);
  if (found) return found;
  const { address, provider } = standinWallet(who[name].name);
  const client = walletClient(address, provider);
  const started = Date.now();
  const hash = await submit(client, { method, args, value, sender: address });
  const row = { key, method, from: address, hash, value: value.toString(), sent_at: new Date().toISOString() };
  log.steps.push(row);
  save();
  const outcome = outcomeOf(await waitDecided(client, hash, method));
  Object.assign(row, { ok: outcome.ok, status: outcome.status, returned: outcome.returned ?? null, refusal: outcome.refusal || null, expected: expectRefusal ? 'refusal' : 'success', seconds: Math.round((Date.now() - started) / 1000) });
  save();
  console.log(`  ${key}: ${method} ${outcome.ok ? 'ok -> ' + JSON.stringify(outcome.returned) : 'refused: ' + outcome.refusal}\n    ${EXPLORER}/tx/${hash}`);
  if (outcome.ok === expectRefusal) throw new Error(`${key}: expected ${expectRefusal ? 'a refusal' : 'success'}`);
  return row;
}

async function waitUntil(seconds, what) {
  for (;;) {
    const left = seconds + MARGIN - Math.floor(Date.now() / 1000);
    if (left <= 0) return;
    console.log(`  waiting ${Math.floor(left / 60)} min ${left % 60} s for ${what}`);
    await new Promise((r) => setTimeout(r, Math.min(left, 300) * 1000));
  }
}

// 1. The faucet, through the deployed site's own route.
for (const name of Object.keys(who)) {
  const key = `faucet-${name}`;
  if (done(key)) continue;
  const response = await fetch(`${SITE}/api/faucet`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: who[name].address.toLowerCase() }) });
  const body = await response.json();
  const read_after = (await balanceOf(who[name].address)).toString();
  log.steps.push({ key, method: 'faucet', http: response.status, before: body.before ?? null, after: body.after ?? null, read_after, error: body.error ?? null, at: new Date().toISOString() });
  save();
  console.log(`  ${key}: HTTP ${response.status} ${body.error ?? ''} balance ${Number(BigInt(read_after)) / 1e18} GEN`);
  if (!response.ok) throw new Error(`faucet for ${name} answered ${response.status}`);
}

// 2. Host a riddle with the shortest windows.
secrets.host_salt ??= crypto.randomUUID();
saveSecrets();
const lock = await lockOf(RIDDLE.answer, RIDDLE.notes, secrets.host_salt);
const created = await step('create', 'host', 'create_riddle', [RIDDLE.text, lock, 'FIRST_N', 1, RIDDLE.fee, 1, 1, 10], RIDDLE.prize);
const rid = Number(created.returned);
log.riddle_id = rid;
save();

// 3. Refusals a reviewer should see, then two seals.
await step('host-plays', 'host', 'commit', [rid, await sealOf(RIDDLE.answer, 'host-salt-0001', who.host.address)], RIDDLE.fee, true);
await step('wrong-fee', 'alice', 'commit', [rid, await sealOf(PLAYS.alice, 'any-salt-0001', who.alice.address)], RIDDLE.fee - 1n, true);
await step('early-host-reveal', 'host', 'host_reveal', [rid, RIDDLE.answer, RIDDLE.notes, secrets.host_salt], 0n, true);
for (const [name, answer] of Object.entries(PLAYS)) {
  secrets[name] ??= { answer, salt: crypto.randomUUID() };
  saveSecrets();
  await step(`seal-${name}`, name, 'commit', [rid, await sealOf(answer, secrets[name].salt, who[name].address)], RIDDLE.fee);
}

// 4. Reveal after sealing closes.
let riddle = await view('get_riddle', [rid]);
await waitUntil(riddle.seal_end, 'sealing to close');
await step('host-reveal', 'host', 'host_reveal', [rid, RIDDLE.answer, RIDDLE.notes, secrets.host_salt]);
for (const name of Object.keys(PLAYS)) await step(`reveal-${name}`, name, 'reveal', [rid, secrets[name].answer, secrets[name].salt]);

// 5. Judge after the window, by a player, then the winner claims.
await waitUntil(riddle.reveal_end, 'the reveal window to end');
for (let i = 1; (await view('get_riddle', [rid])).status === 'OPEN'; i++) {
  if (i > 4) throw new Error('four judge calls without settling');
  const row = await step(`judge-${i}`, 'bob', 'judge', [rid]);
  if (!row.ok) await new Promise((r) => setTimeout(r, 60000));
}
riddle = await view('get_riddle', [rid]);
log.labels = Object.fromEntries(riddle.entries_list.map((e) => [e.player, { answer: e.answer, status: e.status, rank: e.rank, payout: e.payout, refund: e.refund }]));
save();
for (const name of ['alice', 'bob', 'host']) {
  const account = await view('get_entry', [0, who[name].address.toLowerCase()]);
  const key = `claim-${name}`;
  if (BigInt(account.balance) === 0n && !done(key)) {
    log.steps.push({ key, method: 'claim', skipped: 'nothing credited', at: new Date().toISOString() });
    save();
    continue;
  }
  const row = await step(key, name, 'claim', []);
  if (row.ok && !row.final_status) {
    const { address, provider } = standinWallet(who[name].name);
    row.final_status = outcomeOf(await waitFinal(walletClient(address, provider), row.hash)).status;
    row.paid_by_contract = String(row.returned);
    save();
  }
}

// 6. Reconcile every account over the whole run, once everything has settled.
await new Promise((r) => setTimeout(r, 90000));
const out = {};
for (const name of Object.keys(who)) {
  const address = who[name].address;
  let expected = BigInt(done(`faucet-${name}`).read_after);
  const rows = [];
  for (const s of log.steps.filter((x) => x.hash && x.from === address)) {
    const tx = await rpc('eth_getTransactionByHash', [s.hash]);
    const acct = tx?.data?.fee_accounting ?? {};
    const net = (acct.top_ups ?? []).reduce((a, t) => a + BigInt(t.primaryAmount ?? 0), 0n) - (acct.refunds ?? []).reduce((a, r) => a + BigInt(r.primary ?? 0), 0n);
    // A refused write is rolled back with its value: only a write that returned kept what it carried.
    const value = s.ok ? BigInt(s.value ?? 0) : 0n;
    expected -= value + net;
    if (s.method === 'claim' && s.ok) expected += BigInt(s.returned);
    rows.push({ key: s.key, value: value.toString(), fee_net: net.toString(), fee_status: acct.status ?? null });
  }
  const now = await balanceOf(address);
  out[name] = { address, expected: expected.toString(), balance: now.toString(), difference: (now - expected).toString(), transactions: rows };
  console.log(`  ${name}: expected ${Number(expected) / 1e18} GEN, balance ${Number(now) / 1e18} GEN, difference ${now - expected} wei`);
}
log.reconciliation = { at: new Date().toISOString(), accounts: out };
log.revealed_tickets = { host_salt: secrets.host_salt, ...Object.fromEntries(Object.keys(PLAYS).map((n) => [n, secrets[n]])) };
log.finished_at = new Date().toISOString();
save();
console.log(`done: riddle ${rid}, ${SITE}/r/${rid}`);
