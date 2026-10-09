'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { gen, hashShort } from '@/lib/format';
import { phaseOf, PHASE_LABEL } from '@/lib/riddle';
import { downloadTicket, loadTickets, parseTicket, saveTicket, type Ticket } from '@/lib/tickets';
import type { Riddle } from '@/lib/types';
import { refreshReads, send, type TxState } from '@/lib/write';

import { useAccount, useTickets } from './RiddleActions';
import { TxStatus } from './TxStatus';
import { AnswerText, LabelBadge } from './ui';
import { WalletGate, useWallet } from './Wallet';

/**
 * The player page: this browser's tickets, the connected account's entries and
 * labels, its balance and the claim, with a warning for every ticket whose
 * answer is still sealed while its reveal window is open.
 */
export function Mine({ riddles }: { riddles: Riddle[] }) {
  const w = useWallet();
  const version = useTickets();
  const { data, reload } = useAccount(w.account);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [tx, setTx] = useState<TxState>({ phase: 'idle' });
  const [note, setNote] = useState('');
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => setTickets(loadTickets()), [version]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 15000);
    return () => clearInterval(timer);
  }, []);

  const byId = new Map(riddles.map((r) => [r.id, r]));
  const byLock = new Map(riddles.map((r) => [r.lock, r]));
  const entries = data?.entries ?? [];
  const sealedBy = new Map(entries.map((e) => [e.seal, e]));
  const balance = BigInt(data?.balance ?? '0');

  const urgent = tickets.filter((t) => {
    const r = t.kind === 'host' ? byLock.get(t.hash) : t.riddleId ? byId.get(t.riddleId) : undefined;
    if (!r || phaseOf(r, now) !== 'revealing') return false;
    return t.kind === 'host' ? !r.host_revealed : sealedBy.get(t.hash)?.status === 'SEALED';
  });

  async function claim() {
    const state = await send(w.account, 'claim', [], 0n, setTx);
    if (state.phase === 'done' || state.phase === 'refused') {
      await refreshReads(['riddles', `account:${w.account.toLowerCase()}`]);
      reload();
      w.refreshBalance();
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {urgent.length > 0 && (
        <div className="c-note accent">
          <span className="font-medium">Unopened tickets.</span> {urgent.length === 1 ? 'One ticket is' : `${urgent.length} tickets are`} still sealed while the reveal window is open. An
          unopened answer can&apos;t win, and a host who doesn&apos;t reveal loses the prize:{' '}
          {urgent.map((t, i) => {
            const r = t.kind === 'host' ? byLock.get(t.hash) : byId.get(t.riddleId ?? 0);
            return r ? (
              <span key={t.hash}>
                {i > 0 ? ', ' : ''}
                <Link className="c-link" href={`/r/${r.id}`}>
                  riddle #{r.id}
                </Link>
              </span>
            ) : null;
          })}
          .
        </div>
      )}

      <section className="c-card pad flex flex-col gap-3">
        <p className="c-eyebrow">Balance</p>
        <WalletGate action="see your balance and claim">
          <p className="mono text-[30px] font-medium">{gen(balance)}</p>
          <p className="c-faint text-[13px]">
            Shares and refunds credited on every riddle, not yet claimed. Claimed so far: {gen(data?.claimed ?? '0')}.
          </p>
          {balance > 0n && (
            <button className="c-btn solid w-fit" onClick={claim} disabled={tx.phase === 'signing' || tx.phase === 'deciding'}>
              Claim {gen(balance)}
            </button>
          )}
          <TxStatus state={tx} onRetry={() => setTx({ phase: 'idle' })} />
        </WalletGate>
      </section>

      <section>
        <h2 className="c-h3">My entries</h2>
        <p className="c-muted mt-1 text-[14px]">Every answer the connected account sealed, read from the contract.</p>
        <div className="c-card mt-4 divide-y divide-[var(--line)]">
          {entries.map((e) => {
            const r = byId.get(e.riddle_id);
            return (
              <Link key={`${e.riddle_id}-${e.number}`} href={`/r/${e.riddle_id}`} className="c-row-link flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="mono c-faint">#{e.riddle_id}</span>
                <span className="min-w-0 flex-1 truncate">
                  <AnswerText e={e} />
                </span>
                {r && <span className="c-faint text-[12.5px]">{PHASE_LABEL[phaseOf(r, now)]}</span>}
                {e.status !== 'SEALED' && <LabelBadge status={e.status} />}
                {BigInt(e.payout) > 0n && <span className="c-win">won {gen(e.payout)}</span>}
                {BigInt(e.refund) > 0n && <span className="c-faint text-[12.5px]">refund {gen(e.refund)}</span>}
              </Link>
            );
          })}
          {w.account && entries.length === 0 && <p className="c-muted p-4 text-[14px]">This account has not sealed an answer yet.</p>}
          {!w.account && <p className="c-muted p-4 text-[14px]">Connect a wallet to see its entries.</p>}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="c-h3">Tickets in this browser</h2>
          <label className="c-chip ml-auto cursor-pointer">
            Load a ticket file
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={async (ev) => {
                const file = ev.target.files?.[0];
                if (!file) return;
                const t = parseTicket(await file.text());
                if (!t) return setNote('That file is not a Sphinx ticket.');
                saveTicket(t);
                setNote('Ticket loaded.');
              }}
            />
          </label>
        </div>
        {note && <p className="c-faint mt-2 text-[13px]">{note}</p>}
        <p className="c-muted mt-1 text-[14px]">
          The answer and salt behind each of your locks and seals. They never leave this browser unless you download them.
        </p>
        <div className="c-card mt-4 divide-y divide-[var(--line)]">
          {tickets.map((t) => {
            const r = t.kind === 'host' ? byLock.get(t.hash) : t.riddleId ? byId.get(t.riddleId) : undefined;
            return (
              <div key={t.hash} className="flex flex-wrap items-center gap-3 px-4 py-3 text-[14px]">
                <span className="c-label-badge">{t.kind}</span>
                {r ? (
                  <Link className="c-link" href={`/r/${r.id}`}>
                    riddle #{r.id}
                  </Link>
                ) : (
                  <span className="c-faint">not on chain yet</span>
                )}
                <span className="min-w-0 flex-1 truncate">&ldquo;{t.answer}&rdquo;</span>
                <span className="c-hash">{t.kind === 'host' ? 'lock' : 'seal'} {hashShort(t.hash)}</span>
                <button className="c-btn small" onClick={() => downloadTicket(t)}>
                  Download
                </button>
              </div>
            );
          })}
          {tickets.length === 0 && <p className="c-muted p-4 text-[14px]">No ticket in this browser.</p>}
        </div>
      </section>
    </div>
  );
}
