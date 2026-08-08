import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from utils import match_allowed_accounts_in_file_name


def test_matches_account_by_configured_fragment():
    definitions = [
        {"account": "boa_bills_2232", "matches": ["2232"]},
        {"account": "boa_check_bad_2955", "matches": ["2955"]},
        {"account": "capital_one", "matches": ["capone"]},
        {"account": "chase", "matches": ["chase"]},
    ]

    assert match_allowed_accounts_in_file_name("download_2232.csv", definitions) == ["boa_bills_2232"]
    assert match_allowed_accounts_in_file_name("statement_2955.csv", definitions) == ["boa_check_bad_2955"]
    assert match_allowed_accounts_in_file_name("capone_export.csv", definitions) == ["capital_one"]
    assert match_allowed_accounts_in_file_name("chase_2024.csv", definitions) == ["chase"]
