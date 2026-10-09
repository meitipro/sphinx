#!/usr/bin/env python3
"""
Run the golden cases through the deployed Sphinx contract on Studio Next,
through real consensus, and publish what came out.

    python eval/run_golden.py            # seal, reveal, judge the golden cases, then the held-out ones once
    python eval/run_golden.py --report   # rewrite results.md from results.json

eval/golden.json was written, hashed and timestamped (eval/golden.lock.json)
before the first run, and this script refuses to run if it has changed since.

Six riddles are posted by the "golden_host" account: one per golden riddle
(keyboard, consensus, months) holding its golden cases, and one per held-out
case, so H1 to H3 are judged in rounds of their own, after the golden results
are recorded. Each riddle is Split all, a 5 GEN prize, a 1 GEN entry fee, one
hour of sealing and one hour of reveal, the shortest the contract allows.

Each case is one player account sealing one answer with a fresh salt, then
opening it in the reveal window. The host opens the answer and notes, and once
the window ends one judge transaction per batch has every validator label the
answers. Labels are read back from the contract with get_riddle, never from the
script's memory. Every step is saved before anything is printed, and the run
resumes where it stopped.

A judge whose round produced no decision is recorded as such and, for golden
riddles, sent again; every attempt stays in the record. A held-out riddle is
judged once.
"""

from __future__ import annotations

import datetime
import hashlib
import json
import pathlib
import sys
import time
import uuid

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "scripts"))

import chain as C  # noqa: E402

# A model's reason can carry any character; the Windows console codepage cannot.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = pathlib.Path(__file__).resolve().parent
GOLDEN = HERE / "golden.json"
LOCK = HERE / "golden.lock.json"
RESULTS = HERE / "results.json"
REPORT = HERE / "results.md"
HOST = "golden_host"
PLAYERS = [f"golden_player_{n}" for n in range(1, 7)]
PRIZE = 5 * C.GEN
FEE = 1 * C.GEN
HOURS = 1
MAX_ENTRIES = 10
MARGIN = 45


def now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_results() -> dict:
    if RESULTS.exists():
        return json.loads(RESULTS.read_text(encoding="utf-8"))
    return {"riddles": {}, "cases": {}, "attempts": []}


def save(results: dict) -> None:
    RESULTS.write_text(json.dumps(results, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def must(outcome: dict, what: str) -> dict:
    if not outcome["ok"]:
        raise SystemExit(f"{what} failed: {outcome['detail']}  {C.EXPLORER}/tx/{outcome['hash']}")
    return outcome


def seal_hex(answer: str, salt: str, address: str) -> str:
    return hashlib.sha256(f"{answer}|{salt}|{address.lower()}".encode("utf-8")).hexdigest()


def lock_hex(answer: str, notes: str, salt: str) -> str:
    return hashlib.sha256(f"{answer}|{notes}|{salt}".encode("utf-8")).hexdigest()


def scored(expected: str, got: str) -> bool:
    """Scored on CORRECT or not: the only thing validators compare."""
    if expected == "EITHER":
        return got in ("CORRECT", "CLOSE", "WRONG")
    return (got == "CORRECT") == (expected == "CORRECT")


def groups(golden: dict) -> dict[str, list[dict]]:
    """Riddle key -> its cases. A held-out case gets a riddle of its own."""
    out: dict[str, list[dict]] = {}
    for case in golden["cases"]:
        key = case["riddle"] + (":" + case["id"] if case.get("held_out") else "")
        out.setdefault(key, []).append(case)
    return out


def wait_until(seconds: int, what: str) -> None:
    while True:
        left = seconds + MARGIN - int(time.time())
        if left <= 0:
            return
        print(f"  waiting {left // 60} min {left % 60} s for {what}")
        time.sleep(min(left, 300))


def post(key: str, spec: dict, results: dict, address: str, host: C.Chain) -> int:
    row = results["riddles"].get(key)
    if row:
        return int(row["id"])
    salt = str(uuid.uuid4())
    args = [spec["text"], lock_hex(spec["answer"], spec["notes"], salt), "SPLIT_ALL", 0, FEE, HOURS, HOURS, MAX_ENTRIES]
    before = host.read_json(address, "list_riddles", ["", 0, 1])["total"]
    outcome = must(host.send(address, "create_riddle", args, value=PRIZE), f"create_riddle {key}")
    rid = outcome["result"] if isinstance(outcome["result"], int) else None
    if not rid:
        latest = host.read_json(address, "list_riddles", ["", 0, 1])
        rid = int(latest["items"][0]["id"]) if latest["total"] > before else None
    if not rid:
        raise SystemExit(f"create_riddle {key} returned no riddle id")
    results["riddles"][key] = {"id": int(rid), "tx": outcome["hash"], "host_salt": salt}
    save(results)
    print(f"  posted {key} as riddle {rid}  {C.EXPLORER}/tx/{outcome['hash']}")
    return int(rid)


def run() -> None:
    lock = json.loads(LOCK.read_text(encoding="utf-8"))
    if C.sha256_file(GOLDEN) != lock["sha256"]:
        raise SystemExit("eval/golden.json changed after it was locked; the golden set is not edited after the first run")
    golden = json.loads(GOLDEN.read_text(encoding="utf-8"))
    address = C.address()
    people = C.accounts(HOST, *PLAYERS)
    host = C.Chain(people[HOST])
    players = {name: C.Chain(people[name]) for name in PLAYERS}
    results = load_results()
    results.update(
        {
            "contract": address,
            "contract_sha256": C.deployment().get("sphinx_sha256"),
            "golden_sha256": lock["sha256"],
            "golden_locked_at": lock["locked_at"],
            "network": C.NETWORK,
            "explorer": C.EXPLORER,
            "host": people[HOST].address,
            "players": [people[name].address for name in PLAYERS],
        }
    )
    save(results)
    by_riddle = groups(golden)

    # 1. Post and seal.
    host.ensure(people[HOST].address, minimum_gen=60)
    for name in PLAYERS:
        players[name].ensure(people[name].address, minimum_gen=20)
    for key, cases in by_riddle.items():
        print(f"\n{key}")
        spec = golden["riddles"][key.split(":")[0]]
        rid = post(key, spec, results, address, host)
        for case in cases:
            row = results["cases"].setdefault(case["id"], {})
            if row.get("seal_tx"):
                continue
            name = PLAYERS[case["player"] - 1]
            salt = str(uuid.uuid4())
            row.update({"riddle_key": key, "riddle_id": rid, "player": name, "salt": salt})
            save(results)
            outcome = must(players[name].send(address, "commit", [rid, seal_hex(case["answer"], salt, people[name].address)], value=FEE), f"commit case {case['id']}")
            row.update({"seal_tx": outcome["hash"], "number": outcome["result"]})
            save(results)
            print(f"  case {case['id']} sealed as #{outcome['result']}  {C.EXPLORER}/tx/{outcome['hash']}")

    # 2. Reveal, the host and every player, once sealing has closed.
    first = results["riddles"][next(iter(by_riddle))]["id"]
    wait_until(host.read_json(address, "get_riddle", [first])["seal_end"], "sealing to close")
    for key, cases in by_riddle.items():
        row = results["riddles"][key]
        spec = golden["riddles"][key.split(":")[0]]
        if not row.get("host_reveal_tx"):
            outcome = must(host.send(address, "host_reveal", [row["id"], spec["answer"], spec["notes"], row["host_salt"]]), f"host_reveal {key}")
            row["host_reveal_tx"] = outcome["hash"]
            save(results)
            print(f"  {key}: host revealed  {C.EXPLORER}/tx/{outcome['hash']}")
        for case in cases:
            crow = results["cases"][case["id"]]
            if crow.get("reveal_tx"):
                continue
            outcome = must(players[crow["player"]].send(address, "reveal", [crow["riddle_id"], case["answer"], crow["salt"]]), f"reveal case {case['id']}")
            crow["reveal_tx"] = outcome["hash"]
            save(results)
            print(f"  case {case['id']} revealed  {C.EXPLORER}/tx/{outcome['hash']}")

    # 3. Judge the golden riddles, then the held-out ones, once the window has ended.
    wait_until(host.read_json(address, "get_riddle", [first])["reveal_end"], "the reveal window to end")
    order = [k for k in by_riddle if ":" not in k] + [k for k in by_riddle if ":" in k]
    for key in order:
        judge(key, by_riddle[key], results, address, host)
    report()


def judge(key: str, cases: list[dict], results: dict, address: str, judge_chain: C.Chain) -> None:
    row = results["riddles"][key]
    held_out = ":" in key
    while True:
        current = judge_chain.read_json(address, "get_riddle", [row["id"]])
        if current["status"] != "OPEN":
            break
        tries = [a for a in results["attempts"] if a["riddle_key"] == key]
        if held_out and any(not a.get("ok") for a in tries):
            print(f"  {key}: held out, judged once, no decision; left as it came")
            break
        outcome = judge_chain.send(address, "judge", [row["id"]])
        attempt = {
            "riddle_key": key,
            "riddle_id": row["id"],
            "attempt": len(tries) + 1,
            "tx": outcome["hash"],
            "ok": outcome["ok"],
            "consensus": "decided" if outcome["ok"] else outcome["detail"][:300],
            "returned": outcome.get("result"),
            "sent_at": now_iso(),
        }
        # Saved before anything is printed: a result that exists on chain must
        # never be lost to a failure on this side of the wire.
        results["attempts"].append(attempt)
        save(results)
        print(f"  {key}: judge {'decided: ' + str(outcome.get('result')) if outcome['ok'] else 'no decision: ' + attempt['consensus'][:120]}")
        print(f"  {C.EXPLORER}/tx/{outcome['hash']}")
        if not outcome["ok"] and len(tries) + 1 >= 4:
            print(f"  {key}: four attempts without a decision; stopping here")
            break
    final = judge_chain.read_json(address, "get_riddle", [row["id"]])
    row["status"] = final["status"]
    entries = {e["number"]: e for e in final["entries_list"]}
    for case in cases:
        crow = results["cases"][case["id"]]
        e = entries.get(int(crow["number"]))
        if e:
            crow.update({"label": e["status"], "batch": e["batch"], "judged_at": e["judged_at"], "stored_answer": e["answer"]})
            done = [a for a in results["attempts"] if a["riddle_key"] == key and a.get("ok")]
            crow["judge_tx"] = done[0]["tx"] if done else ""
    save(results)
    for case in cases:
        label = results["cases"][case["id"]].get("label", "?")
        print(f"  case {case['id']}: {label:<10} expected {case['expected']:<8} {'MATCH' if scored(case['expected'], label) else 'MISS'}  {case['answer']}")


def report() -> None:
    results = load_results()
    golden = json.loads(GOLDEN.read_text(encoding="utf-8"))
    explorer = results.get("explorer", C.EXPLORER)
    contract = results.get("contract", "")

    def score(held: bool) -> tuple[int, int]:
        rows = [c for c in golden["cases"] if bool(c.get("held_out")) == held and results["cases"].get(c["id"], {}).get("label") not in (None, "REVEALED", "SEALED")]
        return sum(1 for c in rows if scored(c["expected"], results["cases"][c["id"]]["label"])), len(rows)

    g_hit, g_n = score(False)
    h_hit, h_n = score(True)
    near = [c for c in golden["cases"] if c["expected"] in ("CLOSE", "WRONG") and results["cases"].get(c["id"], {}).get("label") in ("CLOSE", "WRONG")]
    near_same = sum(1 for c in near if results["cases"][c["id"]]["label"] == c["expected"])
    lines = [
        "# Golden cases, through real consensus",
        "",
        f"Contract [`{contract}`]({explorer}/address/{contract}) on Studio Next (chain 61997). Every row is one answer "
        "sealed by a player account with the entry fee, opened in the reveal window, and labelled by one `judge` "
        "transaction in which every validator labelled the batch itself and agreed only on which answers are CORRECT. "
        "Labels are read back from the contract with `get_riddle`, not from the script's memory.",
        "",
        f"- Golden cases 1 to 11: **{g_hit} of {g_n}** scored as expected (CORRECT or not, the only thing validators compare).",
        f"- CLOSE against WRONG, reported and not scored: {near_same} of {len(near)} near misses got the expected one of the two.",
        f"- Held-out cases: **{h_hit} of {h_n}** reached a label. They have no expected answer; their labels are below as they came.",
        f"- `eval/golden.json` sha256 `{results.get('golden_sha256', '')}`, locked at {results.get('golden_locked_at', '')}, before the first run.",
        "",
        "Nothing here was tuned. No case was edited after the lock, and the judge prompt is the spec's, word for word.",
        "",
        "| Case | Riddle | Player answer | Expected | Label | Scored | Judge transaction |",
        "|---|---|---|---|---|---|---|",
    ]
    for case in golden["cases"]:
        row = results["cases"].get(case["id"], {})
        label = row.get("label", "not run yet")
        mark = "held out" if case.get("held_out") else ("✓" if scored(case["expected"], label) else "✗ miss")
        tx = row.get("judge_tx", "")
        link = f"[{tx[:10]}…]({explorer}/tx/{tx})" if tx else ""
        answer = case["answer"].replace("|", "/")
        lines.append(f"| {case['id']} | {case['riddle']} (#{row.get('riddle_id', '?')}) | \"{answer}\" | {case['expected']} | {label} | {mark} | {link} |")
    lines += ["", "## The riddles", ""]
    for key, row in results.get("riddles", {}).items():
        spec = golden["riddles"][key.split(":")[0]]
        lines.append(f"- **{key}**, riddle {row['id']}: posted in [{row['tx'][:10]}…]({explorer}/tx/{row['tx']}), host reveal [{row.get('host_reveal_tx', '')[:10]}…]({explorer}/tx/{row.get('host_reveal_tx', '')}). Answer \"{spec['answer']}\", notes \"{spec['notes']}\"")
    lines += ["", "## Every judge transaction", ""]
    for a in results.get("attempts", []):
        lines.append(f"- {a['riddle_key']} attempt {a['attempt']}: {'decided, ' + str(a.get('returned')) if a['ok'] else a['consensus'][:160]} ([tx]({explorer}/tx/{a['tx']}))")
    lines.append("")
    REPORT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"\nwrote {REPORT.relative_to(C.ROOT).as_posix()}: golden {g_hit}/{g_n}, held out {h_hit}/{h_n}")


if __name__ == "__main__":
    if "--report" in sys.argv:
        report()
    else:
        run()
