import type { Metadata } from 'next';

import { Mine } from '@/components/Mine';
import { ReadError } from '@/components/ui';
import { allRiddles, readError } from '@/lib/read';
import type { Riddle } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'My tickets', description: 'Your tickets, entries, labels, balance and claim.' };

export default async function Me() {
  let riddles: Riddle[] = [];
  let error = '';
  try {
    riddles = await allRiddles();
  } catch (e) {
    error = readError(e);
  }
  return (
    <div className="c-wrap py-12">
      <p className="c-eyebrow">Player page</p>
      <h1 className="c-h2 mt-3">My tickets and answers</h1>
      {error && (
        <div className="mt-6">
          <ReadError message={error} />
        </div>
      )}
      <div className="mt-8">
        <Mine riddles={riddles} />
      </div>
    </div>
  );
}
