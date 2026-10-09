#!/usr/bin/env python3
"""
Write docs/seed.public.json: the seed record without any secret that still matters.

    python scripts/publish_seed.py           # write it
    python scripts/publish_seed.py --check   # exit 1 if it differs from what would be written

docs/seed.studio-next.json (git-ignored) holds every ticket the seed run made,
including the salts of the open riddle, which is still sealing. Publishing a
salt before its reveal would publish the answer behind the lock. So this copy
keeps every step, hash and refusal, and keeps a ticket or a host salt only when
the contract has already made it public by a reveal.
"""

from __future__ import annotations

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PRIVATE = ROOT / "docs" / "seed.studio-next.json"
PUBLIC = ROOT / "docs" / "seed.public.json"


def build() -> str:
    record = json.loads(PRIVATE.read_text(encoding="utf-8"))
    steps = record["steps"]
    revealed = {s["key"] for s in steps if s["ok"] and (":reveal:" in s["key"] or s["key"].endswith(":host-reveal"))}
    riddles = {}
    for key, row in record["riddles"].items():
        host_open = f"{key}:host-reveal" in revealed
        tickets = {}
        for name, ticket in row.get("tickets", {}).items():
            if f"{key}:reveal:{name}" in revealed:
                tickets[name] = {"answer": ticket["answer"], "salt": ticket["salt"], "revealed": True}
            elif ticket.get("copied_from"):
                tickets[name] = {"copied_from": ticket["copied_from"], "revealed": False}
            else:
                tickets[name] = {"revealed": False}
        riddles[key] = {
            "id": row["id"],
            "host": row["host"],
            "host_salt": row["host_salt"] if host_open else "(withheld: not revealed on chain)",
            "tickets": tickets,
        }
    public = {
        "about": "The seed run's record, published from docs/seed.studio-next.json by scripts/publish_seed.py. Salts of answers not yet revealed on chain are withheld.",
        "network": record["network"],
        "contract": record["contract"],
        "explorer": record["explorer"],
        "accounts": record["accounts"],
        "riddles": riddles,
        "steps": [{k: s[k] for k in ("key", "method", "from", "hash", "ok", "expected", "returned", "refusal", "at")} for s in steps],
        "settled_summary": record.get("settled_summary", {}),
        "finished_at": record.get("finished_at", ""),
    }
    return json.dumps(public, indent=2, ensure_ascii=False) + "\n"


def main() -> int:
    text = build()
    if "--check" in sys.argv:
        current = PUBLIC.read_text(encoding="utf-8") if PUBLIC.exists() else ""
        if current != text:
            print("docs/seed.public.json is stale: run python scripts/publish_seed.py")
            return 1
        print("docs/seed.public.json is current")
        return 0
    PUBLIC.write_text(text, encoding="utf-8", newline="\n")
    print("wrote docs/seed.public.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
