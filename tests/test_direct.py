"""
Every method and every rule in section 2 of the build spec, against the real
contract file, with the judge mocked per node.
"""

from __future__ import annotations

import json
import random

import pytest

import genvm_double as D
from harness import ANSWER, GEN, HOST_SALT, HOUR, KEYBOARD, NOTES, T0, World, labels, lock, refused, seal

# --- create_riddle ------------------------------------------------------------------


def test_create_records_the_riddle_and_its_windows():
    w = World()
    assert w.create() == 1
    r = w.riddle()
    assert r["found"] and r["host"].lower() == World.HOST
    assert r["text"] == KEYBOARD and r["lock"] == lock(ANSWER, NOTES, HOST_SALT)
    assert r["mode"] == "FIRST_N" and r["winners_n"] == 5
    assert r["prize"] == str(60 * GEN) and r["entry_fee"] == str(GEN // 2) and r["pot"] == str(60 * GEN)
    assert r["created_at"] == T0 and r["seal_end"] == T0 + 48 * HOUR and r["reveal_end"] == T0 + 72 * HOUR
    assert r["status"] == "OPEN" and r["entries"] == 0 and r["entries_list"] == []
    assert r["answer"] == "" and r["notes"] == "" and r["salt"] == "" and not r["host_revealed"]
    assert w.create() == 2


def test_the_lock_is_stored_in_lower_case_without_0x():
    w = World()
    w.create(lock_hex="0x" + lock(ANSWER, NOTES, HOST_SALT).upper())
    assert w.riddle()["lock"] == lock(ANSWER, NOTES, HOST_SALT)


def test_split_all_stores_no_winner_count():
    w = World()
    w.create(mode="split_all", winners=7)
    assert w.riddle()["mode"] == "SPLIT_ALL" and w.riddle()["winners_n"] == 0


@pytest.mark.parametrize(
    "kwargs, sentence",
    [
        ({"text": "   "}, "the riddle is empty"),
        ({"text": "x" * 601}, "longer than 600"),
        ({"lock_hex": "abc"}, "the lock must be a sha256 hash"),
        ({"lock_hex": "g" * 64}, "the lock must be a sha256 hash"),
        ({"mode": "LOTTERY"}, "the mode is FIRST_N or SPLIT_ALL"),
        ({"winners": 0}, "First N pays 1 to max_entries"),
        ({"winners": 11, "max_entries": 10}, "First N pays 1 to max_entries"),
        ({"fee": 0}, "entry fee is a whole number of wei above zero"),
        ({"seal_hours": 0}, "sealing lasts 1 to 336 hours"),
        ({"seal_hours": 337}, "sealing lasts 1 to 336 hours"),
        ({"reveal_hours": 0}, "reveal window lasts 1 to 168 hours"),
        ({"reveal_hours": 169}, "reveal window lasts 1 to 168 hours"),
        ({"max_entries": 0}, "max_entries is 1 to 200"),
        ({"max_entries": 201}, "max_entries is 1 to 200"),
        ({"prize": 0}, "send the prize with the riddle"),
        ({"seal_hours": True}, "seal_hours is a whole number"),
    ],
)
def test_create_refusals(kwargs, sentence):
    w = World()
    refused(sentence, w.create, **kwargs)
    assert w.riddles()["total"] == 0


def test_the_longest_allowed_values_pass():
    w = World()
    w.create(text="y" * 600, seal_hours=336, reveal_hours=168, max_entries=200, winners=200)
    assert w.riddle()["reveal_end"] == T0 + (336 + 168) * HOUR


# --- commit ---------------------------------------------------------------------------


def test_a_seal_records_the_player_and_only_the_hash():
    w = World()
    w.create()
    p = w.player(1)
    assert w.commit(p, "keyboard") == 1
    e = w.entry(p)["entry"]
    assert e["player"].lower() == p and e["number"] == 1 and e["status"] == "SEALED"
    assert e["seal"] == seal("keyboard", w.tickets[p][1], p) and e["answer"] == ""
    assert e["fee"] == str(World.FEE)
    r = w.riddle()
    assert r["entries"] == 1 and r["pot"] == str(World.PRIZE + World.FEE)
    assert "keyboard" not in json.dumps(r)


def test_seal_numbers_follow_seal_order():
    w = World()
    w.create()
    assert [w.commit(w.player(i), "x" + str(i)) for i in range(1, 6)] == [1, 2, 3, 4, 5]


def test_the_host_cannot_play_their_own_riddle():
    w = World()
    w.create()
    refused("the host knows the answer", w.commit, World.HOST, "a keyboard")


def test_sealing_closes_at_the_seal_end():
    w = World()
    w.create()
    w.at(T0 + 48 * HOUR - 1)
    w.commit(w.player(1), "keyboard")
    w.at(T0 + 48 * HOUR)
    refused("sealing has closed", w.commit, w.player(2), "keyboard")


@pytest.mark.parametrize("value", [World.FEE - 1, World.FEE + 1, 0])
def test_only_the_exact_entry_fee(value):
    w = World()
    w.create()
    refused("send exactly the entry fee", w.commit, w.player(1), "keyboard", value=value)


def test_one_seal_per_address():
    w = World()
    w.create()
    p = w.player(1)
    w.commit(p, "keyboard")
    refused("already sealed", w.commit, p, "a piano")
    # The same address on another riddle is a new seal.
    w.create()
    assert w.commit(p, "keyboard", rid=2) == 1


def test_one_seal_per_address_whatever_its_case():
    w = World()
    w.create()
    w.commit("0x" + "ab" * 20, "keyboard")
    refused("already sealed", w.commit, "0x" + "AB" * 20, "keyboard")


def test_a_riddle_takes_at_most_its_maximum():
    w = World()
    w.create(max_entries=2, winners=1)
    w.commit(w.player(1), "a")
    w.commit(w.player(2), "b")
    refused("this riddle is full", w.commit, w.player(3), "c")


def test_a_seal_must_be_a_hash():
    w = World()
    w.create()
    refused("the seal must be a sha256 hash", w.commit, w.player(1), "keyboard", seal_hex="keyboard")


def test_an_unknown_riddle():
    w = World()
    refused("unknown riddle", w.commit, w.player(1), "keyboard")


# --- host_reveal -------------------------------------------------------------------------


def test_the_host_cannot_reveal_early():
    w = World()
    w.create()
    w.at(T0 + 48 * HOUR - 1)
    refused("never before", w.host_reveal)


def test_the_host_reveals_in_the_window_and_the_answer_becomes_public():
    w = World()
    w.create()
    w.to_reveal()
    assert w.host_reveal() == lock(ANSWER, NOTES, HOST_SALT)
    r = w.riddle()
    assert r["host_revealed"] and r["host_revealed_at"] == T0 + 48 * HOUR
    assert (r["answer"], r["notes"], r["salt"]) == (ANSWER, NOTES, HOST_SALT)
    assert lock(r["answer"], r["notes"], r["salt"]) == r["lock"]


def test_the_host_reveal_window_closes():
    w = World()
    w.create()
    w.to_judging()
    refused("the reveal window has ended", w.host_reveal)


def test_only_the_host_reveals():
    w = World()
    w.create()
    w.to_reveal()
    refused("only the host", w.host_reveal, who=w.player(1))


@pytest.mark.parametrize(
    "change",
    [{"answer": "A piano"}, {"notes": NOTES + " Also a typewriter."}, {"salt": HOST_SALT[:-1] + "2"}, {"answer": "a keyboard"}],
)
def test_a_reveal_that_does_not_match_the_lock_is_rejected(change):
    w = World()
    w.create()
    w.to_reveal()
    refused("do not match the lock", w.host_reveal, **change)
    assert not w.riddle()["host_revealed"]


def test_the_answer_cannot_be_moved_by_re_splitting_the_bars():
    """
    The lock hashes "answer|notes|salt". A host who locked answer "a" with
    notes "b|c" could otherwise reveal answer "a|b" with notes "c" from the same
    hash. A bar is refused in the answer and the salt, so there is one reading.
    """
    w = World()
    w.create(answer="piano", notes="keyboard|anything", salt="salt-0001")
    w.to_reveal()
    refused("cannot contain a bar", w.host_reveal, answer="piano|keyboard", notes="anything", salt="salt-0001")
    w.host_reveal(answer="piano", notes="keyboard|anything", salt="salt-0001")
    assert w.riddle()["answer"] == "piano"


def test_the_host_reveals_once():
    w = World()
    w.create()
    w.to_reveal()
    w.host_reveal()
    refused("already revealed", w.host_reveal)


def test_a_host_answer_longer_than_eighty_is_refused_even_when_it_matches():
    w = World()
    long = "k" * 81
    w.create(answer=long)
    w.to_reveal()
    refused("the answer is 1 to 80 characters", w.host_reveal, answer=long)


@pytest.mark.parametrize("salt", ["short", "has space here", "x" * 81, "bar|salt"])
def test_the_salt_format(salt):
    w = World()
    w.create(salt=salt)
    w.to_reveal()
    refused("the salt is 8 to 80", w.host_reveal, salt=salt)


# --- reveal ----------------------------------------------------------------------------------


def test_a_player_reveals_in_the_window():
    w = World()
    w.create()
    p = w.player(1)
    w.commit(p, "a computer keybord")
    refused("after sealing closes", w.reveal, p)
    w.to_reveal()
    w.reveal(p)
    e = w.entry(p)["entry"]
    assert e["status"] == "REVEALED" and e["answer"] == "a computer keybord" and e["revealed_at"] == T0 + 48 * HOUR
    assert w.riddle()["revealed"] == 1


def test_players_may_reveal_before_the_host():
    w = World()
    w.create()
    p = w.player(1)
    w.commit(p, "keyboard")
    w.to_reveal()
    w.reveal(p)
    assert not w.riddle()["host_revealed"] and w.riddle()["revealed"] == 1


def test_the_player_reveal_window_closes():
    w = World()
    w.create()
    p = w.player(1)
    w.commit(p, "keyboard")
    w.to_judging()
    refused("the reveal window has ended", w.reveal, p)


def test_a_reveal_must_match_the_seal():
    w = World()
    w.create()
    p = w.player(1)
    w.commit(p, "a piano")
    w.to_reveal()
    refused("do not match your seal", w.reveal, p, answer="keyboard")
    refused("do not match your seal", w.reveal, p, salt="salt-" + "0" * 12)
    assert w.entry(p)["entry"]["status"] == "SEALED"


def test_a_copied_seal_can_never_be_opened():
    """Seals include the address, so copying another player's hash buys nothing."""
    w = World()
    w.create()
    a, b = w.player(1), w.player(2)
    w.commit(a, "keyboard", salt="salt-aaaaaaaa")
    copied = w.entry(a)["entry"]["seal"]
    w.commit(b, "keyboard", salt="salt-aaaaaaaa", seal_hex=copied)
    w.to_reveal()
    refused("do not match your seal", w.reveal, b, answer="keyboard", salt="salt-aaaaaaaa")
    w.reveal(a)


def test_only_a_sealed_address_reveals():
    w = World()
    w.create()
    w.to_reveal()
    w.tickets[w.player(9)] = ("keyboard", "salt-12345678")
    refused("no seal on this riddle", w.reveal, w.player(9))


def test_a_player_reveals_once():
    w = World()
    w.create()
    p = w.player(1)
    w.commit(p, "keyboard")
    w.to_reveal()
    w.reveal(p)
    refused("already revealed", w.reveal, p)


def test_a_bar_in_a_player_answer_is_refused():
    w = World()
    w.create()
    p = w.player(1)
    w.commit(p, "key|board")
    w.to_reveal()
    refused("cannot contain a bar", w.reveal, p)


def test_a_long_answer_is_cut_to_eighty_characters():
    w = World()
    w.create()
    p = w.player(1)
    w.commit(p, "keyboard " * 20)
    w.to_reveal()
    w.reveal(p)
    assert w.entry(p)["entry"]["answer"] == ("keyboard " * 20)[:80]


def test_the_seal_hashes_the_lower_case_address():
    """The site hashes account.toLowerCase(); the contract compares the same bytes, whatever case the wallet reports."""
    w = World()
    w.create()
    mixed = "0x" + "aB" * 20
    w.commit(mixed, "keyboard", salt="salt-12345678", seal_hex=seal("keyboard", "salt-12345678", mixed.lower()))
    w.to_reveal()
    w.reveal(mixed)
    assert w.entry(mixed.lower())["entry"]["status"] == "REVEALED"


# --- judge ----------------------------------------------------------------------------------


def test_judging_waits_for_the_reveal_window_and_the_host():
    w = World()
    w.create()
    w.play(["keyboard"])
    w.at(w.riddle()["reveal_end"] - 1)
    refused("judging starts when the reveal window ends", w.judge)
    w.to_judging()
    w.create()
    w.at(w.riddle(2)["reveal_end"])
    refused("can only be voided", w.judge, 2)


def test_one_batch_labels_in_seal_order_and_settles():
    w = World()
    w.create()
    players = w.play(["keyboard", "a piano", "Tastatur", "a map"])
    w.to_judging()
    assert w.judge(1, labels("CORRECT", "CLOSE", "CORRECT", "WRONG")) == "batch 1: 4 labelled, 2 correct, settled"
    got = [w.entry(p)["entry"] for p in players]
    assert [e["status"] for e in got] == ["CORRECT", "CLOSE", "CORRECT", "WRONG"]
    assert [e["rank"] for e in got] == [1, 0, 2, 0]
    assert all(e["batch"] == 1 and e["judged_by"].lower() == World.STRANGER for e in got)
    r = w.riddle()
    assert (r["status"], r["correct"], r["close"], r["wrong"], r["judged"], r["batches"]) == ("SETTLED", 2, 1, 1, 4, 1)
    assert r["settled_by"].lower() == World.STRANGER


def test_the_prompt_carries_the_riddle_the_answer_the_notes_and_numbered_answers():
    w = World()
    w.create()
    w.play(["keyboard", "a piano"])
    w.to_judging()
    w.judge(1, labels("CORRECT", "CLOSE"))
    prompt = w.leader.prompts[-1]
    assert KEYBOARD in prompt and "<<<A keyboard>>>" in prompt and NOTES in prompt
    assert "<<<1: keyboard\n2: a piano>>>" in prompt
    assert prompt.startswith("You are judging answers to a riddle for a contest.")


def test_batches_of_ten_skip_unopened_seals_and_resume_where_they_stopped():
    w = World()
    w.create(mode="SPLIT_ALL")
    players = [w.player(i) for i in range(1, 26)]
    for i, p in enumerate(players):
        w.commit(p, "answer " + str(i + 1))
    w.to_reveal()
    w.host_reveal()
    skipped = {3, 11, 19}  # never opened
    for i, p in enumerate(players):
        if i + 1 not in skipped:
            w.reveal(p)
    w.to_judging()
    first = w.judge(1, labels(*["WRONG"] * 10))
    assert first == "batch 1: 10 labelled, 0 correct"
    numbers = [line.split(":")[0] for line in w.leader.prompts[-1].split("<<<")[4].split(">>>")[0].splitlines()]
    assert numbers == [str(i) for i in range(1, 11)]
    prompt = w.leader.prompts[-1]
    assert "answer 3\n" not in prompt and "answer 11" not in prompt and "10: answer 12>>>" in prompt
    assert w.riddle()["status"] == "OPEN" and w.riddle()["judged"] == 10
    w.judge(1, labels(*["WRONG"] * 10))
    third = w.judge(1, labels("CORRECT", "WRONG"))
    assert third == "batch 3: 2 labelled, 1 correct, settled"
    r = w.riddle()
    assert (r["judged"], r["batches"], r["unrevealed"], r["status"]) == (22, 3, 3, "SETTLED")
    assert [e["status"] for e in r["entries_list"] if e["number"] in skipped] == ["UNREVEALED"] * 3
    assert w.entry(players[23])["entry"]["status"] == "CORRECT"


def test_a_riddle_of_two_hundred_settles_in_twenty_calls():
    w = World()
    w.create(mode="SPLIT_ALL")
    w.play(["guess " + str(i) for i in range(200)])
    w.to_judging()
    for call in range(20):
        w.judge(1, labels(*["WRONG"] * 10))
    assert w.riddle()["status"] == "SETTLED" and w.riddle()["batches"] == 20
    refused("already settled", w.judge)


def test_an_empty_answer_is_wrong_and_never_reaches_the_model():
    w = World()
    w.create()
    players = w.play(["", "keyboard", "  \n "])
    w.to_judging()
    w.judge(1, labels("CORRECT"))
    assert "<<<1: keyboard>>>" in w.leader.prompts[-1]
    assert [w.entry(p)["entry"]["status"] for p in players] == ["WRONG", "CORRECT", "WRONG"]


def test_a_batch_of_only_empty_answers_runs_no_model():
    w = World()
    w.create()
    w.play(["", " "])
    w.to_judging()
    w.judge(1)
    assert w.gl.bus.nondet_runs == 0 and w.riddle()["wrong"] == 2


def test_validators_disagreeing_on_the_correct_set_store_nothing():
    w = World()
    w.create()
    players = w.play(["keyboard", "a piano"])
    w.to_judging()
    with pytest.raises(D.VMError):
        w.judge(1, labels("CORRECT", "CLOSE"), validator=[labels("CORRECT", "CORRECT")])
    assert [w.entry(p)["entry"]["status"] for p in players] == ["REVEALED", "REVEALED"]
    assert w.riddle()["batches"] == 0 and w.riddle()["status"] == "OPEN"


def test_a_near_miss_split_does_not_stall_a_batch_and_the_leader_labels_are_stored():
    w = World()
    w.create()
    players = w.play(["keyboard", "a piano", "a map"])
    w.to_judging()
    w.judge(1, labels("CORRECT", "CLOSE", "WRONG"), validator=[labels("CORRECT", "WRONG", "CLOSE")])
    assert [w.entry(p)["entry"]["status"] for p in players] == ["CORRECT", "CLOSE", "WRONG"]


def test_every_validator_judges_on_its_own():
    w = World()
    w.gl.nondet.validators = [D.NodeWorld("v1"), D.NodeWorld("v2"), D.NodeWorld("v3")]
    w.create()
    w.play(["keyboard"])
    w.to_judging()
    w.judge(1, labels("CORRECT"))
    assert all(len(v.prompts) == 1 for v in w.validators) and w.gl.bus.validator_votes[-1] == [True, True, True]


def test_one_dissenting_validator_fails_the_round():
    w = World()
    w.gl.nondet.validators = [D.NodeWorld("v1"), D.NodeWorld("v2")]
    w.create()
    w.play(["keyboard"])
    w.to_judging()
    w.leader.answers.append(labels("CORRECT"))
    w.validators[0].answers.append(labels("CORRECT"))
    w.validators[1].answers.append(labels("WRONG"))
    with pytest.raises(D.VMError):
        w.judge(1)


def test_a_formatting_slip_is_retried_once():
    w = World()
    w.create()
    p = w.play(["keyboard", "a piano"])
    w.to_judging()
    w.judge(1, labels("CORRECT"), labels("CORRECT", "CLOSE"))
    assert w.entry(p[0])["entry"]["status"] == "CORRECT" and len(w.leader.prompts) == 2


@pytest.mark.parametrize(
    "bad",
    ["", "no json here", '{"labels": "CORRECT"}', labels("CORRECT"), labels("CORRECT", "MAYBE"), labels("CORRECT", "CLOSE", "WRONG")],
)
def test_a_judge_answer_that_cannot_be_read_never_settles(bad):
    w = World()
    w.create()
    w.play(["keyboard", "a piano"])
    w.to_judging()
    with pytest.raises(D.VMError):
        w.judge(1, bad, bad)
    assert w.riddle()["batches"] == 0


def test_labels_are_read_from_a_fenced_or_lower_case_answer():
    w = World()
    w.create()
    p = w.play(["keyboard", "a piano"])
    w.to_judging()
    w.judge(1, '```json\n{"labels": ["correct", " Close "]}\n```')
    assert [w.entry(x)["entry"]["status"] for x in p] == ["CORRECT", "CLOSE"]


def test_a_settled_riddle_takes_no_more_writes():
    w = World()
    w.create()
    w.play(["keyboard"])
    w.to_judging()
    w.judge(1, labels("CORRECT"))
    refused("already settled", w.judge)
    refused("already settled", w.void)


# --- settlement ------------------------------------------------------------------------------


def test_first_n_pays_the_first_n_correct_in_seal_order():
    w = World()
    w.create(winners=2)
    players = w.play(["a piano", "keyboard", "Tastatur", "a map", "clavier"])
    w.to_judging()
    w.judge(1, labels("CLOSE", "CORRECT", "CORRECT", "WRONG", "CORRECT"))
    pot = World.PRIZE + 5 * World.FEE
    share = pot // 2
    assert [w.balance(p) for p in players] == [0, share, share, 0, 0]
    third = w.entry(players[4])["entry"]
    assert third["status"] == "CORRECT" and third["rank"] == 3 and third["payout"] == "0" and not third["winner"]
    r = w.riddle()
    assert r["winners"] == 2 and r["share"] == str(share) and r["host_payout"] == str(pot - 2 * share)


def test_first_n_with_fewer_correct_than_n_pays_every_correct_answer():
    w = World()
    w.create(winners=5)
    players = w.play(["keyboard", "a piano", "Tastatur"])
    w.to_judging()
    w.judge(1, labels("CORRECT", "CLOSE", "CORRECT"))
    pot = World.PRIZE + 3 * World.FEE
    assert w.balance(players[0]) == w.balance(players[2]) == pot // 2 and w.balance(players[1]) == 0


def test_split_all_pays_every_correct_answer_in_equal_shares():
    w = World()
    w.create(mode="SPLIT_ALL")
    players = w.play(["keyboard", "Tastatur", "a piano", "clavier d'ordinateur", "teclado"])
    w.to_judging()
    w.judge(1, labels("CORRECT", "CORRECT", "CLOSE", "CORRECT", "CORRECT"))
    pot = World.PRIZE + 5 * World.FEE
    assert [w.balance(p) for p in players] == [pot // 4, pot // 4, 0, pot // 4, pot // 4]


def test_the_indivisible_remainder_goes_back_to_the_host():
    w = World()
    w.create(mode="SPLIT_ALL", prize=100, fee=1)
    players = w.play(["keyboard", "Tastatur", "teclado"])
    w.to_judging()
    w.judge(1, labels("CORRECT", "CORRECT", "CORRECT"))
    assert [w.balance(p) for p in players] == [34, 34, 34] and w.balance(World.HOST) == 1


def test_nobody_correct_refunds_every_fee_and_returns_the_prize():
    w = World()
    w.create()
    ps = [w.player(1), w.player(2), w.player(3)]
    for p, a in zip(ps, ["a piano", "a map", "keyboard"]):
        w.commit(p, a)
    w.to_reveal()
    w.host_reveal()
    w.reveal(ps[0])
    w.reveal(ps[1])
    w.to_judging()
    w.judge(1, labels("CLOSE", "WRONG"))
    # Every fee comes back, the unopened seal's included.
    assert [w.balance(p) for p in ps] == [World.FEE] * 3
    assert w.balance(World.HOST) == World.PRIZE
    assert [e["refund"] for e in w.riddle()["entries_list"]] == [str(World.FEE)] * 3
    assert w.riddle()["entries_list"][2]["status"] == "UNREVEALED"


def test_no_reveal_at_all_settles_on_the_first_judge_with_no_model():
    w = World()
    w.create()
    p = w.player(1)
    w.commit(p, "keyboard")
    w.to_reveal()
    w.host_reveal()
    w.to_judging()
    assert w.judge() == "settled"
    assert w.gl.bus.nondet_runs == 0
    assert w.balance(p) == World.FEE and w.balance(World.HOST) == World.PRIZE
    assert w.entry(p)["entry"]["status"] == "UNREVEALED"


def test_a_riddle_nobody_played_returns_the_prize():
    w = World()
    w.create()
    w.to_reveal()
    w.host_reveal()
    w.to_judging()
    w.judge()
    assert w.balance(World.HOST) == World.PRIZE and w.riddle()["status"] == "SETTLED"


def test_unrevealed_fees_go_to_the_winners():
    w = World()
    w.create(mode="SPLIT_ALL")
    ps = [w.player(i) for i in (1, 2, 3)]
    for p in ps:
        w.commit(p, "keyboard")
    w.to_reveal()
    w.host_reveal()
    w.reveal(ps[0])
    w.to_judging()
    w.judge(1, labels("CORRECT"))
    assert w.balance(ps[0]) == World.PRIZE + 3 * World.FEE and w.balance(ps[1]) == w.balance(ps[2]) == 0


# --- void ----------------------------------------------------------------------------------


def test_void_waits_for_the_reveal_window():
    w = World()
    w.create()
    w.at(w.riddle()["reveal_end"] - 1)
    refused("only after the reveal window ends", w.void)


def test_a_host_who_revealed_cannot_be_voided():
    w = World()
    w.create()
    w.to_reveal()
    w.host_reveal()
    w.to_judging()
    refused("judged, not voided", w.void)


def test_void_refunds_every_fee_and_splits_the_prize_among_revealed_players():
    w = World()
    w.create(prize=100, fee=7)
    ps = [w.player(i) for i in (1, 2, 3, 4)]
    for p in ps:
        w.commit(p, "keyboard")
    w.to_reveal()
    for p in ps[:3]:
        w.reveal(p)
    w.to_judging()
    assert w.void() == "void"
    assert [w.balance(p) for p in ps] == [7 + 34, 7 + 33, 7 + 33, 7]
    r = w.riddle()
    assert r["status"] == "VOID" and r["unrevealed"] == 1 and r["settled_by"].lower() == World.STRANGER
    assert w.balance(World.HOST) == 0
    refused("already void", w.void)
    refused("already void", w.judge)


def test_void_with_nobody_revealed_returns_the_prize_to_the_host():
    w = World()
    w.create()
    p = w.player(1)
    w.commit(p, "keyboard")
    w.to_judging()
    w.void()
    assert w.balance(p) == World.FEE and w.balance(World.HOST) == World.PRIZE


# --- claim ---------------------------------------------------------------------------------


def test_claim_pays_the_caller_their_balance_once():
    w = World()
    w.create(mode="SPLIT_ALL")
    a, b = w.play(["keyboard", "a piano"])
    w.to_judging()
    w.judge(1, labels("CORRECT", "CLOSE"))
    due = World.PRIZE + 2 * World.FEE
    assert w.claim(a) == due and w.paid_to(a) == due
    assert w.entry(a, 0)["balance"] == "0" and w.entry(a, 0)["claimed"] == str(due)
    refused("nothing to claim", w.claim, a)
    refused("nothing to claim", w.claim, b)


def test_claim_collects_every_riddle_at_once():
    w = World()
    w.create()
    w.create()
    p = w.player(1)
    w.commit(p, "keyboard", rid=1)
    w.commit(p, "keyboard", rid=2)
    w.to_reveal()
    w.host_reveal(1)
    w.host_reveal(2)
    w.reveal(p, 1)
    w.reveal(p, 2)
    w.to_judging()
    w.judge(1, labels("CORRECT"))
    w.judge(2, labels("CORRECT"))
    assert w.claim(p) == 2 * (World.PRIZE + World.FEE)
    assert len(w.gl.bus.transfers) == 1


def test_a_checksummed_address_claims_what_it_was_credited():
    """Nodes report addresses in checksum case; balances are keyed in lower case, so the credit and the claim meet."""
    w = World()
    w.create(mode="SPLIT_ALL")
    mixed = "0x" + "aB" * 20
    w.commit(mixed, "keyboard")
    w.to_reveal()
    w.host_reveal()
    w.reveal(mixed)
    w.to_judging()
    w.judge(1, labels("CORRECT"))
    assert w.entry(mixed.lower(), 0)["balance"] == str(World.PRIZE + World.FEE)
    assert w.claim(mixed) == World.PRIZE + World.FEE


def test_the_host_claims_a_returned_prize():
    w = World()
    w.create()
    w.play(["a map"])
    w.to_judging()
    w.judge(1, labels("WRONG"))
    assert w.claim(World.HOST) == World.PRIZE


def test_judge_and_void_never_move_money():
    w = World()
    w.create()
    w.play(["keyboard"])
    w.to_judging()
    w.judge(1, labels("CORRECT"))
    w.create()
    w.at(w.riddle(2)["reveal_end"])
    w.void(2)
    assert w.gl.bus.transfers == []


# --- views ------------------------------------------------------------------------------------


def test_unknown_ids_answer_found_false():
    w = World()
    assert w.riddle(9) == {"found": False}
    assert w.entry(w.player(1), 9)["found"] is False and w.entry(w.player(1), 9)["balance"] == "0"
    assert w.entry(w.player(1), 0) == {"address": w.player(1), "balance": "0", "claimed": "0", "entries": [], "found": False}


def test_get_entry_zero_lists_every_riddle_a_player_sealed():
    w = World()
    w.create()
    w.create()
    w.create()
    p = w.player(1)
    w.commit(p, "keyboard", rid=1)
    w.commit(p, "piano", rid=3)
    got = w.entry(p.upper().replace("0X", "0x"), 0)
    assert [e["riddle_id"] for e in got["entries"]] == [1, 3] and got["found"]


def test_list_riddles_filters_and_pages_newest_first():
    w = World()
    for _ in range(4):
        w.create()
    w.to_reveal()
    w.host_reveal(2)
    w.to_judging()
    w.judge(2)
    w.void(3)
    assert [r["id"] for r in w.riddles()["items"]] == [4, 3, 2, 1]
    assert [r["id"] for r in w.riddles("open")["items"]] == [4, 1]
    assert [r["id"] for r in w.riddles("SETTLED")["items"]] == [2]
    assert [r["id"] for r in w.riddles("VOID")["items"]] == [3]
    page = w.riddles("", 1, 2)
    assert [r["id"] for r in page["items"]] == [3, 2] and page["total"] == 4
    assert "entries_list" not in page["items"][0]


def test_answers_stay_hidden_until_each_is_revealed():
    w = World()
    w.create()
    a, b = w.player(1), w.player(2)
    w.commit(a, "keyboard")
    w.commit(b, "Tastatur")
    text = json.dumps(w.riddle())
    assert "keyboard" not in text and "Tastatur" not in text and "A keyboard" not in text
    w.to_reveal()
    w.reveal(a)
    text = json.dumps(w.riddle())
    assert "keyboard" in text and "Tastatur" not in text and "A keyboard" not in text


# --- the money always adds up ------------------------------------------------------------------


def run_random(seed: int) -> None:
    rnd = random.Random(seed)
    w = World()
    mode = rnd.choice(["FIRST_N", "SPLIT_ALL"])
    n = rnd.randint(0, 34)
    fee = rnd.randint(1, 10**18)
    prize = rnd.randint(1, 10**20)
    w.create(mode=mode, winners=rnd.randint(1, 6), fee=fee, prize=prize, max_entries=200)
    players = [w.player(i) for i in range(1, n + 1)]
    for p in players:
        w.commit(p, rnd.choice(["keyboard", "piano", "map", ""]), value=fee)
    w.to_reveal()
    host_reveals = rnd.random() < 0.8
    if host_reveals:
        w.host_reveal()
    opened = [p for p in players if rnd.random() < 0.75]
    for p in opened:
        w.reveal(p)
    w.to_judging()
    if host_reveals:
        while w.riddle()["status"] == "OPEN":
            rd = w.riddle()
            batch = [e for e in rd["entries_list"] if e["status"] == "REVEALED"][:10]
            asked = [e for e in batch if e["answer"].strip() != ""]
            if asked:
                w.judge(1, labels(*[rnd.choice(["CORRECT", "CLOSE", "WRONG"]) for _ in asked]))
            else:
                w.judge(1)
    else:
        w.void()
    pot = prize + fee * n
    assert w.credited() == pot, seed
    rd = w.riddle()
    # A settled riddle labels every opened answer; a void one never judges, so opened answers stay REVEALED.
    finished = ("CORRECT", "CLOSE", "WRONG", "UNREVEALED") if host_reveals else ("REVEALED", "UNREVEALED")
    assert all(e["status"] in finished for e in rd["entries_list"]), seed
    if rd["status"] == "SETTLED" and rd["correct"] > 0:
        paid = [e for e in rd["entries_list"] if int(e["payout"]) > 0]
        assert all(e["status"] == "CORRECT" for e in paid)
        if mode == "FIRST_N":
            assert [e["rank"] for e in paid] == list(range(1, len(paid) + 1))
        assert len({e["payout"] for e in paid}) == 1
    for p in set(players) | {World.HOST}:
        due = w.balance(p)
        if due:
            assert w.claim(p) == due
    assert w.paid_out() == pot and w.credited() == 0, seed


@pytest.mark.parametrize("seed", range(60))
def test_the_pot_always_adds_up(seed):
    run_random(seed)


# --- the spec's own riddle, start to finish ------------------------------------------------------


def test_the_keyboard_riddle_from_the_spec():
    w = World()
    w.create(winners=5)
    answers = ["keyboard", "a piano", "Tastatur", "a map", "keyboard or piano", "a computer keybord", None, "clavier d'ordinateur"]
    players = [w.player(i) for i in range(1, 9)]
    for p, a in zip(players, answers):
        w.commit(p, a if a is not None else "a door")
    w.to_reveal()
    w.host_reveal()
    for p, a in zip(players, answers):
        if a is not None:
            w.reveal(p)
    w.to_judging()
    w.judge(1, labels("CORRECT", "CLOSE", "CORRECT", "WRONG", "WRONG", "CORRECT", "CORRECT"))
    rd = w.riddle()
    assert [e["status"] for e in rd["entries_list"]] == ["CORRECT", "CLOSE", "CORRECT", "WRONG", "WRONG", "CORRECT", "UNREVEALED", "CORRECT"]
    assert [e["rank"] for e in rd["entries_list"] if e["status"] == "CORRECT"] == [1, 2, 3, 4]
    pot = World.PRIZE + 8 * World.FEE
    assert w.claim(players[5]) == pot // 4
