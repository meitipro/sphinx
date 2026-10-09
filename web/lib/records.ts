import records from './records.generated.json';

/** Accounts that post riddles for the golden evaluation: real riddles, but not the one to show a new visitor first. */
export function evalHosts(): Set<string> {
  return new Set((records.evalHosts as string[]).map((h) => h.toLowerCase()));
}
