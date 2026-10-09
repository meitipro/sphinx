import type { Metadata } from 'next';
import Link from 'next/link';

import { Addr, Empty, ReadError, RiddleRow } from '@/components/ui';
import { gen, plural } from '@/lib/format';
import { allRiddles, readError } from '@/lib/read';
import { hostRecords } from '@/lib/hosts';
import { nowSeconds, phaseOf, type Phase } from '@/lib/riddle';
import type { Riddle } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Riddles', description: 'Open, revealing and settled riddles, with prize, mode and time left.' };

const GROUPS: { phase: Phase; title: string; blurb: string; id?: string }[] = [
  { phase: 'sealing', title: 'Sealing', blurb: 'Seal an answer with the entry fee. Nobody can read it until sealing closes.' },
  { phase: 'revealing', title: 'Revealing', blurb: 'Sealing has closed. The host and the players open their hashes now.' },
  { phase: 'judging', title: 'Ready to judge', blurb: 'The reveal window has ended. Anyone can send judge to label the next ten answers.' },
  { phase: 'voidable', title: 'Host never revealed', blurb: 'Anyone can void these: every fee comes back and the prize is split among the players who revealed.' },
  { phase: 'settled', title: 'Results', blurb: 'Judged and settled. Winners claim their shares from the contract.', id: 'results' },
  { phase: 'void', title: 'Void', blurb: 'The host never revealed. Fees were refunded and the prize went to the players who revealed.' },
];

export default async function Riddles() {
  const now = nowSeconds();
  let riddles: Riddle[] = [];
  let error = '';
  try {
    riddles = await allRiddles();
  } catch (e) {
    error = readError(e);
  }
  const hosts = hostRecords(riddles, now);
  return (
    <div className="c-wrap py-12">
      <p className="c-eyebrow">Riddles</p>
      <h1 className="c-h2 mt-3">Every riddle, by where it is</h1>
      <p className="c-muted mt-3 max-w-[44em]">
        {plural(riddles.length, 'riddle')} on the contract. Reading needs no wallet. A riddle moves from sealing to revealing to
        judging on the windows its host chose, and the phase here is computed from those windows.
      </p>
      {error && (
        <div className="mt-6">
          <ReadError message={error} />
        </div>
      )}
      {GROUPS.map((g) => {
        const list = riddles.filter((r) => phaseOf(r, now) === g.phase);
        if (list.length === 0 && (g.phase === 'voidable' || g.phase === 'void' || g.phase === 'judging')) return null;
        return (
          <section key={g.phase} id={g.id ?? g.phase} className="mt-12 scroll-mt-24">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="c-h3">{g.title}</h2>
              <span className="c-faint text-[13px]">{plural(list.length, 'riddle')}</span>
            </div>
            <p className="c-muted mt-1 text-[14px]">{g.blurb}</p>
            <div className="c-card mt-4 divide-y divide-[var(--line)]">
              {list.map((r) => (
                <RiddleRow key={r.id} r={r} now={now} />
              ))}
              {list.length === 0 && (
                <div className="p-4">
                  <Empty>
                    {g.phase === 'sealing' ? (
                      <>
                        Nothing is sealing right now. <Link className="c-link" href="/new">Host a riddle</Link>.
                      </>
                    ) : (
                      'None right now.'
                    )}
                  </Empty>
                </div>
              )}
            </div>
          </section>
        );
      })}
      <section id="hosts" className="mt-14 scroll-mt-24">
        <h2 className="c-h3">Hosts</h2>
        <p className="c-muted mt-1 text-[14px]">Every host&apos;s record, read from their riddles: whether they revealed on time, how often their riddles were solved, and what winners were paid.</p>
        <div className="c-card mt-4 overflow-x-auto">
          <table className="c-table min-w-[620px]">
            <thead>
              <tr>
                <th>Host</th>
                <th>Hosted</th>
                <th>Revealed on time</th>
                <th>Solved</th>
                <th>Paid to winners</th>
              </tr>
            </thead>
            <tbody>
              {hosts.map((h) => (
                <tr key={h.host}>
                  <td>
                    <Link className="c-link mono text-[13px]" href={`/host/${h.host}`}>
                      {h.host.slice(0, 8)}…{h.host.slice(-4)}
                    </Link>{' '}
                    <Addr address={h.host} />
                  </td>
                  <td className="mono">{h.hosted}</td>
                  <td className="mono">{h.due ? `${h.onTime} of ${h.due}` : '—'}</td>
                  <td className="mono">{h.settled ? `${h.solved} of ${h.settled}` : '—'}</td>
                  <td className="mono">{gen(h.paid)}</td>
                </tr>
              ))}
              {hosts.length === 0 && (
                <tr>
                  <td colSpan={5} className="c-muted">
                    No host yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
