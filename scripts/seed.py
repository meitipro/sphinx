#!/usr/bin/env python3
"""
Seed the deployed contract with real riddles, played by real accounts, so the
site shows every path on the explorer: a settled riddle with correct, close,
wrong and unrevealed answers and claimed winnings, a riddle voided because its
host never revealed, an open riddle still sealing, and the refusals a reviewer
should see happen (a copied seal that cannot be opened, a reveal with the wrong
salt, a seal after sealing closed, a host reveal that does not match the lock).

    python scripts/seed.py            # run or resume; waits out the one-hour windows
    python scripts/seed.py --status   # print the record

Every step is written to docs/seed.studio-next.json before it is printed, and
the run resumes where it stopped. Accounts live in ~/.sphinx/accounts.json;
only addresses are printed or recorded.
"""

from __future__ import annotations

import datetime
import hashlib
import json
import pathlib
import sys
import time
import uuid

import chain as C

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

RECORD = C.ROOT / "docs" / "seed.studio-next.json"
HOST = "seed_host"
VOID_HOST = "seed_host_absent"
PLAYERS = [f"seed_player_{n}" for n in range(1, 9)]
MARGIN = 45

RIDDLES = {
    "settled": {
        "text": "I have keys but open no locks, I have space but no room, you can enter but not go inside. What am I?",
        "answer": "A keyboard",
        "notes": "Any computer keyboard, in any language. A piano is close: keys, but no space or enter. Two guesses in one answer are wrong.",
        "mode": "FIRST_N",
        "winners": 5,
        "prize": 60 * C.GEN,
        "fee": C.GEN // 2,
        "seal_hours": 1,
        "reveal_hours": 1,
        # player index -> answer. Player 7 copies player 1's seal: it is accepted
        # as a seal, and can never be opened, so it ends UNREVEALED.
        "plays": {1: "keyboard", 2: "a piano", 3: "Tastatur", 4: "a map", 5: "keyboard or piano", 6: "a computer keybord", 7: "COPY:1", 8: "clavier d'ordinateur"},
    },
    "void": {
        "text": "What has a neck but no head, and wears a cap?",
        "answer": "A bottle",
        "notes": "Any bottle. A jar is close: it has a lid, but no neck. A shirt is wrong.",
        "mode": "SPLIT_ALL",
        "winners": 0,
        "prize": 20 * C.GEN,
        "fee": C.GEN // 2,
        "seal_hours": 1,
        "reveal_hours": 1,
        "plays": {1: "a bottle", 2: "a jar", 3: "a wine bottle"},
    },
    "open": {
        "text": "The more you take, the more you leave behind. What am I?",
        "answer": "Footsteps",
        "notes": "Footsteps or steps, in any language. Footprints count too. A path or a trail is close: left behind, but not taken. Time is wrong.",
        "mode": "FIRST_N",
        "winners": 5,
        "prize": 40 * C.GEN,
        "fee": C.GEN // 2,
        "seal_hours": 336,
        "reveal_hours": 48,
        "plays": {1: "footsteps", 2: "a trail", 3: "Schritte"},
    },
}


def now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load() -> dict:
    if RECORD.exists():
        return json.loads(RECORD.read_text(encoding="utf-8"))
    return {"network": C.NETWORK, "riddles": {}, "steps": []}


def save(record: dict) -> None:
    RECORD.parent.mkdir(parents=True, exist_ok=True)
    RECORD.write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def lock_hex(answer: str, notes: str, salt: str) -> str:
    return hashlib.sha256(f"{answer}|{notes}|{salt}".encode("utf-8")).hexdigest()


def seal_hex(answer: str, salt: str, address: str) -> str:
    return hashlib.sha256(f"{answer}|{salt}|{address.lower()}".encode("utf-8")).hexdigest()


def done(record: dict, key: str) -> dict | None:
    return next((s for s in record["steps"] if s["key"] == key), None)


def step(record: dict, key: str, chain: C.Chain, address: str, method: str, args: list, value: int = 0, expect_refusal: bool = False) -> dict:
    """Send one write once; a step already recorded is never sent again."""
    found = done(record, key)
    if found:
        return found
    outcome = chain.send(address, method, args, value=value)
    row = {
        "key": key,
        "method": method,
        "from": chain.account.address,
        "hash": outcome["hash"],
        "ok": outcome["ok"],
        "status": outcome.get("status", ""),
        "returned": outcome.get("result"),
        "refusal": outcome.get("refusal", "") or outcome.get("detail", ""),
        "expected": "refusal" if expect_refusal else "success",
        "at": now_iso(),
    }
    record["steps"].append(row)
    save(record)
    mark = "ok" if outcome["ok"] else "refused"
    print(f"  {key}: {method} {mark} {('-> ' + str(row['returned'])) if outcome['ok'] else row['refusal'][:120]}")
    print(f"    {C.EXPLORER}/tx/{outcome['hash']}")
    if outcome["ok"] == expect_refusal:
        raise SystemExit(f"{key}: expected {'a refusal' if expect_refusal else 'success'}, got the other; stopping so it can be looked at")
    return row


def wait_until(seconds: int, what: str) -> None:
    while True:
        left = seconds + MARGIN - int(time.time())
        if left <= 0:
            return
        print(f"  waiting {left // 60} min {left % 60} s for {what}")
        time.sleep(min(left, 300))


def main() -> int:
    record = load()
    if "--status" in sys.argv:
        print(json.dumps(record, indent=2, ensure_ascii=False)[:4000])
        return 0
    address = C.address()
    people = C.accounts(HOST, VOID_HOST, *PLAYERS)
    chains = {name: C.Chain(acct) for name, acct in people.items()}
    record.update({"contract": address, "explorer": C.EXPLORER, "accounts": {name: acct.address for name, acct in people.items()}})
    save(record)
    for name, acct in people.items():
        chains[name].ensure(acct.address, minimum_gen=150 if "host" in name else 20)

    # 1. Post each riddle and seal its answers.
    for key, spec in RIDDLES.items():
        row = record["riddles"].setdefault(key, {})
        host = VOID_HOST if key == "void" else HOST
        if not row.get("id"):
            row["host_salt"] = row.get("host_salt") or str(uuid.uuid4())
            save(record)
            args = [spec["text"], lock_hex(spec["answer"], spec["notes"], row["host_salt"]), spec["mode"], spec["winners"], spec["fee"], spec["seal_hours"], spec["reveal_hours"], 200]
            sent = step(record, f"{key}:create", chains[host], address, "create_riddle", args, value=spec["prize"])
            row["id"] = int(sent["returned"])
            row["host"] = people[host].address
            save(record)
        rid = row["id"]
        for index, answer in spec["plays"].items():
            name = PLAYERS[index - 1]
            if answer.startswith("COPY:"):
                source = PLAYERS[int(answer[5:]) - 1]
                copied = row["tickets"][source]
                ticket = row.setdefault("tickets", {}).setdefault(name, {"answer": copied["answer"], "salt": copied["salt"], "opens": False, "copied_from": source})
                seal = seal_hex(copied["answer"], copied["salt"], people[source].address)
            else:
                ticket = row.setdefault("tickets", {}).setdefault(name, {"answer": answer, "salt": str(uuid.uuid4()), "opens": True})
                seal = seal_hex(ticket["answer"], ticket["salt"], people[name].address)
            save(record)
            step(record, f"{key}:seal:{name}", chains[name], address, "commit", [rid, seal], value=spec["fee"])

    settled = record["riddles"]["settled"]
    void = record["riddles"]["void"]
    rid = settled["id"]

    # 2. Reveal, once sealing has closed.
    reader = C.Chain()
    wait_until(reader.read_json(address, "get_riddle", [rid])["seal_end"], "sealing to close on the settled riddle")
    step(record, "settled:late-seal", chains[VOID_HOST], address, "commit", [rid, seal_hex("keyboard", "late-salt-0001", people[VOID_HOST].address)], value=RIDDLES["settled"]["fee"], expect_refusal=True)
    spec = RIDDLES["settled"]
    step(record, "settled:host-reveal-wrong-salt", chains[HOST], address, "host_reveal", [rid, spec["answer"], spec["notes"], "0" * 36], expect_refusal=True)
    step(record, "settled:host-reveal", chains[HOST], address, "host_reveal", [rid, spec["answer"], spec["notes"], settled["host_salt"]])
    first = PLAYERS[0]
    step(record, f"settled:reveal-wrong-salt:{first}", chains[first], address, "reveal", [rid, settled["tickets"][first]["answer"], "wrong-salt-0000"], expect_refusal=True)
    for name, ticket in settled["tickets"].items():
        if ticket["opens"]:
            step(record, f"settled:reveal:{name}", chains[name], address, "reveal", [rid, ticket["answer"], ticket["salt"]])
        else:
            # The copier sends the copied answer and salt: hashed with the copier's own address, it never matches.
            step(record, f"settled:copied-reveal:{name}", chains[name], address, "reveal", [rid, ticket["answer"], ticket["salt"]], expect_refusal=True)
    # The void riddle's host never reveals; its players do.
    wait_until(reader.read_json(address, "get_riddle", [void["id"]])["seal_end"], "sealing to close on the void riddle")
    for name, ticket in void["tickets"].items():
        step(record, f"void:reveal:{name}", chains[name], address, "reveal", [void["id"], ticket["answer"], ticket["salt"]])

    # 3. Judge and void, once the reveal windows have ended.
    wait_until(reader.read_json(address, "get_riddle", [rid])["reveal_end"], "the reveal window to end on the settled riddle")
    attempt = 1
    while reader.read_json(address, "get_riddle", [rid])["status"] == "OPEN":
        row = step(record, f"settled:judge:{attempt}", chains[PLAYERS[3]], address, "judge", [rid])
        attempt += 1
        if attempt > 5:
            raise SystemExit("five judge calls without settling; stopping so it can be looked at")
        del row
    wait_until(reader.read_json(address, "get_riddle", [void["id"]])["reveal_end"], "the reveal window to end on the void riddle")
    step(record, "void:judge-refused", chains[PLAYERS[1]], address, "judge", [void["id"]], expect_refusal=True)
    step(record, "void:void", chains[PLAYERS[1]], address, "void", [void["id"]])

    # 4. Claims: two winners and the refunded players of the void riddle claim; the rest stay credited.
    for name in (PLAYERS[0], PLAYERS[2], PLAYERS[1]):
        before = C.Chain().balance(people[name].address)
        due = int(reader.read_json(address, "get_entry", [0, people[name].address.lower()])["balance"])
        row = step(record, f"claim:{name}", chains[name], address, "claim", [])
        row.setdefault("credited_before", str(due))
        row.setdefault("balance_before", str(before))
        save(record)
    final = reader.read_json(address, "get_riddle", [rid])
    record["settled_summary"] = {k: final[k] for k in ("id", "status", "entries", "revealed", "correct", "close", "wrong", "unrevealed", "winners", "share", "host_payout", "batches")}
    record["finished_at"] = now_iso()
    save(record)
    print("\nseeded: " + json.dumps(record["settled_summary"]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
