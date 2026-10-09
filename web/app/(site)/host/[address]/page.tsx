import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Addr, Empty, ReadError, RiddleRow } from '@/components/ui';
import { gen, plural, short } from '@/lib/format';
import { hostRecords } from '@/lib/hosts';
import { allRiddles, readError } from '@/lib/read';
import { nowSeconds } from '@/lib/riddle';
import type { Riddle } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: PageProps<'/host/[address]'>): Promise<Metadata> {
  const { address } = await props.params;
  return { title: `Host ${short(address)}`, description: 'Riddles hosted, revealed on time, solved rate and prizes paid.' };
}

export default async function HostPage(props: PageProps<'/host/[address]'>) {
  const { address } = await props.params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) notFound();
  const now = nowSeconds();
  let mine: Riddle[] = [];
  let error = '';
  try {
    mine = (await allRiddles()).filter((r) => r.host.toLowerCase() === address.toLowerCase());
  } catch (e) {
    error = readError(e);
  }
  const record = hostRecords(mine, now)[0];
  return (
    <div className="c-wrap py-12">
      <p className="c-eyebrow">Host record</p>
      <h1 className="c-h2 mono mt-3 break-all">{address}</h1>
      <p className="mt-2">
        <Addr address={address} />
      </p>
      {error && (
        <div className="mt-6">
          <ReadError message={error} />
        </div>
      )}
      <dl className="c-kv mt-8">
        <div>
          <dd className="mono">{record?.hosted ?? 0}</dd>
          <dt>Riddles hosted</dt>
        </div>
        <div>
          <dd className="mono">{record?.due ? `${record.onTime} of ${record.due}` : '—'}</dd>
          <dt>Revealed on time</dt>
        </div>
        <div>
          <dd className="mono">{record?.settled ? `${Math.round((100 * record.solved) / record.settled)}%` : '—'}</dd>
          <dt>Solved rate</dt>
        </div>
        <div>
          <dd className="mono">{gen(record?.paid ?? 0n)}</dd>
          <dt>Prizes paid to winners</dt>
        </div>
      </dl>
      <p className="c-faint mt-3 text-[13px]">
        Revealed on time counts riddles whose sealing has closed. Solved rate counts settled riddles with at least one correct
        answer. Every number is read from the contract.
      </p>
      <h2 className="c-h3 mt-10">{plural(mine.length, 'riddle')} hosted</h2>
      <div className="c-card mt-4 divide-y divide-[var(--line)]">
        {mine.map((r) => (
          <RiddleRow key={r.id} r={r} now={now} />
        ))}
        {mine.length === 0 && !error && (
          <div className="p-4">
            <Empty>This address has not hosted a riddle.</Empty>
          </div>
        )}
      </div>
    </div>
  );
}
