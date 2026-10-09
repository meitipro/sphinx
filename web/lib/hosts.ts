import { phaseOf } from './riddle';
import type { Riddle } from './types';

export type HostRow = { host: string; hosted: number; onTime: number; due: number; solved: number; settled: number; paid: bigint };

/** A host's record from their riddles: revealed on time, solved rate and prizes paid to winners. */
export function hostRecords(riddles: Riddle[], now: number): HostRow[] {
  const rows = new Map<string, HostRow>();
  for (const r of riddles) {
    const key = r.host.toLowerCase();
    const row = rows.get(key) ?? { host: r.host, hosted: 0, onTime: 0, due: 0, solved: 0, settled: 0, paid: 0n };
    row.hosted += 1;
    const phase = phaseOf(r, now);
    if (phase !== 'sealing') {
      row.due += 1;
      if (r.host_revealed) row.onTime += 1;
    }
    if (r.status === 'SETTLED') {
      row.settled += 1;
      if (r.correct > 0) row.solved += 1;
      row.paid += BigInt(r.share) * BigInt(r.winners);
    }
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.hosted - a.hosted);
}
