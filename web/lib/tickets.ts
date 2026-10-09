'use client';

/**
 * Tickets: the answer, the notes and the salt behind a lock or a seal. Without
 * the salt a sealed answer cannot be opened, and an unopened answer cannot
 * win; without the host's ticket the host cannot reveal and loses the prize.
 *
 * Every ticket is saved in this browser before the transaction that needs it
 * is signed, and offered as a download. Nothing here leaves the browser.
 */

import { CHAIN_ID, CONTRACT } from './genlayer-core.mjs';

export type Ticket = {
  kind: 'host' | 'player';
  contract: string;
  chainId: number;
  /** null until the transaction that opens the riddle returns its id. */
  riddleId: number | null;
  account: string;
  answer: string;
  notes?: string;
  salt: string;
  /** The lock (host) or the seal (player) this ticket opens. */
  hash: string;
  riddle?: string;
  savedAt: string;
};

const KEY = 'sphinx:tickets:v1';
const EVENT = 'sphinx-tickets';

export function loadTickets(): Ticket[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Ticket[]) : [];
    return list.filter((t) => t.contract?.toLowerCase() === String(CONTRACT).toLowerCase());
  } catch {
    return [];
  }
}

function store(list: Ticket[]): boolean {
  try {
    const raw = window.localStorage.getItem(KEY);
    const others = (raw ? (JSON.parse(raw) as Ticket[]) : []).filter((t) => t.contract?.toLowerCase() !== String(CONTRACT).toLowerCase());
    window.localStorage.setItem(KEY, JSON.stringify([...others, ...list]));
    window.dispatchEvent(new Event(EVENT));
    return true;
  } catch {
    return false;
  }
}

/** Save or update a ticket, matched by its hash. Returns false when this browser refuses storage. */
export function saveTicket(ticket: Omit<Ticket, 'contract' | 'chainId' | 'savedAt'> & { savedAt?: string }): boolean {
  const full: Ticket = { ...ticket, contract: String(CONTRACT), chainId: CHAIN_ID, savedAt: ticket.savedAt ?? new Date().toISOString() };
  const list = loadTickets().filter((t) => t.hash !== full.hash);
  return store([...list, full]);
}

export function setRiddleId(hash: string, riddleId: number): void {
  const list = loadTickets().map((t) => (t.hash === hash ? { ...t, riddleId } : t));
  store(list);
}

export function findTicket(kind: Ticket['kind'], match: { riddleId?: number; hash?: string; account?: string }): Ticket | undefined {
  return loadTickets().find(
    (t) =>
      t.kind === kind &&
      (match.hash ? t.hash === match.hash : true) &&
      (match.riddleId !== undefined ? t.riddleId === match.riddleId : true) &&
      (match.account ? t.account.toLowerCase() === match.account.toLowerCase() : true),
  );
}

export function onTickets(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  window.addEventListener('storage', fn);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener('storage', fn);
  };
}

export function ticketFileName(t: Pick<Ticket, 'kind' | 'riddleId' | 'hash'>): string {
  return `sphinx-${t.kind}-ticket-${t.riddleId ?? 'new'}-${t.hash.slice(0, 8)}.json`;
}

export function downloadTicket(t: Ticket): void {
  const blob = new Blob([JSON.stringify(t, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = ticketFileName(t);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A ticket file read back, or null when it is not one. */
export function parseTicket(text: string): Ticket | null {
  try {
    const t = JSON.parse(text) as Ticket;
    if ((t.kind !== 'host' && t.kind !== 'player') || typeof t.salt !== 'string' || typeof t.answer !== 'string' || !/^[0-9a-f]{64}$/.test(t.hash)) return null;
    return t;
  } catch {
    return null;
  }
}
