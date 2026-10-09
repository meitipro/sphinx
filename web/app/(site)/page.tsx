import Link from 'next/link';

import { LabelBadge, ReadError, RiddleCard } from '@/components/ui';
import { allRiddles, getRiddle, readError } from '@/lib/read';
import { evalHosts } from '@/lib/records';
import { nowSeconds, phaseOf } from '@/lib/riddle';
import type { Entry, Riddle, RiddleFull } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STEPS = [
  ['01', 'Lock', 'The host locks the answer and the notes on what counts, as a hash, and funds the prize before anyone plays.'],
  ['02', 'Seal', 'Players seal answers nobody else can see: only a hash of the answer, a salt and their address goes on chain.'],
  ['03', 'Reveal', 'After sealing closes, everyone opens. A reveal that does not match its hash is refused, the host’s included.'],
  ['04', 'Judge', 'Validators label every answer by meaning, ten at a time, and the prize pays itself to the winners.'],
];

const SEEN: [string, string][] = [
  ['From the start', 'The riddle, the prize, the fee, the mode, the windows and the host’s lock hash.'],
  ['While sealing', 'How many sealed, and their hashes. Never an answer.'],
  ['After sealing', 'The host’s answer and notes, checked against the lock, then every player answer next to the address that sealed it.'],
  ['After judging', 'Every label, the winners in seal order, and every payout.'],
];

const FAQ: [string, React.ReactNode][] = [
  [
    'What counts as correct?',
    <>
      An answer that names the same thing as the host&apos;s answer, as the host&apos;s notes define it. Spelling, language,
      articles and synonyms don&apos;t matter unless the notes say they do. An answer with two guesses is wrong.{' '}
      <Link className="c-link" href="/docs/concepts/the-four-labels">The four labels</Link>.
    </>,
  ],
  [
    'What if I lose my ticket?',
    <>
      The ticket holds your answer and its salt. Without it a sealed answer can&apos;t be opened, and an unopened answer
      can&apos;t win. The site saves every ticket in your browser and offers it as a download: keep the file.
    </>,
  ],
  [
    'What if the host vanishes?',
    <>
      A host who doesn&apos;t reveal in the window can&apos;t keep the prize. Once the window ends anyone can void the riddle:
      every entry fee is refunded and the prize is split among the players who revealed.
    </>,
  ],
  [
    'What if nobody solves it?',
    <>Every entry fee comes back to its player and the host gets the prize back. A host can only ever win back their own prize.</>,
  ],
  [
    'Which network?',
    <>
      GenLayer Studio Next, chain 61997, with test GEN from the site&apos;s faucet. <Link className="c-link" href="/docs/reference/addresses">Addresses and network</Link>.
    </>,
  ],
];

function pickLive(riddles: Riddle[], now: number, hosts: Set<string>): Riddle | undefined {
  const order = ['sealing', 'revealing', 'judging'];
  const real = riddles.filter((r) => !hosts.has(r.host.toLowerCase()));
  for (const phase of order) {
    const hit = [...real].filter((r) => phaseOf(r, now) === phase).sort((a, b) => b.entries - a.entries)[0];
    if (hit) return hit;
  }
  return real[0] ?? riddles[0];
}

export default async function Landing() {
  const now = nowSeconds();
  let riddles: Riddle[] = [];
  let live: RiddleFull | undefined;
  let results: { r: Riddle; e: Entry }[] = [];
  let error = '';
  try {
    riddles = await allRiddles();
    const pick = pickLive(riddles, now, evalHosts());
    if (pick) {
      const full = await getRiddle(pick.id);
      if (full.found) live = full;
    }
    const settled = riddles.filter((r) => r.status === 'SETTLED').slice(0, 4);
    for (const r of settled) {
      const full = await getRiddle(r.id);
      if (!full.found) continue;
      for (const e of full.entries_list) if (e.status === 'CORRECT' || e.status === 'CLOSE' || e.status === 'WRONG') results.push({ r, e });
    }
    // A typo and another language among them, then the near misses: one of each label first.
    const first = ['CORRECT', 'CLOSE', 'WRONG'].map((l) => results.find((x) => x.e.status === l)).filter(Boolean) as { r: Riddle; e: Entry }[];
    results = [...first, ...results.filter((x) => !first.includes(x))].slice(0, 6);
  } catch (e) {
    error = readError(e);
  }

  return (
    <>
      <section className="c-wrap pb-16 pt-14 sm:pt-20">
        <div className="c-grid-2">
          <div>
            <p className="c-eyebrow">Riddles and quizzes, judged on GenLayer</p>
            <h1 className="c-h1 mt-5">
              Nobody copies.
              <br />
              Nobody moves <em>the answer.</em>
            </h1>
            <p className="c-lead mt-6">
              Hosts lock the answer before anyone plays. Players seal theirs unseen. After the reveal, GenLayer validators judge
              every answer by meaning, typos and other languages included, and the prize pays itself.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/riddles" className="c-btn solid">
                Play a riddle
              </Link>
              <Link href="/new" className="c-btn">
                Host a riddle
              </Link>
            </div>
            <p className="c-faint mt-5 text-[14px]">Nobody solved it? Every entry fee comes back.</p>
          </div>
          <div>
            {error && <ReadError message={error} />}
            {live && <RiddleCard r={live} now={now} seals={[...live.entries_list].reverse()} />}
            {!error && !live && (
              <div className="c-card pad">
                <p className="c-muted">No riddle yet. Be the first to host one.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="c-section">
        <div className="c-wrap">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="c-h2">Recent results</h2>
            <Link href="/riddles#results" className="c-link text-[14px]">
              Every result
            </Link>
          </div>
          <p className="c-muted mt-2 max-w-[44em]">Real answers from settled riddles, with the label the validators agreed on.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map(({ r, e }) => (
              <Link key={`${r.id}-${e.number}`} href={`/r/${r.id}`} className="c-card flex flex-col gap-3 p-4 hover:border-[var(--line-strong)]">
                <div className="flex items-center gap-2">
                  <LabelBadge status={e.status} />
                  <span className="c-faint ml-auto text-[12.5px]">riddle #{r.id}</span>
                </div>
                <p className="serif text-[21px]">&ldquo;{e.answer}&rdquo;</p>
                <p className="c-faint text-[12.5px]">host answer: {r.answer}</p>
              </Link>
            ))}
            {!error && results.length === 0 && <p className="c-muted">No riddle has settled yet.</p>}
          </div>
        </div>
      </section>

      <section className="c-section" id="how">
        <div className="c-wrap">
          <h2 className="c-h2">How it works</h2>
          <div className="c-steps mt-8">
            {STEPS.map(([n, title, body]) => (
              <div key={n}>
                <p className="mono c-faint text-[13px]">{n}</p>
                <p className="c-h3 mt-3">{title}</p>
                <p className="c-muted mt-2 text-[14.5px] leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="c-section">
        <div className="c-wrap">
          <h2 className="c-h2">Why sealing matters</h2>
          <p className="c-muted mt-2 max-w-[44em]">
            In a public channel the first correct reply is visible to everyone after it, so the fastest copier wins. Here
            nothing readable is on chain until sealing closes, and a seal copied from another player can never be opened,
            because the address is part of it.
          </p>
          <div className="c-kv mt-6">
            {SEEN.map(([when, what]) => (
              <div key={when}>
                <dd className="text-[14.5px] leading-relaxed">{what}</dd>
                <dt>{when}</dt>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="c-section">
        <div className="c-wrap c-grid-2">
          <div>
            <h2 className="c-h2">For hosts</h2>
            <p className="c-muted mt-3 max-w-[34em] leading-relaxed">
              Write the riddle and the notes on what counts: typos, other languages, the near misses you expect. Try the notes
              on a few sample answers, fund the prize, and share one link. No DMs to read, no answers to check by hand, and a
              public record of every answer, label and payout.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/new" className="c-btn solid">
                Host a riddle
              </Link>
              <Link href="/docs/concepts/writing-notes" className="c-btn">
                Writing notes on what counts
              </Link>
            </div>
          </div>
          <div className="c-card pad">
            <p className="c-eyebrow">Notes, written before anyone plays</p>
            <p className="serif mt-3 text-[21px] leading-snug">
              &ldquo;Any computer keyboard, in any language. A piano is close: keys, but no space or enter. Two guesses in one
              answer are wrong.&rdquo;
            </p>
            <p className="c-faint mt-3 text-[13.5px]">The notes decide every edge case, because the host wrote them before seeing a single answer.</p>
          </div>
        </div>
      </section>

      <section className="c-section" id="faq">
        <div className="c-wrap">
          <h2 className="c-h2">FAQ</h2>
          <div className="mt-6 grid gap-x-12 gap-y-7 md:grid-cols-2">
            {FAQ.map(([q, a]) => (
              <div key={q}>
                <p className="c-h3">{q}</p>
                <p className="c-muted mt-2 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
