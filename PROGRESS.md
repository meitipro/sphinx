# Progress

- 2026-10-09 Contract `contracts/sphinx.py`, 10 methods, linted and validated against the live 5jycge4q runtime.
- 2026-10-09 Offline suite: direct and static tests, shared sha256 vectors, 74 of 74 mutants killed (docs/MUTATIONS.md).
- 2026-10-09 Deployed to Studio Next at 0x864906361b22e044d363083cad710366E8AfECD1; deployed bytes identical to the repo.
- 2026-10-09 Golden cases written, hashed and locked (eval/golden.lock.json) before the first run; golden run started.
- 2026-10-09 Site: landing, riddles, riddle page, host a riddle, host record, player page, faucet, notes preview route.
- 2026-10-09 Docs: Fumadocs with generated contract reference, errors, addresses, hashing vectors, judge prompt, evaluation.
- 2026-10-09 Seed run started: a settled riddle, a void riddle, an open riddle, and refusals on chain.
- 2026-10-09 Bug: the first golden run judged later riddles before their windows ended; the contract refused, the runner miscounted the refusals as judgments. Runner fixed, refusals disclosed; golden 11/11, held-out 3/3.
- 2026-10-09 Seed finished: riddle 7 settled (4 winners, 16 GEN each), riddle 8 voided, riddle 9 open until 2026-10-23, refusals on chain.
- 2026-10-09 Site live at sphinx-genlayer.vercel.app; UI walk in the browser: connect, switch, faucet, seal, host (docs/ui-walk.studio-next.md).
- 2026-10-12 Bugs: host form defaults (60 GEN prize, above the 20 GEN faucet) and premature "late host" counting fixed; redeployed.
- 2026-10-12 Reviewer path rp1 from fresh wallets on the live site: refusals, seals, reveals, judge, 11 GEN claim; three wallets reconcile to 0 wei.
- 2026-10-12 Portal text counted (description 960/1000, steward 440/500, proof 485/500), 34 of 34 evidence links resolve.
