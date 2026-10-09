'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import contract from '@/lib/contract.generated.json';
import { gen, hashShort, toWei } from '@/lib/format';
import { answerProblem, lockOf, newSalt } from '@/lib/hash.mjs';
import { downloadTicket, findTicket, saveTicket, setRiddleId, type Ticket } from '@/lib/tickets';
import { refreshReads, send, type TxState } from '@/lib/write';

import { TxStatus } from './TxStatus';
import { LabelBadge } from './ui';
import { WalletGate, useWallet } from './Wallet';

const L = contract.limits;

type Preview = { samples: string[]; labels: string[]; model: string } | { error: string } | null;

export function HostForm() {
  const router = useRouter();
  const w = useWallet();
  const [text, setText] = useState('');
  const [answer, setAnswer] = useState('');
  const [notes, setNotes] = useState('');
  const [samples, setSamples] = useState(['', '', '']);
  const [preview, setPreview] = useState<Preview>(null);
  const [previewing, setPreviewing] = useState(false);
  const [mode, setMode] = useState<'FIRST_N' | 'SPLIT_ALL'>('FIRST_N');
  const [winners, setWinners] = useState('5');
  const [prize, setPrize] = useState('10');
  const [fee, setFee] = useState('0.5');
  const [sealHours, setSealHours] = useState('1');
  const [revealHours, setRevealHours] = useState('1');
  const [maxEntries, setMaxEntries] = useState('200');
  const [salt, setSalt] = useState('');
  const [lock, setLock] = useState('');
  const [tx, setTx] = useState<TxState>({ phase: 'idle' });

  useEffect(() => setSalt(newSalt()), []);

  const cleanAnswer = answer.trim();
  const cleanNotes = notes.trim();
  useEffect(() => {
    let live = true;
    if (!salt) return;
    lockOf(cleanAnswer, cleanNotes, salt).then((h: string) => live && setLock(h));
    return () => {
      live = false;
    };
  }, [cleanAnswer, cleanNotes, salt]);

  const ticket: Ticket | null = useMemo(
    () =>
      salt && lock
        ? {
            kind: 'host',
            contract: '',
            chainId: 0,
            riddleId: null,
            account: w.account.toLowerCase(),
            answer: cleanAnswer,
            notes: cleanNotes,
            salt,
            hash: lock,
            riddle: text.trim().slice(0, 140),
            savedAt: new Date().toISOString(),
          }
        : null,
    [salt, lock, w.account, cleanAnswer, cleanNotes, text],
  );

  const prizeWei = toWei(prize);
  const feeWei = toWei(fee);
  const n = Number(winners);
  const hoursS = Number(sealHours);
  const hoursR = Number(revealHours);
  const max = Number(maxEntries);
  const problems: string[] = [];
  if (!text.trim()) problems.push('Write the riddle.');
  if (text.trim().length > L.riddle) problems.push(`The riddle is at most ${L.riddle} characters.`);
  if (!cleanAnswer) problems.push('Write the answer.');
  const ap = answerProblem(cleanAnswer, L.answer);
  if (ap) problems.push(`Answer: ${ap}`);
  if (cleanNotes.length > L.notes) problems.push(`The notes are at most ${L.notes} characters.`);
  if (!prizeWei || prizeWei <= 0n) problems.push('Set a prize above zero.');
  if (!feeWei || feeWei <= 0n) problems.push('Set an entry fee above zero.');
  if (!Number.isInteger(hoursS) || hoursS < L.minHours || hoursS > L.maxSealHours) problems.push(`Sealing lasts ${L.minHours} to ${L.maxSealHours} hours.`);
  if (!Number.isInteger(hoursR) || hoursR < L.minHours || hoursR > L.maxRevealHours) problems.push(`The reveal lasts ${L.minHours} to ${L.maxRevealHours} hours.`);
  if (!Number.isInteger(max) || max < 1 || max > L.entries) problems.push(`At most ${L.entries} entries.`);
  if (mode === 'FIRST_N' && (!Number.isInteger(n) || n < 1 || n > max)) problems.push('First N pays 1 to the maximum number of entries.');
  const busy = tx.phase === 'signing' || tx.phase === 'deciding';

  async function tryNotes() {
    setPreviewing(true);
    setPreview(null);
    try {
      const response = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riddle: text, answer: cleanAnswer, notes: cleanNotes, samples: samples.map((s) => s.trim()).filter(Boolean) }),
      });
      setPreview(await response.json());
    } catch {
      setPreview({ error: 'The preview did not answer.' });
    } finally {
      setPreviewing(false);
    }
  }

  async function submit() {
    if (!ticket || problems.length) return;
    // The host ticket is kept before anything is signed: without the salt the
    // host cannot reveal, and a host who never reveals loses the prize.
    if (!saveTicket({ ...ticket, account: w.account.toLowerCase() })) {
      return setTx({ phase: 'error', message: 'This browser refused to save the ticket. Download it first, or allow site storage.' });
    }
    const args = [text.trim(), lock, mode, mode === 'FIRST_N' ? n : 0, feeWei!, hoursS, hoursR, max];
    const state = await send(w.account, 'create_riddle', args, prizeWei!, setTx);
    if (state.phase === 'done' && typeof state.returned === 'number') {
      setRiddleId(lock, state.returned);
      await refreshReads(['riddles', `account:${w.account.toLowerCase()}`]);
      router.push(`/r/${state.returned}`);
    }
  }

  const sampleLabels = preview && 'labels' in preview ? preview.labels : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col gap-6">
        <div>
          <label className="c-label" htmlFor="riddle">
            Riddle, public now
          </label>
          <textarea id="riddle" className="c-textarea serif !text-[19px]" maxLength={L.riddle} value={text} onChange={(e) => setText(e.target.value)} placeholder="I have keys but open no locks…" />
          <p className="c-faint mt-1 text-[12.5px]">
            {text.trim().length}/{L.riddle}. Write a riddle, not a lookup: nobody can see what players search.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div>
            <label className="c-label" htmlFor="answer">
              Answer, locked
            </label>
            <input id="answer" className="c-input" maxLength={L.answer} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="A keyboard" />
            <p className="c-faint mt-1 text-[12.5px]">{cleanAnswer.length}/{L.answer}. No bar, |.</p>
          </div>
          <div>
            <label className="c-label" htmlFor="notes">
              Notes on what counts, locked
            </label>
            <textarea id="notes" className="c-textarea" maxLength={L.notes} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any computer keyboard, in any language. A piano is close: keys, but no space or enter. Two guesses in one answer are wrong." />
            <p className="c-faint mt-1 text-[12.5px]">
              {cleanNotes.length}/{L.notes}. The notes decide edge cases: typos, languages, near misses.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <span className="c-label">Mode</span>
            <div className="flex gap-2">
              {(['FIRST_N', 'SPLIT_ALL'] as const).map((m) => (
                <button key={m} type="button" className={`c-btn small flex-1 ${mode === m ? 'solid' : ''}`} onClick={() => setMode(m)} aria-pressed={mode === m}>
                  {m === 'FIRST_N' ? 'First N' : 'Split all'}
                </button>
              ))}
            </div>
          </div>
          {mode === 'FIRST_N' && (
            <Field id="n" label="N, winners paid" value={winners} onChange={setWinners} />
          )}
          <Field id="max" label="Maximum entries" value={maxEntries} onChange={setMaxEntries} />
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field id="prize" label="Prize, GEN" value={prize} onChange={setPrize} />
          <Field id="fee" label="Entry fee, GEN" value={fee} onChange={setFee} />
          <Field id="seal" label="Sealing, hours" value={sealHours} onChange={setSealHours} />
          <Field id="reveal" label="Reveal, hours" value={revealHours} onChange={setRevealHours} />
        </div>
        <p className="c-faint -mt-3 text-[13px]">
          One hour is the shortest window; a weekly riddle might seal for 48 hours and reveal for 24. The faucet pays 20 test
          GEN, so the prize starts at 10. The pot is the prize plus every entry fee, in equal shares to the winners. If nobody is correct, every fee is refunded
          and you get the prize back.
        </p>

        <div className="c-card pad">
          <p className="c-eyebrow">Who sees what, and when</p>
          <dl className="mt-3 grid gap-4 text-[14px] sm:grid-cols-3">
            <div>
              <dt className="font-medium">Now</dt>
              <dd className="c-muted mt-1">The riddle, prize, fee, mode, windows and the lock hash.</dd>
            </div>
            <div>
              <dt className="font-medium">While sealing</dt>
              <dd className="c-muted mt-1">How many sealed, and their hashes. Never an answer.</dd>
            </div>
            <div>
              <dt className="font-medium">After sealing</dt>
              <dd className="c-muted mt-1">Your answer and notes, then every player answer and its label.</dd>
            </div>
          </dl>
        </div>
      </div>

      <aside className="flex flex-col gap-4">
        <div className="c-card pad flex flex-col gap-3">
          <p className="c-eyebrow">Try your notes</p>
          {samples.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className="c-input" maxLength={L.answer} value={s} onChange={(e) => setSamples(samples.map((x, j) => (j === i ? e.target.value : x)))} placeholder={['keybaord', 'piano', 'a map'][i]} aria-label={`Sample answer ${i + 1}`} />
              {sampleLabels && sampleLabels[samples.filter((x, j) => j < i && x.trim()).length] && s.trim() && (
                <LabelBadge status={sampleLabels[samples.filter((x, j) => j < i && x.trim()).length] as 'CORRECT'} />
              )}
            </div>
          ))}
          <button className="c-btn" type="button" onClick={tryNotes} disabled={previewing || !text.trim() || !cleanAnswer || !samples.some((s) => s.trim())}>
            {previewing ? 'Asking one model…' : 'Try the notes'}
          </button>
          {preview && 'error' in preview && <p className="c-faint text-[13px]">{preview.error}</p>}
          <p className="c-faint text-[12.5px]">One model, with the contract&apos;s own prompt. A preview only: not binding, not stored, and not the validators.</p>
        </div>

        <div className="c-card pad flex flex-col gap-2">
          <p className="c-eyebrow">Your host ticket</p>
          <p className="c-muted text-[13.5px]">
            Answer, notes and a random salt. You need it to reveal, and a host who never reveals loses the prize to the players.
          </p>
          <p className="c-hash">salt {salt ? hashShort(salt) : '…'}</p>
          <p className="c-hash">lock {lock ? hashShort(lock) : '…'}</p>
          <div className="flex flex-wrap items-center gap-3">
            <button className="c-btn small" type="button" disabled={!ticket || !cleanAnswer} onClick={() => ticket && downloadTicket({ ...ticket, account: w.account.toLowerCase(), riddleId: findTicket('host', { hash: lock })?.riddleId ?? null })}>
              Download ticket
            </button>
            <span className="c-faint text-[12.5px]">Also saved in this browser when you lock</span>
          </div>
        </div>

        <WalletGate action="host a riddle">
          <button className="c-btn solid wide" onClick={submit} disabled={busy || problems.length > 0 || !ticket}>
            Lock the answer and fund {prizeWei ? gen(prizeWei) : 'the prize'}
          </button>
          <p className="c-faint text-[12.5px]">Network fee estimated by your wallet.</p>
        </WalletGate>
        {problems.length > 0 && (text || answer) && (
          <ul className="c-faint list-disc pl-5 text-[13px]">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <TxStatus state={tx} onRetry={() => setTx({ phase: 'idle' })} />
      </aside>
    </div>
  );
}

function Field({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="c-label" htmlFor={id}>
        {label}
      </label>
      <input id={id} className="c-input mono" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
