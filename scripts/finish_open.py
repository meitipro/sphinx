#!/usr/bin/env python3
"""
Finish the seeded open riddle when its windows come round.

    python scripts/finish_open.py reveal   # inside its reveal window: the host and the seed players reveal
    python scripts/finish_open.py judge    # after the reveal window: judge until it settles

The open riddle was posted by scripts/seed.py with 336 hours of sealing, so
visitors can seal into it for two weeks. Its tickets live only in the
git-ignored docs/seed.studio-next.json; every step taken here is appended to
that record, then docs/seed.public.json is rewritten.
"""

from __future__ import annotations

import subprocess
import sys

import chain as C
import seed as S

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def main() -> int:
    what = sys.argv[1] if len(sys.argv) > 1 else ""
    record = S.load()
    address = C.address()
    people = C.accounts(S.HOST, *S.PLAYERS)
    chains = {name: C.Chain(acct) for name, acct in people.items()}
    row = record["riddles"]["open"]
    spec = S.RIDDLES["open"]
    reader = C.Chain()
    current = reader.read_json(address, "get_riddle", [row["id"]])
    if what == "reveal":
        S.wait_until(current["seal_end"], "sealing to close on the open riddle")
        S.step(record, "open:host-reveal", chains[S.HOST], address, "host_reveal", [row["id"], spec["answer"], spec["notes"], row["host_salt"]])
        for name, ticket in row["tickets"].items():
            S.step(record, f"open:reveal:{name}", chains[name], address, "reveal", [row["id"], ticket["answer"], ticket["salt"]])
    elif what == "judge":
        S.wait_until(current["reveal_end"], "the reveal window to end on the open riddle")
        attempt = 1
        while reader.read_json(address, "get_riddle", [row["id"]])["status"] == "OPEN" and attempt <= 25:
            S.step(record, f"open:judge:{attempt}", chains[S.PLAYERS[3]], address, "judge", [row["id"]])
            attempt += 1
    else:
        print(__doc__)
        return 2
    subprocess.run([sys.executable, str(C.ROOT / "scripts" / "publish_seed.py")], check=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
