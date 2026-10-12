# Evidence

Every link was opened by `python submission/check-links.py submission/evidence.md`: each transaction exists on the Studio
Next explorer and is ACCEPTED or FINALIZED. "Refused" rows are refusals stored as refusals: the contract said no, kept
nothing, and the sentence is in the transaction's result.

## The contract

- Contract: https://explorer-studio-dev.genlayer.com/address/0x864906361b22e044d363083cad710366E8AfECD1
- Deploy: https://explorer-studio-dev.genlayer.com/tx/0x256c613ad2445bd23ea3c6ba91be3847150cd7b751b2fa669cb24eee00bfbbe8
- Deployed bytes identical to `contracts/sphinx.py` (sha256 a156b3ce…0349d): `python scripts/verify.py`

## Live walk from fresh wallets (run rp1, riddle 10)

- Riddle page: https://sphinx-genlayer.vercel.app/r/10
- Host a riddle: https://explorer-studio-dev.genlayer.com/tx/0xfc6ed6745d62b7ac3d812814c48a6b913129d3df5ed5953f76b7e25042ad3dde
- Refused, the host seals their own riddle: https://explorer-studio-dev.genlayer.com/tx/0x6da90de16725e1464dc2e0dec9af61d91b06431610bd6126ab6f8ee71f7a3d83
- Refused, a wrong entry fee: https://explorer-studio-dev.genlayer.com/tx/0x4785e743e310020cba226b922e42d0752f5ca576598ca3bcf01904879d485b23
- Refused, the host reveals while sealing is open: https://explorer-studio-dev.genlayer.com/tx/0xc66f858bcafd867492df7c038feabe5662dc3509b590c561070da36daa9c13cd
- Seal, alice: https://explorer-studio-dev.genlayer.com/tx/0x658ffcfbe23b62426eb0a19aa352b2129fc81f5b828b97d9a2f7fa56e62052c2
- Seal, bob: https://explorer-studio-dev.genlayer.com/tx/0x905f79cc37f8cc59502fcfe6b569cd8a377a570a5194da323e7eec423ea8fd2c
- Host reveal: https://explorer-studio-dev.genlayer.com/tx/0x3737e7562f60c6f6a7d6d356d33be9fece030323249ff1470d460742ae945db2
- Reveal, alice ("una vela"): https://explorer-studio-dev.genlayer.com/tx/0xcb5d17abe1d5f9d0da781e90ffb44a7a48259ad4c1b223472c1ce935fa8d7caa
- Reveal, bob ("a matchstick"): https://explorer-studio-dev.genlayer.com/tx/0xb01523ed2fa25eae11e66024e8b19dc4db39c2ce6d9afc500fa8c95e8a57f312
- Judge, una vela CORRECT, a matchstick CLOSE, settled: https://explorer-studio-dev.genlayer.com/tx/0x58634e0891b9c4abf27d6e27b4442ea5c725cd725fc99459ca7fbc9629443156
- Claim, 11 GEN to alice: https://explorer-studio-dev.genlayer.com/tx/0x77dd7cde125d3a0076824569ec19b1b27c951621dd19887a3379c952164ea767
- All three wallets reconcile to 0 wei: `docs/reviewer-path.studio-next.json`, `reconciliation`

## The site's own buttons in a browser (riddles 9 and 11)

- Seal through the UI: https://explorer-studio-dev.genlayer.com/tx/0x7494481851441fa4529dc642a60108a9dd5c4c6b51fe6ae2491eeb5350815dc6
- Host a riddle through the UI: https://explorer-studio-dev.genlayer.com/tx/0x1cb548bb5fa68fc94c526049805594c78997c3e0932f5d2ff5afbcb38cdce1a0
- Void of that riddle after its host never revealed: https://explorer-studio-dev.genlayer.com/tx/0x7925b1b30f635554760bad59f6621ca70ff658863d87bf618df04a272482a737
- Record: `docs/ui-walk.studio-next.md`

## Seeded riddles

- Settled riddle 7: https://sphinx-genlayer.vercel.app/r/7
- Judge of riddle 7, 7 labelled, 4 correct: https://explorer-studio-dev.genlayer.com/tx/0xb9364d07aeb8d760164cf7c4d008ca2e50d95f5880a1fe61bda6dead879e9eca
- Refused, a seal after sealing closed: https://explorer-studio-dev.genlayer.com/tx/0x51fde24b3d581f52f1f3ff95991385164a0b3b62e17c2796fe3fee50ae060a53
- Refused, a host reveal with the wrong salt: https://explorer-studio-dev.genlayer.com/tx/0xfcd061687ba5e08ce8c78ea6dad98a883ef11f6deef137f1969d98a000443a6e
- Refused, a copied seal's reveal: https://explorer-studio-dev.genlayer.com/tx/0x01f0ce97e0aeccdee331a5bcaa04892f5d3e63bbce29175a7e9dd32e7cb4438f
- Claim by a winner: https://explorer-studio-dev.genlayer.com/tx/0x44b632a864fffd19c69817cafa420d810d493296621da5475ef414ba917a6edd
- Void riddle 8: https://sphinx-genlayer.vercel.app/r/8
- Refused, judge on a riddle whose host never revealed: https://explorer-studio-dev.genlayer.com/tx/0xaf6808f0eaea11d82ca55cff319bc8d1ce5365c02d82c2d1670f17de7fdd8923
- Void, every fee refunded, prize split among revealed players: https://explorer-studio-dev.genlayer.com/tx/0x18e50133055773792b6014162f63c746a46a8b2d2bf8985ecd02af0b7265dd1e
- Open riddle 9, sealing until 2026-10-23: https://sphinx-genlayer.vercel.app/r/9

## Golden cases through consensus

- Results with every row's transaction: https://sphinx-genlayer.vercel.app/docs/more/evaluation
- Judge, keyboard (cases 1 to 6): https://explorer-studio-dev.genlayer.com/tx/0x7b78c199a03c56154248c0a25cabe087227dda493a9e86f7b38e91e0c2b96b1a
- Judge, consensus (cases 7 to 9): https://explorer-studio-dev.genlayer.com/tx/0x4a8232628d73a642a6e9385cc48c3ec44116d0e40b8746254d8f5d2c76419303
- Judge, months (cases 10 and 11): https://explorer-studio-dev.genlayer.com/tx/0x47e92cc0efa6114283e2257f7b35d57db0a8f3a153c2c92aa35f88fa48a987d7
- Judge, H1: https://explorer-studio-dev.genlayer.com/tx/0xe829767cbc4b8d636be6d7360bfe5d07932b7fc6de8eb57ccd06809be7be06b6
- Judge, H2: https://explorer-studio-dev.genlayer.com/tx/0x016eb31fadaa8e1ceb8a2e6ed5d2b5db697ee40a5dc8122f3c22278c52446098
- Judge, H3: https://explorer-studio-dev.genlayer.com/tx/0xdaba2d245d6ade9e1197644a712ad2725ac59f4e90f7bf379ef6e85d449929e6
