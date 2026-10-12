# UI walk on the live site

The site's real buttons, clicked in the browser on https://sphinx-genlayer.vercel.app on 2026-10-09, with a throwaway
EIP-1193 wallet created inside the page (its key never left the tab). The wallet starts like a fresh MetaMask: no account
until asked, on chain 0x1, and Studio Next unknown until the site adds it.

Wallet: `0x997daB927895c44932a900868aA9304143290E23`.

| Step | What was clicked | What happened |
|---|---|---|
| 1 | Riddles, then riddle #9 | The seal box showed Connect wallet |
| 2 | Connect wallet | The account appeared in the box |
| 3 | Switch network | The site added GenLayer Studio Next (chain 61997) and switched to it |
| 4 | Get test GEN | The faucet route paid 20 GEN; the header read 0x997d…0e23, 20 GEN |
| 5 | Your answer "footprints", Seal answer and pay 0.5 GEN | The ticket was saved in the browser before signing; "Done in 11s. Accepted by the validators." [0x74944818…](https://explorer-studio-dev.genlayer.com/tx/0x7494481851441fa4529dc642a60108a9dd5c4c6b51fe6ae2491eeb5350815dc6); the box changed to "You sealed answer #4" with Download ticket |
| 6 | Host a riddle; riddle, answer "A clock", notes, N 1, maximum 10, prize 5, fee 0.5, Sealing 1, Reveal 1 | Try the notes said previews are off on this deployment (no model key set); the host ticket showed its salt and lock |
| 7 | Lock the answer and fund 5 GEN | "Done in 11s." [0x1cb548bb…](https://explorer-studio-dev.genlayer.com/tx/0x1cb548bb5fa68fc94c526049805594c78997c3e0932f5d2ff5afbcb38cdce1a0); the site opened /r/11, "You host this riddle", and the host ticket's riddle id was set to 11 |
| 8 | (none) | The in-page wallet's key lived only in that tab and ended with the session, so riddle 11's host never revealed. After its reveal window, `rp1_bob` sent void: [0x7925b1b3…](https://explorer-studio-dev.genlayer.com/tx/0x7925b1b30f635554760bad59f6621ca70ff658863d87bf618df04a272482a737), the host-absent path, with no entries to refund |

The full two-hour loop (host, two players, reveal, judge, claim) was walked from fresh accounts through the same site
code with a stand-in wallet: `docs/reviewer-path.studio-next.json`, run `rp1`, riddle 10.
