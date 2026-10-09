import type { Metadata } from 'next';

import { HostForm } from '@/components/HostForm';

export const metadata: Metadata = {
  title: 'Host a riddle',
  description: 'Write the riddle, lock the answer and the notes on what counts, fund the prize, and share one link.',
};

export default function NewRiddle() {
  return (
    <div className="c-wrap py-12">
      <p className="c-eyebrow">Host a riddle</p>
      <h1 className="c-h2 mt-3">Lock the answer before anyone plays</h1>
      <p className="c-muted mt-3 max-w-[44em]">
        The riddle is public now. The answer and notes are locked until sealing closes: only their hash, with a random salt,
        goes on chain, and the reveal is checked against it. Nobody, you included, can move the answer after seeing the
        guesses.
      </p>
      <div className="mt-10">
        <HostForm />
      </div>
    </div>
  );
}
