"""
Read a riddle and its answers from Python, with genlayer-py 0.19.0rc2.

    python web/examples/read_riddle.py <riddle id>

genlayer-py reads through an account even for views, so a throwaway one is
made here; it is never funded and never signs. This file is the Python sample
on the docs page "Quickstart: play your first riddle", copied in by
scripts/gen_docs.py.
"""

import json
import sys

from genlayer_py import create_account, create_client
from genlayer_py.chains import studio_devnet

SPHINX = "0x864906361b22e044d363083cad710366E8AfECD1"
studio_devnet.rpc_urls = {"default": {"http": ["https://studio-next.genlayer.com/api"]}}

reader = create_account()
client = create_client(chain=studio_devnet, account=reader)
riddle_id = int(sys.argv[1] if len(sys.argv) > 1 else 1)
riddle = json.loads(client.read_contract(address=SPHINX, function_name="get_riddle", args=[riddle_id], account=reader))
if not riddle["found"]:
    raise SystemExit("no such riddle")
print(
    json.dumps(
        {
            "riddle": riddle["text"],
            "status": riddle["status"],
            "answer": riddle["answer"] or "(locked)",
            "pot_wei": riddle["pot"],
            "answers": [[e["number"], e["answer"] or "(sealed)", e["status"]] for e in riddle["entries_list"]],
        },
        ensure_ascii=False,
    )
)
