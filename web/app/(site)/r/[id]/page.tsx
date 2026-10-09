import { createHash } from 'node:crypto';

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CopyLink } from '@/components/CopyLink';
import { RiddleActions } from '@/components/RiddleActions';
import { Addr, AnswerText, Empty, LabelBadge, PhaseBadge, ReadError, Tx } from '@/components/ui';
import { riddleTxs, type ChainTx } from '@/lib/explorer';
import { dayTime, gen, hashShort, plural } from '@/lib/format';
import { getRiddle, readError } from '@/lib/read';
import { modeLabel, nowSeconds, phaseOf } from '@/lib/riddle';
import type { Entry, EntryStatus, RiddleFull } from '@/lib/types';

export const dynamic = 'force-dynamic';

const TABS: { key: string; label: string; match: (e: Entry) => boolean }[] = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'correct', label: 'Correct', match: (e) => e.status === 'CORRECT' },
  { key: 'close', label: 'Close', match: (e) => e.status === 'CLOSE' },
  { key: 'wrong', label: 'Wrong', match: (e) => e.status === 'WRONG' },
  { key: 'unrevealed', label: 'Unrevealed', match: (e) => e.status === 'UNREVEALED' || e.status === 'SEALED' },
];

export async function generateMetadata(props: PageProps<'/r/[id]'>): Promise<Metadata> {
  const { id } = await props.params;
  try {
    const r = await getRiddle(Number(id));
    if (r.found) return { title: `Riddle #${r.id}`, description: r.text };
  } catch {
    /* the page says what went wrong */
  }
  return { title: `Riddle #${id}` };
}

function lockMatches(r: RiddleFull): boolean {
  return createHash('sha256').update(`${r.answer}|${r.notes}|${r.salt}`, 'utf8').digest('hex') === r.lock;
}

function txLabel(t: ChainTx): string {
  return { create_riddle: 'posted and locked', commit: 'sealed', host_reveal: 'host revealed', reveal: 'revealed', judge: 'judged a batch', void: 'voided' }[t.method] ?? t.method;
}

export default async function RiddlePage(props: PageProps<'/r/[id]'>) {
  const { id: raw } = await props.params;
  const search = await props.searchParams;
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) notFound();
  let r: RiddleFull | null = null;
  let error = '';
  try {
    const got = await getRiddle(id);
    if (!got.found) notFound();
    r = got;
  } catch (e) {
    if ((e as { digest?: string })?.digest?.startsWith('NEXT_')) throw e;
    error = readError(e);
  }
  if (!r) {
    return (
      <div className="c-wrap py-12">
        <ReadError message={error} />
      </div>
    );
  }
  const now = nowSeconds();
  const phase = phaseOf(r, now);
  const txs = await riddleTxs(id);
  const tab = TABS.find((t) => t.key === String(search.label ?? 'all')) ?? TABS[0];
  const shown = r.entries_list.filter(tab.match);
  const counts = Object.fromEntries(TABS.map((t) => [t.key, r!.entries_list.filter(t.match).length]));
  const fees = BigInt(r.entry_fee) * BigInt(r.entries);
  const winnerOf = (e: Entry) => (e.status === 'CORRECT' && BigInt(e.payout) > 0n ? e.rank : 0);
  const sealed = r.entries_list.filter((e) => e.status !== 'SEALED' && e.status !== 'UNREVEALED').length;

  return (
    <div className="c-wrap py-10">
      <div className="flex flex-wrap items-center gap-3">
        <p className="c-eyebrow">
          Riddle #{r.id} · {modeLabel(r)} · host <Addr address={r.host} />
        </p>
        <PhaseBadge r={r} now={now} />
        <span className="ml-auto">
          <CopyLink />
        </span>
      </div>
      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <p className="c-riddle">&ldquo;{r.text}&rdquo;</p>

          <div className="c-card mt-8 grid gap-6 p-5 sm:grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)]">
            <div>
              <p className="c-eyebrow">Host answer</p>
              {r.host_revealed ? (
                <>
                  <p className="serif mt-2 text-[24px]">{r.answer}</p>
                  <p className="c-faint mt-2 text-[12.5px]">
                    {lockMatches(r) ? 'matches lock' : 'DOES NOT MATCH the lock'} <span className="c-hash">{hashShort(r.lock)}</span>
                  </p>
                </>
              ) : (
                <>
                  <p className="c-hash mt-2 text-[15px]">locked {hashShort(r.lock)}</p>
                  <p className="c-faint mt-2 text-[12.5px]">
                    {phase === 'sealing' ? 'Behind the lock until sealing closes.' : phase === 'revealing' ? 'The host reveals in this window.' : 'Never revealed.'}
                  </p>
                </>
              )}
            </div>
            <div>
              <p className="c-eyebrow">Notes on what counts</p>
              {r.host_revealed ? (
                <p className="mt-2 whitespace-pre-wrap leading-relaxed">{r.notes || <span className="c-faint">No notes: the judge reads the answer alone.</span>}</p>
              ) : (
                <p className="c-faint mt-2 text-[14px]">Locked with the answer, written before anyone played.</p>
              )}
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-2" role="tablist" aria-label="Answers by label">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={t.key === 'all' ? `/r/${r!.id}` : `/r/${r!.id}?label=${t.key}`}
                scroll={false}
                className={`c-chip ${t.key === tab.key ? '!border-[var(--accent-line)] !text-[var(--accent-ink)]' : ''}`}
                role="tab"
                aria-selected={t.key === tab.key}
              >
                {t.label} {counts[t.key]}
              </Link>
            ))}
          </div>
          <div className="c-card mt-3 divide-y divide-[var(--line)]">
            {shown.map((e) => (
              <div key={e.number} className="grid grid-cols-[44px_minmax(0,1fr)] gap-x-3 gap-y-1 px-4 py-3 sm:grid-cols-[44px_120px_minmax(0,1fr)_auto]">
                <span className="mono c-faint">#{e.number}</span>
                <span className="hidden sm:block">
                  <Addr address={e.player} />
                </span>
                <span className="min-w-0 break-words">
                  <AnswerText e={e} />
                </span>
                <span className="col-start-2 flex items-center gap-2 sm:col-start-auto">
                  <span className="sm:hidden">
                    <Addr address={e.player} />
                  </span>
                  {e.status !== 'SEALED' && <LabelBadge status={e.status as EntryStatus} />}
                  {winnerOf(e) > 0 && <span className="c-win">winner {winnerOf(e)}</span>}
                </span>
              </div>
            ))}
            {shown.length === 0 && (
              <div className="p-4">
                <Empty>{r.entries === 0 ? 'No answer sealed yet.' : 'No answer with this label.'}</Empty>
              </div>
            )}
          </div>
          {r.entries > 0 && (
            <p className="c-faint mt-2 text-[13px]">
              In seal order: First N winners are counted in this order. {r.batches > 0 ? `Judged in ${plural(r.batches, 'batch', 'batches')} of up to ten.` : ''}
            </p>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <div className="c-card pad">
            <p className="c-eyebrow">Pot</p>
            <p className="mono mt-2 text-[32px] font-medium">{gen(r.pot)}</p>
            <p className="c-faint text-[13px]">
              {gen(r.prize)} prize plus {plural(r.entries, 'entry fee')} of {gen(r.entry_fee)}
              {fees > 0n ? '' : ''}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-[14px]">
              <div>
                <dt className="c-eyebrow">Mode</dt>
                <dd>{modeLabel(r)}</dd>
              </div>
              <div>
                <dt className="c-eyebrow">Opened</dt>
                <dd>
                  {sealed} of {r.entries}
                </dd>
              </div>
              <div>
                <dt className="c-eyebrow">Correct</dt>
                <dd>{r.status === 'OPEN' && r.judged === 0 ? '—' : r.correct}</dd>
              </div>
              <div>
                <dt className="c-eyebrow">Each winner</dt>
                <dd className="mono">{r.status === 'SETTLED' && r.winners > 0 ? gen(r.share) : '—'}</dd>
              </div>
              <div>
                <dt className="c-eyebrow">Host revealed</dt>
                <dd>{r.host_revealed ? 'on time' : phase === 'sealing' || phase === 'revealing' ? 'not yet' : 'no'}</dd>
              </div>
              <div>
                <dt className="c-eyebrow">Seats</dt>
                <dd>
                  {r.entries} of {r.max_entries}
                </dd>
              </div>
            </dl>
          </div>

          <RiddleActions riddle={r} entries={r.entries_list} />

          <div className="c-card pad">
            <p className="c-eyebrow">Timeline</p>
            <ol className="mt-3 flex flex-col gap-2 text-[14px]">
              <li>
                <span className="c-faint">{dayTime(r.created_at)}</span> locked, <span className="c-hash">{hashShort(r.lock)}</span>
              </li>
              <li>
                <span className="c-faint">{dayTime(r.seal_end)}</span> sealing {now < r.seal_end ? 'closes' : 'closed'}, {plural(r.entries, 'seal')}
              </li>
              <li>
                <span className="c-faint">{dayTime(r.reveal_end)}</span> reveal {now < r.reveal_end ? 'ends' : 'ended'}
                {now >= r.seal_end ? `, ${r.host_revealed ? 'host and' : 'no host,'} ${r.revealed} player${r.revealed === 1 ? '' : 's'}` : ''}
              </li>
              {r.settled_at > 0 && (
                <li>
                  <span className="c-faint">{dayTime(r.settled_at)}</span> {r.status === 'VOID' ? 'voided' : `judged in ${plural(r.batches, 'batch', 'batches')}, settled`} by{' '}
                  <Addr address={r.settled_by} />
                </li>
              )}
            </ol>
          </div>

          <div className="c-card pad">
            <p className="c-eyebrow">On the explorer</p>
            <div className="mt-3 flex flex-col gap-1.5 text-[13.5px]">
              {txs.slice(0, 12).map((t) => (
                <div key={t.hash} className="flex flex-wrap items-center gap-2">
                  <span className="c-muted">{txLabel(t)}</span>
                  <Tx hash={t.hash} />
                </div>
              ))}
              {txs.length === 0 && <p className="c-faint">The explorer has not indexed this riddle&apos;s transactions yet.</p>}
              {txs.length > 12 && <p className="c-faint">and {txs.length - 12} more</p>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
