'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { gen, hashShort, ordinal } from '@/lib/format';
import { answerProblem, lockOf, newSalt, sealOf } from '@/lib/hash.mjs';
import { batchesLeft, phaseOf } from '@/lib/riddle';
import { downloadTicket, findTicket, onTickets, parseTicket, saveTicket, type Ticket } from '@/lib/tickets';
import type { Account, Entry, Riddle } from '@/lib/types';
import { refreshReads, send, type TxState } from '@/lib/write';

import { TxStatus } from './TxStatus';
import { LabelBadge } from './ui';
import { WalletGate, useWallet } from './Wallet';

/* eslint-disable @typescript-eslint/no-explicit-any */

const IDLE: TxState = { phase: 'idle' };

export function useAccount(address: string): { data: Account | null; reload: () => void } {
  const [data, setData] = useState<Account | null>(null);
  const reload = useCallback(() => {
    if (!address) return setData(null);
    fetch(`/api/account/${address.toLowerCase()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {});
  }, [address]);
  useEffect(() => reload(), [reload]);
  return { data, reload };
}

export function useTickets(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => onTickets(() => setVersion((v) => v + 1)), []);
  return version;
}

/** Load a ticket file, check it opens this hash, and keep it in this browser. */
function TicketImport({ kind, check, onDone }: { kind: Ticket['kind']; check: (t: Ticket) => Promise<boolean>; onDone: () => void }) {
  const [note, setNote] = useState('');
  return (
    <label className="c-chip w-fit cursor-pointer">
      Load a ticket file
      <input
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={async (ev) => {
          const file = ev.target.files?.[0];
          if (!file) return;
          const t = parseTicket(await file.text());
          if (!t || t.kind !== kind) return setNote(`That is not a ${kind} ticket.`);
          if (!(await check(t))) return setNote('That ticket does not open this hash.');
          saveTicket(t);
          setNote('');
          onDone();
        }}
      />
      {note && <span className="c-faint ml-2 normal-case tracking-normal">{note}</span>}
    </label>
  );
}

export function RiddleActions({ riddle: r, entries }: { riddle: Riddle; entries: Entry[] }) {
  const router = useRouter();
  const w = useWallet();
  const ticketsVersion = useTickets();
  const { data: account, reload } = useAccount(w.account);
  const [tx, setTx] = useState<TxState>(IDLE);
  const [answer, setAnswer] = useState('');
  const [sealed, setSealed] = useState<Ticket | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 15000);
    return () => clearInterval(timer);
  }, []);

  const phase = phaseOf(r, now);
  const me = w.account.toLowerCase();
  const mine = entries.find((e) => e.player.toLowerCase() === me);
  const isHost = !!me && r.host.toLowerCase() === me;
  void ticketsVersion;
  const playerTicket = mounted && mine ? findTicket('player', { hash: mine.seal }) : undefined;
  const hostTicket = mounted ? findTicket('host', { hash: r.lock }) : undefined;

  const after = useCallback(
    async (state: TxState) => {
      if (state.phase === 'done' || state.phase === 'refused') {
        await refreshReads(['riddles', `riddle:${r.id}`, ...(me ? [`account:${me}`] : [])]);
        reload();
        w.refreshBalance();
        router.refresh();
      }
    },
    [me, r.id, reload, router, w],
  );

  const run = useCallback(
    async (method: string, args: unknown[], value = 0n) => {
      const state = await send(w.account, method, args, value, setTx);
      await after(state);
      return state;
    },
    [after, w.account],
  );

  async function seal() {
    const text = answer.trim();
    const problem = answerProblem(text);
    if (problem || !text) return setTx({ phase: 'error', message: problem || 'Write an answer first.' });
    const salt = newSalt();
    const hash = await sealOf(text, salt, w.account);
    const ticket = { kind: 'player' as const, riddleId: r.id, account: me, answer: text, salt, hash, riddle: r.text.slice(0, 140) };
    // The ticket is kept before anything is signed: a seal without its salt can never be opened.
    if (!saveTicket(ticket)) {
      return setTx({ phase: 'error', message: 'This browser refused to save the ticket. Allow site storage, then seal again.' });
    }
    setSealed(findTicket('player', { hash }) ?? null);
    const state = await run('commit', [r.id, hash], BigInt(r.entry_fee));
    if (state.phase === 'done') setAnswer('');
  }

  const status = <TxStatus state={tx} onRetry={() => setTx(IDLE)} />;

  // -- sealing ------------------------------------------------------------------
  if (phase === 'sealing') {
    if (isHost) {
      return (
        <Panel title="You host this riddle">
          <p className="c-muted text-[14px]">
            Sealing closes in the window you chose. Then reveal your answer, notes and salt from your host ticket, before the
            reveal window ends, or anyone can void the riddle and the prize goes to the players.
          </p>
          <HostTicketLine ticket={hostTicket} lock={r.lock} />
        </Panel>
      );
    }
    if (mine) {
      return (
        <Panel title={`You sealed answer #${mine.number}`}>
          <p className="c-muted text-[14px]">
            Only its hash is on chain: <span className="c-hash">{hashShort(mine.seal)}</span>. Keep your ticket: without its
            salt the answer can&apos;t be opened, and an unopened answer can&apos;t win. Reveal opens when sealing closes.
          </p>
          <PlayerTicketLine ticket={playerTicket ?? sealed ?? undefined} />
          {status}
        </Panel>
      );
    }
    return (
      <Panel title="Seal your answer">
        <WalletGate action="seal an answer">
          <p className="c-muted text-[14px]">
            One answer per address, with the entry fee of {gen(r.entry_fee)}. Only a hash of your answer, a random salt and your
            address goes on chain, so nobody can read or copy it. One guess: an answer with two is wrong.
          </p>
          <label className="c-label mt-3" htmlFor="answer">
            Your answer
          </label>
          <input
            id="answer"
            className="c-input"
            maxLength={80}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="One answer, any language"
            disabled={tx.phase === 'signing' || tx.phase === 'deciding'}
          />
          <p className="c-faint mt-1 text-[12.5px]">{answer.length}/80</p>
          <div className="c-note mt-3 text-[13px]">
            <span className="font-medium">Keep your ticket.</span> It is saved in this browser before you sign and offered as a
            download. Without it a sealed answer cannot be opened.
          </div>
          <button className="c-btn solid wide mt-4" onClick={seal} disabled={!answer.trim() || tx.phase === 'signing' || tx.phase === 'deciding'}>
            Seal answer and pay {gen(r.entry_fee)}
          </button>
          {sealed && tx.phase !== 'idle' && <PlayerTicketLine ticket={sealed} />}
          <div className="mt-3">{status}</div>
        </WalletGate>
      </Panel>
    );
  }

  // -- revealing ----------------------------------------------------------------
  if (phase === 'revealing') {
    const blocks: React.ReactNode[] = [];
    if (isHost) {
      blocks.push(
        r.host_revealed ? (
          <p key="h" className="c-muted text-[14px]">You revealed the answer. It matches the lock.</p>
        ) : hostTicket ? (
          <div key="h" className="flex flex-col gap-3">
            <p className="c-muted text-[14px]">
              Reveal the answer and notes from your host ticket. They are checked against the lock, {hashShort(r.lock)}.
            </p>
            <button
              className="c-btn solid wide"
              onClick={() => run('host_reveal', [r.id, hostTicket.answer, hostTicket.notes ?? '', hostTicket.salt])}
              disabled={tx.phase === 'signing' || tx.phase === 'deciding'}
            >
              Reveal the answer and notes
            </button>
          </div>
        ) : (
          <div key="h" className="flex flex-col gap-2">
            <p className="c-muted text-[14px]">This browser has no host ticket for this lock. Load the file you downloaded when you posted it.</p>
            <TicketImport kind="host" check={async (t) => (await lockOf(t.answer, t.notes ?? '', t.salt)) === r.lock} onDone={() => setTx(IDLE)} />
          </div>
        ),
      );
    }
    if (mine) {
      blocks.push(
        mine.status !== 'SEALED' ? (
          <p key="p" className="c-muted text-[14px]">
            You revealed &ldquo;{mine.answer}&rdquo;. It is judged after the reveal window ends.
          </p>
        ) : playerTicket ? (
          <div key="p" className="flex flex-col gap-3">
            <p className="c-muted text-[14px]">
              Open your answer, &ldquo;{playerTicket.answer}&rdquo;, before the window ends. An unopened answer can&apos;t win.
            </p>
            <button className="c-btn solid wide" onClick={() => run('reveal', [r.id, playerTicket.answer, playerTicket.salt])} disabled={tx.phase === 'signing' || tx.phase === 'deciding'}>
              Reveal my answer
            </button>
          </div>
        ) : (
          <div key="p" className="flex flex-col gap-2">
            <p className="c-muted text-[14px]">
              <span className="font-medium">Missing ticket.</span> This browser has no ticket for your seal #{mine.number}. Load the file you
              downloaded when you sealed it.
            </p>
            <TicketImport kind="player" check={async (t) => (await sealOf(t.answer, t.salt, w.account)) === mine.seal} onDone={() => setTx(IDLE)} />
          </div>
        ),
      );
    }
    return (
      <Panel title="Reveal">
        <WalletGate action="reveal">
          <p className="c-muted text-[14px]">
            Sealing has closed. The host and the players open their hashes in this window; a reveal that doesn&apos;t match its hash is
            refused.
          </p>
          {blocks.length ? <div className="mt-3 flex flex-col gap-4">{blocks}</div> : <p className="c-faint mt-3 text-[14px]">This account has no seal on this riddle.</p>}
          <div className="mt-3">{status}</div>
        </WalletGate>
      </Panel>
    );
  }

  // -- judging and void ---------------------------------------------------------
  if (phase === 'judging' || phase === 'voidable') {
    const judging = phase === 'judging';
    return (
      <Panel title={judging ? 'Move it forward' : 'The host never revealed'}>
        <p className="c-muted text-[14px]">
          {judging
            ? `Anyone can call judge: it labels the next ten revealed answers in seal order, and the call after the last batch settles the pot. ${r.revealed - r.judged} answers wait, about ${Math.max(1, batchesLeft(r))} call${batchesLeft(r) === 1 ? '' : 's'}.`
            : 'The reveal window ended without the host’s answer. Anyone can void the riddle: every entry fee is refunded and the prize is split among the players who revealed.'}
        </p>
        <div className="mt-3">
          <WalletGate action={judging ? 'send judge' : 'void the riddle'}>
            <button className="c-btn solid wide" onClick={() => run(judging ? 'judge' : 'void', [r.id])} disabled={tx.phase === 'signing' || tx.phase === 'deciding'}>
              {judging ? 'Judge the next ten answers' : 'Void this riddle'}
            </button>
          </WalletGate>
        </div>
        <div className="mt-3">{status}</div>
      </Panel>
    );
  }

  // -- settled or void ----------------------------------------------------------
  const balance = BigInt(account?.balance ?? '0');
  return (
    <Panel title={mine ? 'Your answer' : isHost ? 'Your riddle' : 'Settled'}>
      {mine && (
        <div className="flex flex-col gap-2">
          <p className="serif text-[22px]">{mine.answer ? <>&ldquo;{mine.answer}&rdquo;</> : 'Sealed, never revealed'}</p>
          <div className="flex flex-wrap items-center gap-2 text-[13.5px]">
            <LabelBadge status={mine.status} />
            {mine.status === 'CORRECT' && <span className="c-muted">{ordinal(mine.rank)} correct seal{BigInt(mine.payout) > 0n ? ', a winner' : ', past the paid places'}</span>}
          </div>
          {BigInt(mine.payout) > 0n && <p className="c-muted text-[14px]">Your share: {gen(mine.payout)}.</p>}
          {BigInt(mine.refund) > 0n && <p className="c-muted text-[14px]">Your entry fee comes back: {gen(mine.refund)}.</p>}
        </div>
      )}
      {isHost && BigInt(r.host_payout) > 0n && <p className="c-muted mt-2 text-[14px]">Credited back to you: {gen(r.host_payout)}.</p>}
      {!mine && !isHost && <p className="c-muted text-[14px]">{r.status === 'VOID' ? 'Voided: every fee refunded.' : `${r.winners} winner${r.winners === 1 ? '' : 's'}, ${gen(r.share)} each.`}</p>}
      {w.account && (
        <div className="mt-4 flex flex-col gap-2 border-t border-[var(--line)] pt-4">
          <p className="text-[14px]">
            Unclaimed balance on every riddle: <span className="mono">{gen(balance)}</span>
          </p>
          {balance > 0n && (
            <WalletGate action="claim">
              <button className="c-btn solid wide" onClick={() => run('claim', [])} disabled={tx.phase === 'signing' || tx.phase === 'deciding'}>
                Claim {gen(balance)}
              </button>
            </WalletGate>
          )}
          <Link className="c-link text-[13px]" href="/me">
            My tickets and answers
          </Link>
        </div>
      )}
      <div className="mt-3">{status}</div>
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="c-card pad flex flex-col gap-2">
      <p className="c-eyebrow">{title}</p>
      {children}
    </div>
  );
}

function PlayerTicketLine({ ticket }: { ticket?: Ticket }) {
  if (!ticket) return <p className="c-faint text-[13px]">No ticket for this seal in this browser.</p>;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px]">
      <span className="c-hash">salt {hashShort(ticket.salt)}</span>
      <button className="c-btn small" onClick={() => downloadTicket(ticket)}>
        Download ticket
      </button>
      <span className="c-faint">Also saved in this browser</span>
    </div>
  );
}

function HostTicketLine({ ticket, lock }: { ticket?: Ticket; lock: string }) {
  if (!ticket) {
    return <p className="c-faint text-[13px]">This browser has no host ticket for lock {hashShort(lock)}. Keep the file you downloaded.</p>;
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px]">
      <span className="c-hash">lock {hashShort(lock)}</span>
      <button className="c-btn small" onClick={() => downloadTicket(ticket)}>
        Download host ticket
      </button>
      <span className="c-faint">Also saved in this browser</span>
    </div>
  );
}
