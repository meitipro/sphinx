"""
Loads the REAL contract file against the doubles in genvm_double.py.

Nothing is copied or re-implemented here, so a change to contracts/sphinx.py
is a change to what these tests exercise. The runner comment on the first lines
of the contract is ignored by CPython, so the file imports as ordinary Python.

The hashes the tests send are made here with hashlib, independently of the
contract's own lock_of and seal_of, so a contract that hashed the wrong bytes
would refuse every reveal below. tests/vectors.json pins both sides.
"""

from __future__ import annotations

import datetime
import hashlib
import importlib.util
import json
import os
import pathlib
import sys
import types

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
#: SPHINX_CONTRACT points the suite at a mutant; scripts/mutate.py sets it.
CONTRACT = pathlib.Path(os.environ.get("SPHINX_CONTRACT") or ROOT / "contracts" / "sphinx.py")

sys.path.insert(0, str(HERE))

import genvm_double as D  # noqa: E402

GEN = 10**18
HOUR = 3600

#: 2026-09-01T00:00:00Z. Every world starts here.
T0 = 1788220800


def _install(gl: D.GL) -> None:
    """
    Publish a `genlayer` package shaped like py-genlayer:5jycge4q (Studio Next):
    the star import brings Address and the integer types, `import genlayer as gl`
    is the package itself, and the storage names live in genlayer.storage. An
    import the contract left out fails here rather than on chain.
    """
    storage = types.ModuleType("genlayer.storage")
    storage.TreeMap = D.TreeMap
    storage.DynArray = D.DynArray
    storage.allow = D.allow_storage
    module = types.ModuleType("genlayer")
    module.Address = D.Address
    for name in ("u8", "u16", "u32", "u64", "u256"):
        setattr(module, name, getattr(D, name))
    for name in ("contract", "vm", "message", "public", "nondet", "evm"):
        setattr(module, name, getattr(gl, name))
    module.storage = storage
    module.__all__ = ["Address", "u8", "u16", "u32", "u64", "u256"]
    sys.modules["genlayer"] = module
    sys.modules["genlayer.storage"] = storage


def load(gl: D.GL, path: pathlib.Path | None = None, name: str = "sphinx_contract") -> types.ModuleType:
    """Import the contract fresh against this gl."""
    _install(gl)
    spec = importlib.util.spec_from_file_location(name, path or CONTRACT)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


# --- hashes, made independently of the contract -------------------------------


def lock(answer: str, notes: str, salt: str) -> str:
    return hashlib.sha256(f"{answer}|{notes}|{salt}".encode("utf-8")).hexdigest()


def seal(answer: str, salt: str, address: str) -> str:
    return hashlib.sha256(f"{answer}|{salt}|{address.lower()}".encode("utf-8")).hexdigest()


# --- the riddle the tests post -----------------------------------------------------

KEYBOARD = "I have keys but open no locks, I have space but no room, you can enter but not go inside. What am I?"
ANSWER = "A keyboard"
NOTES = "Any computer keyboard, in any language. A piano is close: keys, but no space or enter. Two guesses in one answer are wrong."
HOST_SALT = "7f3a0c55-2b1e-4d1a-9b7c-e91c00000001"


def labels(*names: str) -> str:
    """A judge answer the way a model writes it."""
    return json.dumps({"labels": list(names)})


class World:
    """
    One Sphinx contract and the accounts around it.

    Time is explicit: `at(seconds)` sets the transaction datetime the contract
    reads, because nothing on chain moves the clock on its own and the windows
    are what these tests most need to control.
    """

    HOST = "0x" + "b1" * 20
    STRANGER = "0x" + "d4" * 20
    FEE = GEN // 2
    PRIZE = 60 * GEN

    def __init__(self) -> None:
        self.gl = D.GL()
        self.mod = load(self.gl)
        self.at(T0)
        self.sender(self.HOST)
        self.c = self.mod.Sphinx()
        #: player address -> (answer, salt) they sealed
        self.tickets: dict[str, tuple[str, str]] = {}

    # -- controls ----------------------------------------------------------

    def at(self, seconds: int) -> "World":
        self.t = int(seconds)
        stamp = datetime.datetime.fromtimestamp(self.t, datetime.timezone.utc)
        self.gl.message.raw["datetime"] = stamp.strftime("%Y-%m-%dT%H:%M:%SZ")
        return self

    def advance(self, seconds: int) -> "World":
        return self.at(self.t + seconds)

    def sender(self, address: str, value: int = 0) -> "World":
        self.gl.message.sender_address = D.Address(address)
        self.gl.message.origin_address = D.Address(address)
        self.gl.message.value = int(value)
        return self

    @staticmethod
    def player(n: int) -> str:
        return "0x" + f"{n:02x}" * 20 if n < 0xB0 else "0x" + "a0" * 19 + f"{n:02x}"

    @property
    def leader(self) -> D.NodeWorld:
        return self.gl.nondet.leader

    @property
    def validators(self) -> list[D.NodeWorld]:
        return self.gl.nondet.validators

    # -- shorthands --------------------------------------------------------

    def create(
        self,
        mode="FIRST_N",
        winners=5,
        fee=None,
        seal_hours=48,
        reveal_hours=24,
        max_entries=200,
        prize=None,
        answer=ANSWER,
        notes=NOTES,
        salt=HOST_SALT,
        text=KEYBOARD,
        who=None,
        lock_hex=None,
    ) -> int:
        self.sender(who or self.HOST, self.PRIZE if prize is None else prize)
        try:
            return int(
                self.c.create_riddle(
                    text,
                    lock_hex if lock_hex is not None else lock(answer, notes, salt),
                    mode,
                    winners,
                    self.FEE if fee is None else fee,
                    seal_hours,
                    reveal_hours,
                    max_entries,
                )
            )
        finally:
            self.sender(who or self.HOST)

    def commit(self, who: str, answer: str, rid: int = 1, salt: str | None = None, value=None, seal_hex=None) -> int:
        salt = salt or ("salt-" + who[2:14])
        self.tickets[who.lower()] = (answer, salt)
        fee = int(self.riddle(rid).get("entry_fee", self.FEE)) if value is None else value
        self.sender(who, fee)
        try:
            return int(self.c.commit(rid, seal_hex if seal_hex is not None else seal(answer, salt, who)))
        finally:
            self.sender(who)

    def host_reveal(self, rid: int = 1, answer=ANSWER, notes=NOTES, salt=HOST_SALT, who=None) -> str:
        self.sender(who or self.HOST)
        return str(self.c.host_reveal(rid, answer, notes, salt))

    def reveal(self, who: str, rid: int = 1, answer=None, salt=None) -> str:
        sealed_answer, sealed_salt = self.tickets[who.lower()]
        self.sender(who)
        return str(self.c.reveal(rid, sealed_answer if answer is None else answer, sealed_salt if salt is None else salt))

    def to_reveal(self, rid: int = 1) -> "World":
        return self.at(self.riddle(rid)["seal_end"])

    def to_judging(self, rid: int = 1) -> "World":
        return self.at(self.riddle(rid)["reveal_end"])

    def queue(self, *answers, validator=None) -> None:
        """Model answers for the leader, in call order, and the same (or `validator`) for each validator."""
        for a in answers:
            self.leader.answers.append(a)
        for world in self.validators:
            for a in validator if validator is not None else answers:
                world.answers.append(a)

    def judge(self, rid: int = 1, *answers, who=None, validator=None) -> str:
        if answers:
            self.queue(*answers, validator=validator)
        self.sender(who or self.STRANGER)
        return str(self.c.judge(rid))

    def void(self, rid: int = 1, who=None) -> str:
        self.sender(who or self.STRANGER)
        return str(self.c.void(rid))

    def claim(self, who: str) -> int:
        self.sender(who)
        return int(self.c.claim())

    def play(self, answers: list[str], rid: int = 1, reveal: bool = True, start: int = 1) -> list[str]:
        """Seal one answer per new player, then (after sealing) reveal them all. Returns the players."""
        players = [self.player(start + i) for i in range(len(answers))]
        for who, answer in zip(players, answers):
            self.commit(who, answer, rid)
        if reveal:
            self.to_reveal(rid)
            self.host_reveal(rid)
            for who in players:
                self.reveal(who, rid)
        return players

    # -- reads -------------------------------------------------------------

    def riddle(self, rid: int = 1) -> dict:
        return json.loads(self.c.get_riddle(rid))

    def entry(self, who: str, rid: int = 1) -> dict:
        return json.loads(self.c.get_entry(rid, who))

    def riddles(self, status: str = "", offset: int = 0, limit: int = 50) -> dict:
        return json.loads(self.c.list_riddles(status, offset, limit))

    def balance(self, who: str) -> int:
        return int(self.entry(who, 0)["balance"])

    def paid_to(self, address: str) -> int:
        return sum(t.value for t in self.gl.bus.transfers if t.to.lower() == address.lower())

    def paid_out(self) -> int:
        return sum(t.value for t in self.gl.bus.transfers)

    def credited(self) -> int:
        """Every wei credited and not yet claimed, over every account the contract knows."""
        return sum(int(v) for v in dict.values(self.c.balances))


def refused(prefix: str, fn, *args, **kwargs) -> str:
    """Assert the call is refused, and that the refusal is the sentence it should be."""
    try:
        fn(*args, **kwargs)
    except D.UserError as error:
        message = str(error)
        assert message.startswith("[EXPECTED] "), f"unprefixed refusal: {message}"
        assert prefix in message, f"expected {prefix!r}, got {message!r}"
        return message
    raise AssertionError(f"expected a refusal containing {prefix!r}, nothing was raised")
