# Sphinx

**Riddles with prizes, judged by meaning.** A riddle and quiz contest on GenLayer: the host locks the answer and the
notes on what counts before anyone plays, players seal their answers so nobody can copy them, and after the reveal
GenLayer validators judge every answer by meaning, so typos, synonyms and other languages count. The prize pays the
winners from the contract.

- **Live site:** https://sphinx-genlayer.vercel.app (docs at [/docs](https://sphinx-genlayer.vercel.app/docs))
- **Contract:** [`0x864906361b22e044d363083cad710366E8AfECD1`](https://explorer-studio-dev.genlayer.com/address/0x864906361b22e044d363083cad710366E8AfECD1)
  on GenLayer **Studio Next** (chain 61997), deployed in
  [`0x256c613a…`](https://explorer-studio-dev.genlayer.com/tx/0x256c613ad2445bd23ea3c6ba91be3847150cd7b751b2fa669cb24eee00bfbbe8),
  source sha256 `a156b3ce…0349d`, frozen in [`contracts/FROZEN.json`](contracts/FROZEN.json)
- **Evaluation:** golden cases **11 of 11**, held-out cases **3 of 3** labelled, through real consensus on the deployed
  contract and published as they came out: [`eval/results.md`](eval/results.md)
- **Offline suite:** 218 tests, and 74 of 74 mutants caught ([`docs/MUTATIONS.md`](docs/MUTATIONS.md))

## How it works

1. **Lock.** The host posts the riddle (public) and `sha256("answer|notes|salt")` with the prize.
2. **Seal.** Players seal `sha256("answer|salt|address")` with the exact entry fee. One seal per address. A seal copied
   from another player can never be opened, because the address is inside the hash.
3. **Reveal.** After sealing closes, the host and the players open their hashes in one window. A reveal that does not
   match its hash is refused. The host cannot reveal early.
4. **Judge.** When the window ends, anyone calls `judge`: the next ten revealed answers in seal order go to the
   validators with the spec's prompt, word for word, and each answer is labelled `CORRECT`, `CLOSE` or `WRONG`.
   Validators compare **which answers are CORRECT** and nothing else, because that set is what moves money. The
   leader's `CLOSE`/`WRONG` split is stored for display; both are paid the same, nothing.
5. **Claim.** The call after the last batch credits the pot: equal shares to the first N correct answers in seal order
   (First N) or to every correct answer (Split all). If nobody is correct, every fee is refunded and the host gets the
   prize back. If the host never reveals, anyone can `void`: every fee is refunded and the prize is split among the
   players who revealed. `judge` and `void` only credit balances; `claim` is the only payout, a top-level transfer.

| Method | Kind | |
|---|---|---|
| `create_riddle(text, lock, mode, winners_n, entry_fee, seal_hours, reveal_hours, max_entries)` | payable | Opens a riddle with its prize and the host's lock |
| `commit(riddle_id, seal)` | payable | Seals one answer per address with the exact entry fee, while sealing is open |
| `host_reveal(riddle_id, answer, notes, salt)` | write | Opens the host's answer and notes, checked against the lock |
| `reveal(riddle_id, answer, salt)` | write | Opens a player's answer, checked against their seal |
| `judge(riddle_id)` | write, nondet | Labels the next ten revealed answers; settles after the last batch |
| `void(riddle_id)` | write | Host never revealed: fees back, prize split among revealed players |
| `claim()` | write, pays | Top-level transfer of the caller's balance |
| `get_riddle(riddle_id)` | view | Riddle, prize, mode, windows, counts, the answer once revealed, every entry |
| `get_entry(riddle_id, address)` | view | Seal, answer once revealed, label, rank, payout and balance; riddle 0 lists every entry |
| `list_riddles(status, offset, limit)` | view | Open, settled and void riddles |

The full reference is generated from the source: [docs/reference/contract](https://sphinx-genlayer.vercel.app/docs/reference/contract).

## Repository

```
contracts/sphinx.py         the contract, judge prompt pinned inside; FROZEN.json records the deployment
tests/test_direct.py        every method and every rule, the judge mocked per node (tests/genvm_double.py)
tests/test_static.py        static checks over the parsed source: auth, fencing, money paths, storage rules
tests/vectors.json          sha256 vectors shared by the contract and the site
eval/                       golden cases, locked before the first run, and their results with transactions
scripts/                    deploy, verify the deployed bytes, mutate every defence, seed, generate the docs
web/                        Next.js site and Fumadocs docs; writes are signed in the visitor's wallet
submission/                 portal text, X post, silent demo script, 512 px icon
```

## What is on chain

| | |
|---|---|
| Golden riddles 1 to 3, held-out riddles 4 to 6 | Every golden case and held-out case, one `judge` per riddle; [`eval/results.md`](eval/results.md) |
| Riddle 7, settled | Eight seals: "keyboard", "Tastatur", "a computer keybord" and "clavier d'ordinateur" CORRECT, "a piano" CLOSE, "a map" and "keyboard or piano" WRONG, and a copied seal that could not be opened, UNREVEALED. First 5 correct, so four winners at 16 GEN each (64 GEN pot); two have claimed, two are still credited |
| Riddle 8, void | The host never revealed: `judge` refused, `void` refunded every fee and split the prize among the three players who revealed |
| Riddle 9, open | Sealing until 2026-10-23 17:47 UTC, so anyone can seal into it |
| Refusals | A seal after sealing closed, a host reveal with the wrong salt, a player reveal with the wrong salt, a copied seal's reveal, the host sealing their own riddle, a wrong fee, an early host reveal |

Every step and transaction is in [`docs/seed.public.json`](docs/seed.public.json) and
[`docs/reviewer-path.studio-next.json`](docs/reviewer-path.studio-next.json). Salts of answers not yet revealed on chain are
withheld from the published record.

## Run it

```bash
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
.venv/Scripts/python -m pytest tests -q          # offline, no network
.venv/Scripts/python scripts/mutate.py           # break each defence, name the test that catches it
.venv/Scripts/python scripts/verify.py           # read the deployed source back and diff it with this repo
cd web && npm ci && npm run dev                  # the site on http://localhost:3210
```

The test double gives the leader and each validator their own model answers, compares addresses as bytes, copies rows
on store, and refuses storage access inside a non-deterministic block. It proves the contract's logic, not GenVM: the
evaluation does that, on chain.

## Honest limits

Sphinx judges whether an answer means the same as the host's, as the notes define it, not whether the riddle is fair. It
cannot tell one person's wallets apart, it cannot stop a host from telling a friend the answer, and trivia is open book
because nobody can see what players look up. Answers are public after the reveal. The shortest windows are one hour each,
so a riddle takes at least two hours from post to judging. Everything runs on Studio Next with test GEN.

No private key is on any server or in this repository. Test accounts live in `~/.sphinx/accounts.json` on the machine
that ran the scripts, and only addresses are printed.
