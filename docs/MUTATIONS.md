# Mutations

Written by `python scripts/mutate.py --table docs/MUTATIONS.md`. 74 defences in
`contracts/sphinx.py` were each broken on their own, and every mutant was caught. Each row
names the first test that failed against it, read from pytest's report rather than an exit code.
The generated-files and deployed-record tests are excluded, because they fail for any edit at all.

| # | defence broken | caught by |
|---|---|---|
| 1 | host_reveal: anyone reveals the answer | `tests/test_direct.py::test_only_the_host_reveals` |
| 2 | host_reveal: addresses compared as text | `tests/test_static.py::test_host_writes_check_the_host_first` |
| 3 | commit: the host plays their own riddle | `tests/test_direct.py::test_the_host_cannot_play_their_own_riddle` |
| 4 | create: the riddle is recorded as nobody's | `tests/test_direct.py::test_create_records_the_riddle_and_its_windows` |
| 5 | commit: the player is not recorded | `tests/test_direct.py::test_a_seal_records_the_player_and_only_the_hash` |
| 6 | judge: the caller is not recorded | `tests/test_direct.py::test_one_batch_labels_in_seal_order_and_settles` |
| 7 | void: the caller is not recorded | `tests/test_direct.py::test_void_refunds_every_fee_and_splits_the_prize_among_revealed_players` |
| 8 | claim: pays a fixed address | `tests/test_direct.py::test_claim_pays_the_caller_their_balance_once` |
| 9 | commit: any fee is accepted | `tests/test_direct.py::test_only_the_exact_entry_fee[499999999999999999]` |
| 10 | commit: a fee above the entry fee is accepted | `tests/test_direct.py::test_only_the_exact_entry_fee[500000000000000001]` |
| 11 | commit: two seals from one address | `tests/test_direct.py::test_one_seal_per_address` |
| 12 | commit: one past the maximum | `tests/test_direct.py::test_a_riddle_takes_at_most_its_maximum` |
| 13 | commit: sealing never closes | `tests/test_direct.py::test_sealing_closes_at_the_seal_end` |
| 14 | commit: any text passes as a seal | `tests/test_direct.py::test_create_refusals[kwargs2-the` |
| 15 | create: no prize needed | `tests/test_direct.py::test_create_refusals[kwargs14-send` |
| 16 | create: a free entry | `tests/test_direct.py::test_create_refusals[kwargs7-entry` |
| 17 | create: First N with no winners | `tests/test_direct.py::test_create_refusals[kwargs5-First` |
| 18 | create: more than 200 entries | `tests/test_direct.py::test_create_refusals[kwargs13-max_entries` |
| 19 | create: a zero-hour seal window | `tests/test_direct.py::test_create_refusals[kwargs8-sealing` |
| 20 | create: the riddle text is unbounded | `tests/test_direct.py::test_create_refusals[kwargs1-longer` |
| 21 | host_reveal: the lock is not checked | `tests/test_direct.py::test_a_reveal_that_does_not_match_the_lock_is_rejected[change0]` |
| 22 | host_reveal: early, while sealing is open | `tests/test_direct.py::test_the_host_cannot_reveal_early` |
| 23 | host_reveal: after the window | `tests/test_direct.py::test_the_host_reveal_window_closes` |
| 24 | host_reveal: twice | `tests/test_direct.py::test_the_host_reveals_once` |
| 25 | host_reveal: a bar may move the answer | `tests/test_direct.py::test_the_answer_cannot_be_moved_by_re_splitting_the_bars` |
| 26 | host_reveal: an answer of any length | `tests/test_direct.py::test_a_host_answer_longer_than_eighty_is_refused_even_when_it_matches` |
| 27 | lock: the bar is dropped between fields | `tests/test_direct.py::test_the_host_reveals_in_the_window_and_the_answer_becomes_public` |
| 28 | seal: the address is not hashed | `tests/test_direct.py::test_a_player_reveals_in_the_window` |
| 29 | seal: the address keeps its case | `tests/test_direct.py::test_the_seal_hashes_the_lower_case_address` |
| 30 | salt: any characters | `tests/test_direct.py::test_the_salt_format[has` |
| 31 | reveal: the seal is not checked | `tests/test_direct.py::test_a_reveal_must_match_the_seal` |
| 32 | reveal: early, while sealing is open | `tests/test_direct.py::test_a_player_reveals_in_the_window` |
| 33 | reveal: after the window | `tests/test_direct.py::test_the_player_reveal_window_closes` |
| 34 | reveal: twice | `tests/test_direct.py::test_a_player_reveals_once` |
| 35 | reveal: the answer is not cut | `tests/test_direct.py::test_a_long_answer_is_cut_to_eighty_characters` |
| 36 | reveal: the count is not kept | `tests/test_direct.py::test_a_player_reveals_in_the_window` |
| 37 | judge: before the reveal window ends | `tests/test_direct.py::test_judging_waits_for_the_reveal_window_and_the_host` |
| 38 | judge: with no host answer | `tests/test_direct.py::test_judging_waits_for_the_reveal_window_and_the_host` |
| 39 | judge: a settled riddle is judged again | `tests/test_direct.py::test_a_riddle_of_two_hundred_settles_in_twenty_calls` |
| 40 | batch: eleven answers per call | `tests/test_direct.py::test_batches_of_ten_skip_unopened_seals_and_resume_where_they_stopped` |
| 41 | batch: unopened seals are judged | `tests/test_direct.py::test_batches_of_ten_skip_unopened_seals_and_resume_where_they_stopped` |
| 42 | batch: the last batch does not settle | `tests/test_direct.py::test_one_batch_labels_in_seal_order_and_settles` |
| 43 | judge: validators agree with anything | `tests/test_direct.py::test_validators_disagreeing_on_the_correct_set_store_nothing` |
| 44 | judge: validators compare every label | `tests/test_direct.py::test_a_near_miss_split_does_not_stall_a_batch_and_the_leader_labels_are_stored` |
| 45 | judge: the wrong label count is accepted | `tests/test_direct.py::test_a_judge_answer_that_cannot_be_read_never_settles[{"labels":` |
| 46 | judge: an unknown label is accepted | `tests/test_direct.py::test_a_judge_answer_that_cannot_be_read_never_settles[{"labels":` |
| 47 | judge: no retry on a formatting slip | `tests/test_direct.py::test_a_formatting_slip_is_retried_once` |
| 48 | judge: an empty answer is sent to the model | `tests/test_direct.py::test_an_empty_answer_is_wrong_and_never_reaches_the_model` |
| 49 | judge: the rank is not counted | `tests/test_direct.py::test_one_batch_labels_in_seal_order_and_settles` |
| 50 | judge: writes before the block runs | `tests/test_direct.py::test_one_batch_labels_in_seal_order_and_settles` |
| 51 | prompt: the fence lets delimiters through | `tests/test_static.py::test_the_blocks_close_where_the_contract_closes_them` |
| 52 | prompt: the answers are not fenced | `tests/test_static.py::test_every_judge_prompt_value_is_fenced` |
| 53 | prompt: the notes are not fenced | `tests/test_static.py::test_every_judge_prompt_value_is_fenced` |
| 54 | prompt: an answer may span lines | `tests/test_static.py::test_each_answer_is_flattened_to_its_own_line` |
| 55 | settle: First N pays every correct answer | `tests/test_direct.py::test_first_n_pays_the_first_n_correct_in_seal_order` |
| 56 | settle: a correct answer past N is paid | `tests/test_direct.py::test_first_n_pays_the_first_n_correct_in_seal_order` |
| 57 | settle: a near miss is paid | `tests/test_direct.py::test_first_n_pays_the_first_n_correct_in_seal_order` |
| 58 | settle: the fees stay out of the pot | `tests/test_direct.py::test_first_n_pays_the_first_n_correct_in_seal_order` |
| 59 | settle: the remainder is lost | `tests/test_direct.py::test_the_indivisible_remainder_goes_back_to_the_host` |
| 60 | settle: nobody correct keeps the fees | `tests/test_direct.py::test_nobody_correct_refunds_every_fee_and_returns_the_prize` |
| 61 | settle: nobody correct keeps the prize | `tests/test_direct.py::test_nobody_correct_refunds_every_fee_and_returns_the_prize` |
| 62 | settle: unopened seals stay sealed | `tests/test_direct.py::test_batches_of_ten_skip_unopened_seals_and_resume_where_they_stopped` |
| 63 | settle: the riddle stays open | `tests/test_direct.py::test_one_batch_labels_in_seal_order_and_settles` |
| 64 | void: before the reveal window ends | `tests/test_direct.py::test_void_waits_for_the_reveal_window` |
| 65 | void: a host who revealed is voided | `tests/test_direct.py::test_a_host_who_revealed_cannot_be_voided` |
| 66 | void: twice | `tests/test_direct.py::test_a_settled_riddle_takes_no_more_writes` |
| 67 | void: fees are not refunded | `tests/test_direct.py::test_void_refunds_every_fee_and_splits_the_prize_among_revealed_players` |
| 68 | void: unopened players share the prize | `tests/test_direct.py::test_void_refunds_every_fee_and_splits_the_prize_among_revealed_players` |
| 69 | void: the remainder is lost | `tests/test_direct.py::test_void_refunds_every_fee_and_splits_the_prize_among_revealed_players` |
| 70 | void: nobody revealed keeps the prize | `tests/test_direct.py::test_void_with_nobody_revealed_returns_the_prize_to_the_host` |
| 71 | void: the riddle stays open | `tests/test_direct.py::test_void_refunds_every_fee_and_splits_the_prize_among_revealed_players` |
| 72 | claim: the balance is paid twice | `tests/test_direct.py::test_claim_pays_the_caller_their_balance_once` |
| 73 | claim: nothing due still sends | `tests/test_direct.py::test_claim_pays_the_caller_their_balance_once` |
| 74 | credit: balances keyed by case | `tests/test_direct.py::test_a_checksummed_address_claims_what_it_was_credited` |
