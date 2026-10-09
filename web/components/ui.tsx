import Link from 'next/link';

import { DEPLOYMENT } from '@/lib/genlayer-core.mjs';
import { gen, hashShort, left, plural, short, shortHash } from '@/lib/format';
import { PHASE_LABEL, modeLabel, phaseOf, type Phase } from '@/lib/riddle';
import type { Entry, EntryStatus, Riddle } from '@/lib/types';

export const EXPLORER = DEPLOYMENT.explorer as string;
export const CONTRACT = DEPLOYMENT.sphinx as string;

export function txUrl(hash: string): string {
  return `${EXPLORER}/tx/${hash}`;
}

export function addressUrl(address: string): string {
  return `${EXPLORER}/address/${address}`;
}

export function Tx({ hash, label }: { hash: string; label?: string }) {
  if (!hash) return null;
  return (
    <a className="c-link mono text-[12.5px]" href={txUrl(hash)} target="_blank" rel="noreferrer">
      {label ? `${label} ` : ''}
      {shortHash(hash)} ↗
    </a>
  );
}

export function Addr({ address, you = false }: { address: string; you?: boolean }) {
  if (!address) return null;
  return (
    <a className="c-link mono text-[12.5px]" href={addressUrl(address)} target="_blank" rel="noreferrer" title={address}>
      {short(address)}
      {you ? ' (you)' : ''}
    </a>
  );
}

const LABEL_CLASS: Record<EntryStatus, string> = {
  CORRECT: 'correct',
  CLOSE: 'close',
  WRONG: 'wrong',
  UNREVEALED: 'unrevealed',
  SEALED: 'sealed',
  REVEALED: 'revealed',
};

/** Orchid for correct, hatched for close, struck through for wrong, dashed for a seal never opened. */
export function LabelBadge({ status }: { status: EntryStatus }) {
  return <span className={`c-label-badge ${LABEL_CLASS[status]}`}>{status.toLowerCase()}</span>;
}

export function PhaseBadge({ r, now }: { r: Pick<Riddle, 'status' | 'seal_end' | 'reveal_end' | 'host_revealed'>; now?: number }) {
  const phase = phaseOf(r, now);
  const live = phase === 'sealing' || phase === 'revealing' || phase === 'judging' || phase === 'voidable';
  return <span className={`c-label-badge ${live ? 'live' : ''}`}>{PHASE_LABEL[phase]}</span>;
}

/** What a player checks first, by phase: the time left, or how it ended. */
export function timeNote(r: Riddle, phase: Phase, now?: number): { value: string; label: string } {
  if (phase === 'sealing') return { value: left(r.seal_end, now), label: 'Sealing left' };
  if (phase === 'revealing') return { value: left(r.reveal_end, now), label: 'Reveal left' };
  if (phase === 'judging') return { value: `${Math.max(0, r.revealed - r.judged)}`, label: 'To judge' };
  if (phase === 'voidable') return { value: 'Void', label: 'Host absent' };
  if (phase === 'void') return { value: 'Void', label: 'Fees refunded' };
  return { value: `${r.correct}`, label: 'Correct' };
}

/** A player's answer as the record shows it: struck through if wrong, hatched if close, the hash while sealed. */
export function AnswerText({ e }: { e: Pick<Entry, 'status' | 'answer' | 'seal'> }) {
  if (e.status === 'SEALED') return <span className="c-hash">sealed {hashShort(e.seal)}</span>;
  if (e.status === 'UNREVEALED') return <span className="c-faint">sealed, never revealed</span>;
  const cls = e.status === 'WRONG' ? 'wrong' : e.status === 'CLOSE' ? 'close' : '';
  return <span className={`c-answer ${cls}`}>&ldquo;{e.answer || ' '}&rdquo;</span>;
}

/** The live riddle card: the riddle, prize, sealed count and time left, and its latest seals. */
export function RiddleCard({ r, now, seals = [] as Entry[], title }: { r: Riddle; now?: number; seals?: Entry[]; title?: string }) {
  const phase = phaseOf(r, now);
  const note = timeNote(r, phase, now);
  return (
    <Link href={`/r/${r.id}`} className="c-card block p-5 transition-colors hover:border-[var(--line-strong)]">
      <div className="flex items-center gap-3">
        <p className="c-eyebrow min-w-0 flex-1 truncate">{title ?? `Riddle #${r.id} · ${modeLabel(r)}`}</p>
        <PhaseBadge r={r} now={now} />
      </div>
      <p className="c-riddle small mt-4">&ldquo;{r.text}&rdquo;</p>
      <div className="mt-5 grid grid-cols-3 gap-3">
        <div>
          <p className="mono text-[24px] font-medium">{gen(r.prize, false)}</p>
          <p className="c-eyebrow mt-1">Prize, GEN</p>
        </div>
        <div>
          <p className="mono text-[24px] font-medium">{r.entries}</p>
          <p className="c-eyebrow mt-1">Sealed</p>
        </div>
        <div>
          <p className="mono text-[24px] font-medium">{note.value}</p>
          <p className="c-eyebrow mt-1">{note.label}</p>
        </div>
      </div>
      {seals.length > 0 && (
        <div className="mt-5 flex flex-col gap-1.5 border-t border-[var(--line)] pt-4 text-[13px]">
          {seals.slice(0, 3).map((e) => (
            <div key={e.number} className="flex items-center gap-3">
              <span className="mono c-faint w-10">#{e.number}</span>
              <span className="mono c-muted">{short(e.player, 5, 2)}</span>
              <span className="ml-auto">
                {e.status === 'SEALED' ? <span className="c-hash">sealed {hashShort(e.seal)}</span> : <LabelBadge status={e.status} />}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 flex items-center gap-2 border-t border-[var(--line)] pt-3">
        <span className="c-eyebrow">Host answer locked</span>
        <span className="c-hash ml-auto">{hashShort(r.lock)}</span>
      </div>
    </Link>
  );
}

/** One riddle in a list: its text, phase, prize and counts. */
export function RiddleRow({ r, now }: { r: Riddle; now?: number }) {
  const phase = phaseOf(r, now);
  const note = timeNote(r, phase, now);
  return (
    <Link href={`/r/${r.id}`} className="c-row-link grid gap-2 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="c-faint text-[12.5px]">
          #{r.id} · {modeLabel(r)} · {gen(r.entry_fee)} to play · host {short(r.host)}
        </p>
        <p className="serif mt-1 truncate text-[19px]">&ldquo;{r.text}&rdquo;</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-[13px]">
        <span className="mono">{gen(r.pot)}</span>
        <span className="c-faint">{plural(r.entries, 'seal')}</span>
        <span className="c-faint">
          {note.label}: <span className="mono c-muted">{note.value}</span>
        </span>
        <PhaseBadge r={r} now={now} />
      </div>
    </Link>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="c-note">{children}</div>;
}

export function ReadError({ message }: { message: string }) {
  return (
    <div className="c-card pad">
      <p className="font-medium">The chain did not answer.</p>
      <p className="c-muted mt-1 text-[14px]">{message}</p>
    </div>
  );
}
