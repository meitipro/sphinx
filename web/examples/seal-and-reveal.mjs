/**
 * Seal an answer to a riddle, then reveal it after sealing closes, from your
 * own code, with genlayer-js and a wallet.
 *
 *   node examples/seal-and-reveal.mjs seal <riddle id> "<answer>" [account name]
 *   node examples/seal-and-reveal.mjs reveal <riddle id> [account name]
 *
 * In a browser the provider is window.ethereum and the account is the one the
 * wallet connected. Here a stand-in wallet signs for a local test account, so
 * the same code runs from a terminal. The ticket (answer and salt) is written
 * to a local file before the seal is signed: without the salt the answer can
 * never be opened. This file is the sample on the docs page "Quickstart: play
 * your first riddle", copied in by scripts/gen_docs.py.
 */
import fs from 'node:fs';

import { createClient } from 'genlayer-js';
import { studioDevnet } from 'genlayer-js/chains';

import { sealOf } from '../lib/hash.mjs';
import { standinWallet } from '../scripts/standin-wallet.mjs';

const SPHINX = '0x864906361b22e044d363083cad710366E8AfECD1';
const chain = { ...studioDevnet, id: 61997, rpcUrls: { default: { http: ['https://studio-next.genlayer.com/api'] } } };
const [step, riddleText, ...rest] = process.argv.slice(2);
const riddleId = Number(riddleText);
const name = (step === 'seal' ? rest[1] : rest[0]) ?? 'docs_example';

const { address, provider } = standinWallet(name); // browser: window.ethereum
const client = createClient({ chain, account: address, provider });
const ticketFile = `ticket-${riddleId}-${address.toLowerCase()}.json`;

// Studio Next takes a fee deposit on every write, from the SDK's own estimate.
async function write(functionName, args, value = 0n) {
  const estimate = await client.estimateTransactionFees({
    leaderTimeunitsAllocation: 600,
    validatorTimeunitsAllocation: 600,
    totalMessageFees: 0,
    rotations: [1],
  });
  const hash = await client.writeContract({
    address: SPHINX,
    functionName,
    args,
    value,
    fees: { distribution: estimate.distribution, feeValue: estimate.feeValue },
  });
  const receipt = await client.waitForTransactionReceipt({ hash, waitUntil: 'decided', interval: 4000, retries: 60 });
  const leader = receipt.consensus_data?.leader_receipt?.[0];
  // ACCEPTED is not success on its own: a refusal is accepted too. Check the result.
  if (leader?.execution_result !== 'SUCCESS' || leader.result.status !== 'return') {
    throw new Error(`${functionName} did not return: ${JSON.stringify(leader?.result?.payload ?? receipt.lifecycle)}`);
  }
  return { hash, returned: leader.result.payload.readable };
}

if (step === 'seal') {
  const riddle = JSON.parse(await client.readContract({ address: SPHINX, functionName: 'get_riddle', args: [riddleId] }));
  const answer = rest[0].trim();
  const salt = crypto.randomUUID();
  const seal = await sealOf(answer, salt, address); // sha256 of "answer|salt|address", the address in lower case
  fs.writeFileSync(ticketFile, JSON.stringify({ riddleId, answer, salt, seal }, null, 2)); // keep it before signing
  const sent = await write('commit', [riddleId, seal], BigInt(riddle.entry_fee));
  console.log(JSON.stringify({ step, riddle: riddleId, seal_number: Number(sent.returned), tx: sent.hash, ticket: ticketFile }));
} else {
  const ticket = JSON.parse(fs.readFileSync(ticketFile, 'utf8'));
  const sent = await write('reveal', [riddleId, ticket.answer, ticket.salt]);
  console.log(JSON.stringify({ step, riddle: riddleId, revealed: ticket.answer, tx: sent.hash }));
}
