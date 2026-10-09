import type { Entry, Riddle } from './types';

/**
 * Where a riddle is in its life, from the stored windows and the reader's
 * clock. The contract's views never read the clock (a view has no
 * transaction time), so the phase is computed here, the same way on the
 * server and in the browser.
 */
export type Phase = 'sealing' | 'revealing' | 'judging' | 'voidable' | 'settled' | 'void';

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function phaseOf(r: Pick<Riddle, 'status' | 'seal_end' | 'reveal_end' | 'host_revealed'>, now = nowSeconds()): Phase {
  if (r.status === 'SETTLED') return 'settled';
  if (r.status === 'VOID') return 'void';
  if (now < r.seal_end) return 'sealing';
  if (now < r.reveal_end) return 'revealing';
  return r.host_revealed ? 'judging' : 'voidable';
}

export const PHASE_LABEL: Record<Phase, string> = {
  sealing: 'Sealing',
  revealing: 'Revealing',
  judging: 'Ready to judge',
  voidable: 'Host never revealed',
  settled: 'Settled',
  void: 'Void',
};

export function modeLabel(r: Pick<Riddle, 'mode' | 'winners_n'>): string {
  return r.mode === 'FIRST_N' ? `First ${r.winners_n} correct` : 'Split all';
}

/** Batches still to judge: revealed answers not yet labelled, in tens. */
export function batchesLeft(r: Pick<Riddle, 'revealed' | 'judged'>): number {
  return Math.ceil(Math.max(0, r.revealed - r.judged) / 10);
}

/** Answers labelled CORRECT that are paid, in seal order. */
export function winners(entries: Entry[]): Entry[] {
  return entries.filter((e) => e.status === 'CORRECT' && BigInt(e.payout) > 0n);
}

/** The riddles the golden evaluation and the site's own tests post, which the landing page leaves out of the hero. */
export function isEval(r: Pick<Riddle, 'max_entries' | 'host'>, evalHost: string): boolean {
  return r.host.toLowerCase() === evalHost.toLowerCase();
}
