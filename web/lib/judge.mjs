import contract from './contract.generated.json' with { type: 'json' };

/**
 * The judge prompt the validators read, built here only for the host's
 * "try your notes" preview. The template is the contract's JUDGE constant,
 * written into contract.generated.json by scripts/gen_docs.py; fence, flat
 * and numbered are the contract's functions of the same names, line for line.
 * Plain JavaScript so tests/test_static.py can render a prompt with this
 * exact file and compare it with the contract's.
 */

export const JUDGE = contract.judge;
export const LIMITS = contract.limits;

export function fence(raw) {
  return String(raw).replace(/</g, '(').replace(/>/g, ')');
}

export function flat(text) {
  return String(text).split(/\s+/).filter(Boolean).join(' ');
}

export function numbered(answers) {
  return answers.map((a, i) => `${i + 1}: ${flat(a)}`).join('\n');
}

export function judgePrompt(riddle, answer, notes, answers) {
  const values = {
    riddle: fence(riddle),
    answer: fence(answer),
    notes: fence(notes),
    entries: fence(numbered(answers)),
  };
  return JUDGE.replace(/\{(riddle|answer|notes|entries)\}/g, (_, key) => values[key]);
}

/** One label per answer, or null: the contract's read_labels, minus the error kinds. */
export function readLabels(raw, count) {
  let text = String(raw ?? '').trim();
  if (text.startsWith('```')) {
    const parts = text.split('```');
    if (parts.length > 1) text = parts[1].trim();
    if (text.toLowerCase().startsWith('json')) text = text.slice(4).trim();
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    const labels = Array.isArray(parsed) ? parsed : parsed?.labels;
    if (!Array.isArray(labels) || labels.length !== count) return null;
    const out = labels.map((l) => String(l ?? '').trim().toUpperCase());
    return out.every((l) => l === 'CORRECT' || l === 'CLOSE' || l === 'WRONG') ? out : null;
  } catch {
    return null;
  }
}
