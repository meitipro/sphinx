import { unstable_cache } from 'next/cache';

import { CONTRACT, readClient, retried } from './genlayer-core.mjs';
import type { Account, NotFound, Riddle, RiddleFull, RiddlePage } from './types';

/**
 * Reads happen on the server, cached for a short while under tags.
 *
 * Studio Next rate-limits each IP, and every visitor's page view would
 * otherwise spend the server's budget. Shared reads are cached for 20 seconds;
 * after a decided write the page POSTs /api/refresh, which expires the tags it
 * touched, so the person who wrote sees their own result at once.
 */

const client = readClient();
const REVALIDATE = 20;

async function view<T>(method: string, args: (number | string)[]): Promise<T> {
  const raw = await retried(() => client.readContract({ address: CONTRACT, functionName: method, args }), 3);
  return JSON.parse(String(raw)) as T;
}

export const tags = {
  riddles: 'riddles',
  riddle: (id: number) => `riddle:${id}`,
  account: (address: string) => `account:${address.toLowerCase()}`,
};

export function getRiddle(id: number): Promise<RiddleFull | NotFound> {
  return unstable_cache(() => view<RiddleFull | NotFound>('get_riddle', [id]), ['get_riddle', String(id)], {
    revalidate: REVALIDATE,
    tags: [tags.riddles, tags.riddle(id)],
  })();
}

export function listRiddles(status = '', offset = 0, limit = 50): Promise<RiddlePage> {
  return unstable_cache(() => view<RiddlePage>('list_riddles', [status, offset, limit]), ['list_riddles', status, String(offset), String(limit)], {
    revalidate: REVALIDATE,
    tags: [tags.riddles],
  })();
}

/** One address's entries on every riddle, with its balance. */
export function getAccount(address: string): Promise<Account> {
  const key = address.toLowerCase();
  return unstable_cache(() => view<Account>('get_entry', [0, key]), ['get_entry', '0', key], {
    revalidate: REVALIDATE,
    tags: [tags.riddles, tags.account(key)],
  })();
}

/** Every riddle with one status ('' for all), newest first, in pages of fifty. */
export async function allRiddles(status = ''): Promise<Riddle[]> {
  const first = await listRiddles(status, 0, 50);
  const items = [...first.items];
  for (let offset = 50; offset < first.total; offset += 50) items.push(...(await listRiddles(status, offset, 50)).items);
  return items;
}

/** A read failed: say so in one sentence rather than failing the page. */
export function readError(error: unknown): string {
  const text = String((error as Error)?.message ?? error);
  if (/-32029|rate limit/i.test(text)) return 'Studio Next is rate limiting reads right now. Wait a minute and reload.';
  return 'Studio Next did not answer this read. Reload in a moment.';
}
