from pathlib import Path
from utils import load_allowed_accounts, match_allowed_accounts_in_file_name
import json

allowed = set(load_allowed_accounts())
path = Path(
    r"i:\My Drive\Homestead\Finance\Budget and Tracking\Downloaded Transactions"
    r"\_catchup 2511-2606\import_1785454376_ingested.jsonl"
)
folder = path.parent

print("=== current ingest auto-resolve ===")
for csv in sorted(folder.glob("*.csv")):
    matches = match_allowed_accounts_in_file_name(str(csv))
    label = matches if matches else ["NONE - would prompt"]
    print(f"{csv.name}: {label}")

accounts = set()
by_src = {}
for line in path.read_text(encoding="utf-8").splitlines():
    if not line.strip():
        continue
    r = json.loads(line)
    accounts.add(r["account"])
    by_src.setdefault(r["source_file"], set()).add(r["account"])

print()
print("=== jsonl accounts vs allowlist ===")
for a in sorted(accounts):
    print(f"  {a}: {'OK' if a in allowed else 'NOT IN ALLOWLIST'}")

print()
print("=== jsonl vs auto re-ingest ===")
for src, accts in sorted(by_src.items()):
    matches = match_allowed_accounts_in_file_name(src)
    auto = matches[0] if len(matches) == 1 else None
    for a in accts:
        if auto is None:
            status = "ingest would prompt"
        elif a == auto:
            status = "same as auto"
        else:
            status = f"DIFFERS from auto={auto}"
        print(f"  {src}: jsonl={a} -> {status}")

prog = path.with_name(path.stem + ".progress.json")
print()
print("progress file exists:", prog.exists())
