# Portal entry

Every field below, in the order the form asks. Counts are checked by `python submission/count.py`, and every link is
opened by `python submission/check-links.py`.

## Make it recognizable

- **Logo:** `submission/sphinx-icon-512.png` (512 × 512, the site's own mark, an orchid seal with a keyhole on a dark ground, safe for a circular crop)
- **Project name:** Sphinx - riddles with prizes, judged by meaning
- **Primary tag:** Gaming
- **Tag 1:** the portal's nearest to *Quiz and riddle contests* (skill contests, trivia, tournaments)
- **Tag 2:** the portal's nearest to *Prize pools* (sealed entries, commit-reveal, payouts)

## One-liner

<!-- one-liner -->
Riddle contests with sealed answers, judged by meaning by validators that must agree.
<!-- end -->

## Description

<!-- description -->
Sphinx is a riddle and quiz contest on GenLayer. A host posts a riddle with a prize and locks the answer and the notes on what counts, as a hash with a salt, before anyone plays. Players seal a hash of their answer, a salt and their address with a small entry fee, so nobody can read or copy an answer, and a copied seal can never be opened.

After sealing closes, the host and the players reveal; a reveal that does not match its hash is refused. Then anyone calls judge: validators label the next ten answers CORRECT, CLOSE or WRONG against the host's answer and notes, so typos, synonyms and other languages count, and they must agree on which answers are correct, the set that moves money.

The pot, prize plus fees, goes in equal shares to the first N correct answers or to all of them. If nobody is correct, every fee is refunded. If the host never reveals, anyone can void and the prize goes to the players who revealed. Winners claim from the contract.
<!-- end -->

## Show it in action

Optional video link: record `submission/demo-script.md` and paste the link here.

## Write the exact path

<!-- step 1 -->
**Fund a wallet** — Open sphinx-genlayer.vercel.app and select Connect wallet in the header. Open any riddle from Riddles; its box walks you through Switch network (adds GenLayer Studio Next, chain 61997) and Get test GEN, which pays 20 test GEN from the site's faucet.
<!-- end -->

<!-- step 2 -->
**Read a settled riddle** — Open sphinx-genlayer.vercel.app/r/7. The host answer reads A keyboard, matches lock. In seal order, "Tastatur" and "a computer keybord" are CORRECT, "a piano" is CLOSE as the notes said, "keyboard or piano" is WRONG, and #7, a copied seal, stayed UNREVEALED.
<!-- end -->

<!-- step 3 -->
**Host a riddle** — Select Host a riddle. Write a riddle, the answer and the notes; keep Sealing 1 and Reveal 1 hours and the 10 GEN prize. Select Download ticket, then Lock the answer and fund 10 GEN and confirm. The site opens the new riddle's page.
<!-- end -->

<!-- step 4 -->
**Seal an answer** — From a second wallet, open that riddle page (Copy link), write one answer in Your answer and select Seal answer and pay 0.5 GEN. The list shows only the seal's hash; your ticket is saved in the browser and offered as Download ticket.
<!-- end -->

<!-- step 5 -->
**Reveal after an hour** — Once sealing closes, open the page again. The host selects Reveal the answer and notes, the player selects Reveal my answer. Each is checked against its hash; a reveal that does not match is refused.
<!-- end -->

<!-- step 6 -->
**Judge and claim** — After the reveal hour, anyone selects Judge the next ten answers; the page says Validators are judging ten answers, then shows each label. A winner selects Claim on the riddle page or on My tickets, and the GEN lands at finality.
<!-- end -->

## Prove the path works

<!-- proof -->
Fresh wallets on the live site (run rp1, riddle 10): faucet paid 20 GEN each; 3 refusals stored as refusals (host plays, wrong fee, early host reveal); 2 seals, reveals, one judge: Spanish "una vela" CORRECT, "a matchstick" CLOSE. Winner claimed 11 GEN; all 3 wallets reconcile to 0 wei. Golden 11/11, held-out 3/3: sphinx-genlayer.vercel.app/docs/more/evaluation. Judge tx: https://explorer-studio-dev.genlayer.com/tx/0x58634e0891b9c4abf27d6e27b4442ea5c725cd725fc99459ca7fbc9629443156
<!-- end -->

- **Contract link:** https://explorer-studio-dev.genlayer.com/address/0x864906361b22e044d363083cad710366E8AfECD1

## Send people to it

- **Website:** https://sphinx-genlayer.vercel.app
- **GitHub:** https://github.com/meitipro/sphinx

## Note to stewards

<!-- steward -->
Studio Next; scripts/verify.py reads the deployed bytes back identical to the repo. Windows last at least an hour each, so the full path takes two hours: host your own riddle with Sealing 1 and Reveal 1. Riddle 9 takes seals until Oct 23. Golden 11/11, held-out 3/3, through consensus; the prompt is the spec's, word for word. eval/results.md discloses early judge calls the contract refused (a script bug, fixed). 218 tests, 74/74 mutants.
<!-- end -->
