/** The shapes the contract's views return (contracts/sphinx.py _riddle_json and _entry_json). */

export type Label = 'CORRECT' | 'CLOSE' | 'WRONG';
export type EntryStatus = 'SEALED' | 'REVEALED' | Label | 'UNREVEALED';
export type RiddleStatus = 'OPEN' | 'SETTLED' | 'VOID';
export type Mode = 'FIRST_N' | 'SPLIT_ALL';

export type Entry = {
  riddle_id: number;
  number: number;
  player: string;
  seal: string;
  fee: string;
  sealed_at: number;
  status: EntryStatus;
  answer: string;
  revealed_at: number;
  rank: number;
  winner: boolean;
  batch: number;
  judged_at: number;
  judged_by: string;
  payout: string;
  refund: string;
};

export type Riddle = {
  id: number;
  host: string;
  text: string;
  lock: string;
  mode: Mode;
  winners_n: number;
  entry_fee: string;
  prize: string;
  pot: string;
  max_entries: number;
  created_at: number;
  seal_end: number;
  reveal_end: number;
  status: RiddleStatus;
  entries: number;
  revealed: number;
  judged: number;
  batches: number;
  correct: number;
  close: number;
  wrong: number;
  unrevealed: number;
  host_revealed: boolean;
  host_revealed_at: number;
  answer: string;
  notes: string;
  salt: string;
  winners: number;
  share: string;
  host_payout: string;
  settled_at: number;
  settled_by: string;
};

export type RiddleFull = Riddle & { found: true; entries_list: Entry[] };
export type NotFound = { found: false };
export type RiddlePage = { status: string; total: number; offset: number; items: Riddle[] };

export type Account = {
  address: string;
  balance: string;
  claimed: string;
  found: boolean;
  entries?: Entry[];
  entry?: Entry;
};
