# Handoff

What only the owner can do, or what has to wait for a date. Everything else is done and recorded in PROGRESS.md.

1. **Send the portal entry.** Every field is in `submission/portal.md`, with character counts checked by
   `python submission/count.py`. The logo is `submission/sphinx-icon-512.png`. The two secondary tags come from the
   portal's own lists, so pick the nearest ones to those suggested there.
2. **Record the silent demo** by following `submission/demo-script.md`, upload it, and paste the link into the optional
   video field.
3. **Post on X** with `submission/x-post.md`.
4. **Between 2026-10-23 17:47 UTC and 2026-10-25 17:47 UTC**, open riddle 9 (the seeded open riddle) for reveals:
   `python scripts/finish_open.py reveal`. Then, after 2026-10-25 17:47 UTC, run `python scripts/finish_open.py judge`.
   Its tickets live only in the git-ignored `docs/seed.studio-next.json` and in `~/.sphinx/` on this machine. If this is
   skipped, the host never reveals, and anyone can void riddle 9: every fee comes back and the prize goes to the players
   who revealed. That is a working path too, but the reveal is the better demo.
5. **Optional: notes previews.** "Try the notes" on Host a riddle needs a model key on the Vercel project:
   `OPENROUTER_API_KEY` (and optionally `OPENROUTER_MODEL`, `OPENROUTER_BASE_URL` without `/v1`). Without it the button
   says previews are off, and nothing else depends on it.

The contract is frozen at `0x864906361b22e044d363083cad710366E8AfECD1`; do not redeploy without deciding to.
The Vercel project `sphinx-genlayer` is CLI-linked from `web/` and not Git-connected: redeploy from `web/` with
`npx vercel@latest deploy --prod --scope mahdighs-projects`.
